import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

const JWT_SECRET   = process.env.JWT_SECRET || 'secret-longview-key';
const META_PAGE_ID = '259079394232614';
// Cache nunca expira no caminho de leitura — cron ou ?refresh=true renovam.

function parseJsonValue<T = any>(value: unknown): T {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }
  return value as T;
}

async function verifyAuth(): Promise<any | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return null;
    return jwt.verify(token, JWT_SECRET);
  } catch { return null; }
}

async function readPgCache(key: string): Promise<any | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { sql, ensureSchema } = await import('@/lib/pg');
    await ensureSchema();
    const rows = await sql`SELECT data FROM project_state WHERE key = ${key} LIMIT 1`;
    if (!rows[0]) return null;
    return parseJsonValue(rows[0].data);
  } catch { return null; }
}

async function readLeadsFromPg(startDate?: string | null, endDate?: string | null): Promise<{ leads: any[]; total: number; crmTotal: number } | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { sql, ensureSchema } = await import('@/lib/pg');
    await ensureSchema();
    const [countRow] = await sql<{ count: string }[]>`SELECT COUNT(*) AS count FROM leads`;
    const count = parseInt(countRow?.count ?? '0', 10);
    if (count === 0) return null;

    // ponytail: comparação puramente em SQL — sem manipulação de Date em JS.
    // Evita bugs de timezone/DST (o hardcoded -03:00 quebrava em março/outubro).
    // endDate inclui o próprio dia: data_cadastro < endDate::date + 1 dia.
    let rows: { raw: unknown }[];
    if (startDate && endDate) {
      rows = await sql`
        SELECT raw FROM leads
        WHERE data_cadastro >= ${startDate}::date
          AND data_cadastro <  (${endDate}::date + INTERVAL '1 day')
        ORDER BY data_cadastro DESC NULLS LAST
      `;
    } else if (startDate) {
      rows = await sql`
        SELECT raw FROM leads
        WHERE data_cadastro >= ${startDate}::date
        ORDER BY data_cadastro DESC NULLS LAST
      `;
    } else if (endDate) {
      rows = await sql`
        SELECT raw FROM leads
        WHERE data_cadastro < (${endDate}::date + INTERVAL '1 day')
        ORDER BY data_cadastro DESC NULLS LAST
      `;
    } else {
      rows = await sql`SELECT raw FROM leads ORDER BY data_cadastro DESC NULLS LAST`;
    }

    const leads = rows.map((r: { raw: unknown }) => parseJsonValue(r.raw));
    return { leads, total: leads.length, crmTotal: count };
  } catch (e: unknown) {
    console.warn('[/api/data] Postgres leads falhou:', e instanceof Error ? e.message : e);
    return null;
  }
}

async function readEstoqueFromPg() {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { sql, ensureSchema } = await import('@/lib/pg');
    await ensureSchema();
    const empreendimentos = await sql`SELECT id, nome, situacao, tipo FROM cv_empreendimentos`;
    const resumo = await sql`
      SELECT 
        id_empreendimento,
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status = 'Disponivel')::int as disponivel,
        COUNT(*) FILTER (WHERE status = 'Reservado')::int as reservado,
        COUNT(*) FILTER (WHERE status = 'Vendido')::int as vendido,
        COALESCE(SUM(valor) FILTER (WHERE status = 'Disponivel'), 0)::float as vgv_disponivel,
        COALESCE(SUM(valor) FILTER (WHERE status = 'Vendido' OR status = 'Reservado'), 0)::float as vgv_vendido
      FROM cv_unidades
      GROUP BY id_empreendimento
    `;
    const unidades = await sql`SELECT id, id_empreendimento, bloco, numero, status, valor, metragem FROM cv_unidades`;
    
    if (empreendimentos.length === 0) return null;
    return { empreendimentos, resumo, unidades };
  } catch(e: any) {
    console.warn('[/api/data] Postgres estoque falhou:', e.message);
    return null;
  }
}

