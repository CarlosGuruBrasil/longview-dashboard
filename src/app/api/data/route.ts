import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

const JWT_SECRET   = process.env.JWT_SECRET || 'secret-longview-key';
const META_PAGE_ID = '259079394232614';
const CACHE_MAX_AGE_MS = 4 * 60 * 60 * 1000; // 4h — força re-sync se muito antigo

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
    const d = rows[0].data as any;
    // Se mais antigo que CACHE_MAX_AGE_MS, ignora (força re-sync)
    if (d?.updatedAt && Date.now() - new Date(d.updatedAt).getTime() > CACHE_MAX_AGE_MS) return null;
    return d;
  } catch { return null; }
}

async function readLeadsFromPg(): Promise<{ leads: any[]; total: number; crmTotal: number } | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { sql, ensureSchema } = await import('@/lib/pg');
    await ensureSchema();
    const [countRow] = await sql<{ count: string }[]>`SELECT COUNT(*) AS count FROM leads`;
    const count = parseInt(countRow?.count ?? '0', 10);
    if (count === 0) return null;
    const rows = await sql`SELECT raw FROM leads ORDER BY data_cadastro DESC NULLS LAST`;
    const leads = rows.map((r: any) => typeof r.raw === 'object' ? r.raw : JSON.parse(r.raw));
    return { leads, total: leads.length, crmTotal: leads.length };
  } catch (e: any) {
    console.warn('[/api/data] Postgres leads falhou:', e.message);
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
): Promise<{ orphanedLeads: any[]; totalMetaLeads: number; error: string | null }> {
  if (!leadForms || leadForms.length === 0) {
    return { orphanedLeads: [], totalMetaLeads: 0, error: null };
  }

  const activeForms = leadForms.filter((f: any) => f.status === 'ACTIVE' && (f.leads_count ?? 0) > 0);
  if (activeForms.length === 0) {
    return { orphanedLeads: [], totalMetaLeads: 0, error: null };
  }

  try {
    console.log(`[meta-validation] Buscando leads de ${activeForms.length} formulários ativos no Meta Ads...`);
    const results = await Promise.allSettled(
      activeForms.map((f: any) =>
        axios.get(`https://graph.facebook.com/${META_API_VERSION}/${f.id}/leads`, {
          params: { fields: 'id,created_time,field_data', limit: 200, ...metaAuth },
          timeout: 15000
        }).then(r => ({ formName: f.name, leads: r.data?.data || [] }))
      )
    );

    const metaLeads: any[] = [];
    results.forEach((res: any) => {
      if (res.status === 'fulfilled') {
        const { formName, leads } = res.value;
        leads.forEach((lead: any) => {
          let email = '';
          let phone = '';
          let name = '';
          if (Array.isArray(lead.field_data)) {
            lead.field_data.forEach((fd: any) => {
              const fieldName = (fd.name || '').toLowerCase();
              const val = fd.values?.[0] || '';
              if (fieldName.includes('email')) {
                email = val;
              } else if (fieldName.includes('phone') || fieldName.includes('tel') || fieldName.includes('cel')) {
                phone = val;
              } else if (fieldName.includes('name') || fieldName.includes('nome')) {
                name = val;
              }
            });
          }
          metaLeads.push({
            id: lead.id,
            createdTime: lead.created_time,
            formName,
            name,
            email,
            phone
          });
        });
      }
    });

    if (metaLeads.length === 0) {
      return { orphanedLeads: [], totalMetaLeads: 0, error: null };
    }

    if (!process.env.DATABASE_URL) {
      return { orphanedLeads: [], totalMetaLeads: metaLeads.length, error: 'DATABASE_URL não configurada no backend' };
    }

    const { sql } = await import('@/lib/pg');
    const dbLeads = await sql`SELECT email, telefone FROM leads`;
    const dbEmails = new Set(dbLeads.map(l => l.email?.toLowerCase().trim()).filter(Boolean));
    const dbPhones = new Set(dbLeads.map(l => l.telefone?.replace(/\D/g, '') || '').filter(Boolean));

    const orphanedLeads = metaLeads.filter(ml => {
      const mEmail = ml.email?.toLowerCase().trim();
      const mPhone = ml.phone?.replace(/\D/g, '') || '';
      const hasEmail = mEmail && dbEmails.has(mEmail);
      let hasPhone = false;
      if (mPhone) {
        if (dbPhones.has(mPhone)) {
          hasPhone = true;
        } else {
          const phoneNoDdi = mPhone.replace(/^55/, '');
          if (dbPhones.has(phoneNoDdi) || dbPhones.has('55' + mPhone)) {
            hasPhone = true;
          }
        }
      }
      return !hasEmail && !hasPhone;
    });

    return { orphanedLeads, totalMetaLeads: metaLeads.length, error: null };
  } catch (err: any) {
    console.error('[meta-validation] Erro ao validar leads do Meta:', err.message);
    return { orphanedLeads: [], totalMetaLeads: 0, error: `Erro na API do Meta: ${err.message}` };
  }
}