// Fallback: busca ao vivo do CRM (quando Postgres vazio)
async function fetchAllCRMLeads(email: string, token: string) {
  const headers = { email, token, Accept: 'application/json' };
  const base    = 'https://longviewempreendimentos.cvcrm.com.br/api/v1/comercial/leads';
  try {
    const initial = await axios.get(base, { params: { limit: 1 }, headers, timeout: 8000 });
    const maxLeads   = initial.data.total || 0;
    const limit      = 500;
    const totalPages = Math.ceil(maxLeads / limit);
    const results = await Promise.allSettled(
      Array.from({ length: totalPages }, (_, i) =>
        axios.get(base, { params: { limit, offset: i * limit }, headers, timeout: 12000 })
      )
    );
    const allLeads = results.filter(r => r.status === 'fulfilled').flatMap((r: any) => r.value.data?.leads || []);
    return { leads: allLeads, total: allLeads.length, crmTotal: initial.data.total || allLeads.length };
  } catch (err: any) {
    console.warn('[/api/data] CRM leads falhou:', err.message);
    return { leads: [], total: 0, crmTotal: 0 };
  }
}

async function fetchMetaLive(startDate?: string | null, endDate?: string | null) {
  const META_TOKEN  = process.env.META_TOKEN!;
  const META_ACT_ID = process.env.META_ACT_ID!;
  const META_API_VERSION = 'v21.0';
  const metaBase = `https://graph.facebook.com/${META_API_VERSION}/${META_ACT_ID}`;
  const metaAuth = { access_token: META_TOKEN };

  let timeParams: Record<string, string> = { date_preset: 'maximum' };
  if (startDate && endDate) timeParams = { time_range: JSON.stringify({ since: startDate, until: endDate }) };
  else if (startDate) timeParams = { time_range: JSON.stringify({ since: startDate, until: new Date().toISOString().split('T')[0] }) };
  else if (endDate)   timeParams = { time_range: JSON.stringify({ since: '2020-01-01', until: endDate }) };

  const [global, camps, campDetails, adsets, demo, region, platform, device, daily, forms, page] =
    await Promise.allSettled([
      axios.get(`${metaBase}/insights`, { params: { level: 'account', fields: 'spend,impressions,clicks,reach,frequency,cpc,cpm,ctr,cpp,actions,cost_per_action_type', ...timeParams, ...metaAuth }, timeout: 15000 }),
      axios.get(`${metaBase}/insights`, { params: { level: 'campaign', fields: 'campaign_id,campaign_name,spend,impressions,clicks,reach,frequency,cpc,cpm,ctr,actions,cost_per_action_type,date_start,date_stop', ...timeParams, limit: 500, ...metaAuth }, timeout: 15000 }),
      axios.get(`${metaBase}/campaigns`, { params: { fields: 'id,name,created_time,start_time,stop_time,status,objective,buying_type,daily_budget,lifetime_budget,spend_cap', limit: 1000, ...metaAuth }, timeout: 15000 }),
      axios.get(`${metaBase}/insights`, { params: { level: 'adset', fields: 'campaign_id,campaign_name,adset_id,adset_name,spend,impressions,clicks,reach,cpc,cpm,ctr,actions,cost_per_action_type', ...timeParams, limit: 500, ...metaAuth }, timeout: 15000 }),
      axios.get(`${metaBase}/insights`, { params: { level: 'account', fields: 'clicks,impressions,spend,reach', breakdowns: 'gender,age', ...timeParams, ...metaAuth }, timeout: 15000 }),
      axios.get(`${metaBase}/insights`, { params: { level: 'account', fields: 'clicks,impressions,spend,reach', breakdowns: 'region', ...timeParams, ...metaAuth }, timeout: 15000 }),
      axios.get(`${metaBase}/insights`, { params: { level: 'account', fields: 'clicks,impressions,spend,reach', breakdowns: 'publisher_platform', ...timeParams, ...metaAuth }, timeout: 15000 }),
      axios.get(`${metaBase}/insights`, { params: { level: 'account', fields: 'clicks,impressions,spend,reach', breakdowns: 'device_platform', ...timeParams, ...metaAuth }, timeout: 15000 }),
      axios.get(`${metaBase}/insights`, { params: { level: 'account', fields: 'spend,impressions,clicks,reach,actions', time_increment: 1, ...(startDate || endDate ? timeParams : { date_preset: 'last_30d' }), limit: 90, ...metaAuth }, timeout: 15000 }),
      axios.get(`https://graph.facebook.com/${META_API_VERSION}/${META_PAGE_ID}/leadgen_forms`, { params: { fields: 'id,name,status,leads_count,created_time', limit: 50, ...metaAuth }, timeout: 10000 }),
      axios.get(`https://graph.facebook.com/${META_API_VERSION}/${META_PAGE_ID}`, { params: { fields: 'id,name,fan_count,followers_count,instagram_business_account', ...metaAuth }, timeout: 8000 }),
    ]);

  const get = (r: PromiseSettledResult<any>) => r.status === 'fulfilled' ? r.value.data : null;

  return {
    global:          get(global)?.data?.[0] ?? null,
    campaigns:       get(camps)?.data ?? [],
    campaignDetails: get(campDetails)?.data ?? [],
    adsets:          get(adsets)?.data ?? [],
    demographics:    get(demo)?.data ?? [],
    regions:         get(region)?.data ?? [],
    platforms:       get(platform)?.data ?? [],
    devices:         get(device)?.data ?? [],
    daily:           get(daily)?.data ?? [],
    leadForms:       get(forms)?.data ?? [],
    page:            get(page) ?? null,
  };
}

async function fetchMetaOrphanedLeads(
  leadForms: any[],
  metaAuth: { access_token: string },
  META_API_VERSION: string
): Promise<{ orphanedLeads: unknown[]; totalMetaLeads: number; error: string | null }> {
  if (!leadForms || leadForms.length === 0) return { orphanedLeads: [], totalMetaLeads: 0, error: null };

  const activeForms = (leadForms as { id: string; name: string; status: string; leads_count?: number }[])
    .filter(f => f.status === 'ACTIVE' && (f.leads_count ?? 0) > 0);
  if (activeForms.length === 0) return { orphanedLeads: [], totalMetaLeads: 0, error: null };

  // ponytail: timeout de 25s — evita travar o worker (antes poderia chegar a 150s)
  const TIMEOUT_MS = 25_000;
  const deadline   = new Promise<{ orphanedLeads: unknown[]; totalMetaLeads: number; error: string | null }>(
    resolve => setTimeout(() => resolve({ orphanedLeads: [], totalMetaLeads: 0, error: 'Timeout — resultado parcial' }), TIMEOUT_MS)
  );

  const work = async () => {
    try {
      console.log(`[meta-validation] ${activeForms.length} formulários ativos`);
      const results = await Promise.allSettled(
        activeForms.map(f =>
          axios.get(`https://graph.facebook.com/${META_API_VERSION}/${f.id}/leads`, {
            params: { fields: 'id,created_time,field_data', limit: 200, ...metaAuth },
            timeout: 10000,
          }).then(r => ({ formName: f.name, leads: (r.data?.data ?? []) as { id: string; created_time: string; field_data: { name: string; values: string[] }[] }[] }))
        )
      );

      const metaLeads: { id: string; createdTime: string; formName: string; name: string; email: string; phone: string }[] = [];
      for (const res of results) {
        if (res.status !== 'fulfilled') continue;
        const { formName, leads } = res.value;
        for (const lead of leads) {
          let email = '', phone = '', name = '';
          for (const fd of lead.field_data ?? []) {
            const key = (fd.name ?? '').toLowerCase();
            const val = fd.values?.[0] ?? '';
            if (key.includes('email'))                                             email = val;
            else if (key.includes('phone') || key.includes('tel') || key.includes('cel')) phone = val;
            else if (key.includes('name') || key.includes('nome'))                 name  = val;
          }
          metaLeads.push({ id: lead.id, createdTime: lead.created_time, formName, name, email, phone });
        }
      }

      if (!metaLeads.length) return { orphanedLeads: [], totalMetaLeads: 0, error: null };
      if (!process.env.DATABASE_URL) return { orphanedLeads: [], totalMetaLeads: metaLeads.length, error: 'DATABASE_URL não configurada' };

      const { sql } = await import('@/lib/pg');
      const dbLeads = await sql<{ email: string | null; telefone: string | null }[]>`SELECT email, telefone FROM leads`;
      const dbEmails = new Set(dbLeads.map(l => l.email?.toLowerCase().trim()).filter(Boolean));
      const dbPhones = new Set(dbLeads.map(l => l.telefone?.replace(/\D/g, '') ?? '').filter(Boolean));

      const orphanedLeads = metaLeads.filter(ml => {
        const mEmail = ml.email?.toLowerCase().trim();
        const mPhone = ml.phone?.replace(/\D/g, '') ?? '';
        if (mEmail && dbEmails.has(mEmail)) return false;
        if (mPhone) {
          const stripped = mPhone.replace(/^55/, '');
          if (dbPhones.has(mPhone) || dbPhones.has(stripped) || dbPhones.has('55' + mPhone)) return false;
        }
        return true;
      });

      return { orphanedLeads, totalMetaLeads: metaLeads.length, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[meta-validation] erro:', msg);
      return { orphanedLeads: [], totalMetaLeads: 0, error: `Erro na API do Meta: ${msg}` };
    }
  };

  return Promise.race([work(), deadline]);
}

export async function GET(request: NextRequest) {
  const authUser = await verifyAuth();
  if (!authUser) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

  const canAccessMarketing =
    authUser.role === 'Desenvolvedor' ||
    authUser.permissions?.viewMarketingDashboard === true;

  if (!canAccessMarketing) {
    return NextResponse.json({ error: 'Sem permissão para acessar o Marketing Vision.' }, { status: 403 });
  }

  const ip = getClientIp(request);
  const rl = await rateLimit(`data:${ip}`, 30, 60);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Muitas requisições. Aguarde antes de atualizar novamente.' },
      { status: 429, headers: { 'Retry-After': String(rl.reset) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const startDate    = searchParams.get('start');
  const endDate      = searchParams.get('end');
  const forceRefresh = searchParams.get('refresh') === 'true';
  const isFiltered   = !!(startDate || endDate);
  const syncForce    = searchParams.get('sync') === 'true';
  const validateMeta = searchParams.get('validateMeta') === 'true';

  if (syncForce) {
    const canForceSync = authUser.role === 'Desenvolvedor' || authUser.permissions?.isAdmin === true;
    if (!canForceSync) {
      return NextResponse.json({ error: 'Apenas administradores podem forçar sincronização.' }, { status: 403 });
    }

    try {
      const email = process.env.CV_CRM_EMAIL;
      const token = process.env.CV_CRM_TOKEN;
      if (email && token) {
        console.log('[api/data] Sincronização forçada iniciada...');
        const { leads } = await fetchAllCRMLeads(email, token);
        if (leads.length > 0) {
          const { ensureSchema, sql } = await import('@/lib/pg');
          await ensureSchema();
          const { parseCrmDate } = await import('@/lib/dateUtils');
          
          let upserted = 0;
          const BATCH = 100;
          for (let i = 0; i < leads.length; i += BATCH) {
            const batch = leads.slice(i, i + BATCH);
            for (const lead of batch) {
              const id = String(lead.idlead ?? lead.id ?? '');
              if (!id) continue;

              const nome = lead.nome || lead.name || null;
              const email_lead = lead.email || null;
              const telefone = lead.telefone || lead.celular || lead.phone || null;
              const origem = lead.origem || lead.source || null;
              const status = lead.status || null;
              const empreend = lead.empreendimento?.nome || lead.empreendimento || null;
              const score = lead.score != null ? Number(lead.score) : null;
              const temperatura = lead.temperatura || lead.temperatura_lead || null;
              const dataCad = parseCrmDate(lead.data_cadastro || lead.created_at || lead.createdAt);
              const dataAtual = parseCrmDate(lead.data_atualizacao || lead.updated_at || lead.updatedAt);

              await sql`
                INSERT INTO leads
                  (id, nome, email, telefone, origem, status, empreendimento,
                   score, temperatura, data_cadastro, data_atualizacao, raw, synced_at)
                VALUES
                  (${id}, ${nome}, ${email_lead}, ${telefone}, ${origem}, ${status},
                   ${empreend}, ${score}, ${temperatura}, ${dataCad}, ${dataAtual},
                   ${JSON.stringify(lead)}::jsonb, NOW())
                ON CONFLICT (id) DO UPDATE SET
                  nome             = EXCLUDED.nome,
                  email            = EXCLUDED.email,
                  telefone         = EXCLUDED.telefone,
                  origem           = EXCLUDED.origem,
                  status           = EXCLUDED.status,
                  empreendimento   = EXCLUDED.empreendimento,
                  score            = EXCLUDED.score,
                  temperatura      = EXCLUDED.temperatura,
                  data_cadastro    = EXCLUDED.data_cadastro,
                  data_atualizacao = EXCLUDED.data_atualizacao,
                  raw              = EXCLUDED.raw,
                  synced_at        = EXCLUDED.synced_at
              `;
              upserted++;
            }
          }
          console.log(`[api/data] Sincronização forçada concluída. ${upserted} leads atualizados.`);
        }
      }
    } catch (e: any) {
      console.error('[api/data] Erro na sincronização forçada:', e.message);
    }
  }

  const [pgLeads, metaCache, pgEstoque] = await Promise.all([
    readLeadsFromPg(startDate, endDate),
    readPgCache('meta_cache'),
    readEstoqueFromPg(),
  ]);

  // ---------- META (SEMPRE do Postgres; API externa só nos crons/webhook) ----------
  type MetaDataShape = { leadForms?: unknown[]; page?: unknown; [k: string]: unknown };
  let metaData: MetaDataShape | null = null;
  if (metaCache?.data) metaData = metaCache.data as MetaDataShape;

  // Cache stale: força live se o cron parou (TTL = 3h).
  // Evita que dados desatualizados fiquem no ar indefinidamente sem aviso.
  const cacheAgeMin = metaCache?.updatedAt
    ? (Date.now() - new Date(metaCache.updatedAt as string).getTime()) / 60_000
    : Infinity;
  const cacheStale  = cacheAgeMin > 180;

  const needMetaLive = forceRefresh || !metaData || cacheStale;
  if (cacheStale && metaData) console.warn(`[/api/data] meta_cache stale (${Math.round(cacheAgeMin)}min) — buscando ao vivo`);

  const CV_EMAIL = process.env.CV_CRM_EMAIL!;
  const CV_TOKEN = process.env.CV_CRM_TOKEN!;

  const [liveMetaResult, liveCRMLeads] = await Promise.allSettled([
    needMetaLive ? fetchMetaLive(startDate, endDate) : Promise.resolve(null),
    !pgLeads ? fetchAllCRMLeads(CV_EMAIL, CV_TOKEN) : Promise.resolve(null),
  ]);

  if (needMetaLive && liveMetaResult.status === 'fulfilled' && liveMetaResult.value) {
    metaData = liveMetaResult.value as MetaDataShape;
    // Persiste no banco (sem await) — próximos loads já vêm do Postgres
    import('@/lib/pg').then(({ sql }) =>
      sql`INSERT INTO project_state (key, data) VALUES ('meta_cache', ${JSON.stringify({ data: metaData, updatedAt: new Date().toISOString() })}::jsonb)
          ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data`.catch(() => {})
    );
  }

  const leadsResultRaw = (pgLeads ?? (liveCRMLeads.status === 'fulfilled' ? liveCRMLeads.value : null)) ?? { leads: [], total: 0, crmTotal: 0 };

  // ── Escopo por papel ────────────────────────────────────────────────────────
  // Gestor / Diretoria / Desenvolvedor veem tudo. Demais veem só os leads
  // ligados a eles (corretor.email ou gestor.email == email do usuário).
  // Filtro no servidor — não envia leads de terceiros pro navegador.
  const PRIVILEGED = ['Gestor', 'Diretoria', 'Desenvolvedor'];
  let leadsResult = leadsResultRaw;
  if (!PRIVILEGED.includes(authUser.role)) {
    const myEmail = String(authUser.email || '').toLowerCase().trim();
    const myName  = String(authUser.name  || '').toLowerCase().trim();
    const mine = (leadsResultRaw.leads as any[]).filter(l => {
      const emails = [l.corretor?.email, l.gestor?.email].filter(Boolean).map((e: string) => e.toLowerCase().trim());
      if (myEmail && emails.includes(myEmail)) return true;
      const names = [l.corretor?.nome, l.gestor?.nome].filter(Boolean).map((n: string) => n.toLowerCase().trim());
      return !!myName && names.includes(myName);
    });
    leadsResult = { leads: mine, total: mine.length, crmTotal: mine.length };
  }

  const metaFinal = metaData ?? {
    global: null, campaigns: [], campaignDetails: [], adsets: [],
    demographics: [], regions: [], platforms: [], devices: [], daily: [],
    leadForms: [], page: null,
  };

  const META_TOKEN = process.env.META_TOKEN;
  const metaAuth = { access_token: META_TOKEN || '' };
  
  let metaValidation: { orphanedLeads: unknown[]; totalMetaLeads: number; error: string | null } | null = null;
  const leadForms = Array.isArray(metaFinal.leadForms) ? metaFinal.leadForms : [];
  if (validateMeta && META_TOKEN && leadForms.length > 0) {
    metaValidation = await fetchMetaOrphanedLeads(leadForms, metaAuth, 'v21.0');
  }

  return NextResponse.json({
    leads:     leadsResult,
    meta:      metaFinal,
    estoque:   pgEstoque ?? { empreendimentos: [], resumo: [], unidades: [] },
    leadForms: metaFinal.leadForms,
    page:      metaFinal.page,
    metaValidation,
    updatedAt: new Date().toISOString(),
    _cached:   !needMetaLive && !!pgLeads,
  });
}