export async function GET(request: NextRequest) {
  const authUser = await verifyAuth();
  if (!authUser) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

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

  if (syncForce) {
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
                   ${JSON.stringify(lead)}, NOW())
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

  // ---------- LEADS (sempre do Postgres, webhook mantém atualizado) ----------
  const pgLeads = await readLeadsFromPg();

  // ---------- META + ESTOQUE (do cache Postgres, a menos que filtrado por data ou forceRefresh) ----------
  let metaData: any  = null;
  let estoqueData: any = null;

  if (!isFiltered && !forceRefresh) {
    const metaCache    = await readPgCache('meta_cache');
    const estoqueCache = await readPgCache('estoque_cache');
    if (metaCache?.data)    metaData    = metaCache.data;
    if (estoqueCache?.estoque) estoqueData = estoqueCache;
  }

  // Se cache vazio/filtrado, busca ao vivo
  const needMetaLive    = !metaData;
  const needEstoqueLive = !estoqueData;

  const CV_EMAIL = process.env.CV_CRM_EMAIL!;
  const CV_TOKEN = process.env.CV_CRM_TOKEN!;

  const [liveMetaResult, liveEstoqueResult, liveCRMLeads] = await Promise.allSettled([
    needMetaLive    ? fetchMetaLive(startDate, endDate) : Promise.resolve(null),
    needEstoqueLive ? (async () => {
      const headers = { email: CV_EMAIL, token: CV_TOKEN, Accept: 'application/json' };
      const projRes = await axios.get('https://longviewempreendimentos.cvcrm.com.br/api/v1/cadastros/empreendimentos', { headers, timeout: 12000 });
      const projects = Array.isArray(projRes.data) ? projRes.data : [];
      const ids = projects.map((p: any) => p.idempreendimento).filter(Boolean);
      const estoqueItems = await Promise.allSettled(
        ids.map((id: string) =>
          axios.get(`https://longviewempreendimentos.cvcrm.com.br/api/v1/cadastros/empreendimentos/${id}`,
            { params: { limite_dados_unidade: 1000 }, headers, timeout: 12000 }
          ).then(r => ({ id, data: r.data }))
        )
      );
      const estoqueMap: Record<string, any> = {};
      estoqueItems.forEach((r: any) => { if (r.status === 'fulfilled') estoqueMap[r.value.id] = r.value.data; });
      return { projects, estoque: estoqueMap };
    })() : Promise.resolve(null),
    !pgLeads ? fetchAllCRMLeads(CV_EMAIL, CV_TOKEN) : Promise.resolve(null),
  ]);

  if (needMetaLive && liveMetaResult.status === 'fulfilled' && liveMetaResult.value) {
    metaData = liveMetaResult.value;
    // Salva no cache em background (sem await)
    if (!isFiltered) {
      import('@/lib/pg').then(({ sql }) =>
        sql`INSERT INTO project_state (key, data) VALUES ('meta_cache', ${JSON.stringify({ data: metaData, updatedAt: new Date().toISOString() })})
            ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data`.catch(() => {})
      );
    }
  }

  if (needEstoqueLive && liveEstoqueResult.status === 'fulfilled' && liveEstoqueResult.value) {
    estoqueData = liveEstoqueResult.value as any;
    if (!isFiltered) {
      import('@/lib/pg').then(({ sql }) =>
        sql`INSERT INTO project_state (key, data) VALUES ('estoque_cache', ${JSON.stringify({ ...estoqueData, updatedAt: new Date().toISOString() })})
            ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data`.catch(() => {})
      );
    }
  }

  const leadsResult = pgLeads ?? (liveCRMLeads.status === 'fulfilled' ? liveCRMLeads.value : { leads: [], total: 0, crmTotal: 0 });

  const metaFinal = metaData ?? {
    global: null, campaigns: [], campaignDetails: [], adsets: [],
    demographics: [], regions: [], platforms: [], devices: [], daily: [],
    leadForms: [], page: null,
  };

  const META_TOKEN = process.env.META_TOKEN;
  const metaAuth = { access_token: META_TOKEN || '' };
  
  let metaValidation = { orphanedLeads: [] as any[], totalMetaLeads: 0, error: null as string | null };
  if (META_TOKEN && metaFinal.leadForms && metaFinal.leadForms.length > 0) {
    metaValidation = await fetchMetaOrphanedLeads(metaFinal.leadForms, metaAuth, 'v21.0');
  }

  return NextResponse.json({
    leads:     leadsResult,
    meta:      metaFinal,
    estoque:   estoqueData?.estoque ?? {},
    leadForms: metaFinal.leadForms,
    page:      metaFinal.page,
    metaValidation,
    updatedAt: new Date().toISOString(),
    _cached:   !needMetaLive && !needEstoqueLive && !!pgLeads,
  });
}
