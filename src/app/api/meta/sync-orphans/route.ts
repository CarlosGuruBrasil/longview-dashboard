import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { sql, ensureSchema } from '@/lib/pg';
import { createCrmLead } from '@/lib/cvcrm';

const JWT_SECRET = process.env.JWT_SECRET ?? (() => { throw new Error('[LongView] JWT_SECRET nao configurado. Defina no .env.local') })();
const META_BASE = 'https://graph.facebook.com/v21.0';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutos de timeout no serverless

type AuthUser = {
  role?: string;
  email?: string;
  name?: string;
  permissions?: {
    viewMarketingDashboard?: boolean;
  };
};

interface MetaFieldData {
  name: string;
  values: string[];
}

interface MetaLead {
  id: string;
  created_time: string;
  field_data: MetaFieldData[];
  campaign_name?: string;
  adset_name?: string;
  ad_name?: string;
  form_id?: string;
}

async function verifyAuth(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return null;
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
}

async function getPageAccessToken(systemUserToken: string): Promise<string> {
  const PAGE_ID = '259079394232614';
  try {
    const res = await axios.get(`${META_BASE}/${PAGE_ID}`, {
      params: { fields: 'access_token', access_token: systemUserToken },
      timeout: 10000,
    });
    return res.data?.access_token || systemUserToken;
  } catch {
    return systemUserToken;
  }
}

function getField(fields: MetaFieldData[], ...keys: string[]): string {
  for (const key of keys) {
    const searchKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    const found = fields.find(f => {
      if (!f.name) return false;
      const normalizedName = f.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return normalizedName === searchKey || normalizedName.includes(searchKey) || searchKey.includes(normalizedName);
    });
    if (found?.values?.[0]) return found.values[0].trim();
  }
  return '';
}

export async function POST(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const canSync =
    user.role === 'Desenvolvedor' ||
    user.role === 'Diretoria' ||
    user.role === 'Gestor';

  if (!canSync) {
    return NextResponse.json({ error: 'Sem permissão para forçar sincronização.' }, { status: 403 });
  }

  const metaToken = process.env.META_TOKEN;
  if (!metaToken) {
    return NextResponse.json({ error: 'Token do Meta Ads não configurado (META_TOKEN).' }, { status: 500 });
  }

  try {
    await ensureSchema();
    console.log('[sync-orphans] Obtendo Page Access Token...');
    const pageToken = await getPageAccessToken(metaToken);
    const PAGE_ID = '259079394232614';

    // 1. Buscar formulários ativos da página
    console.log('[sync-orphans] Buscando formulários do Facebook...');
    const formsRes = await axios.get(`${META_BASE}/${PAGE_ID}/leadgen_forms`, {
      params: { fields: 'id,name,status,leads_count', limit: 50, access_token: pageToken },
      timeout: 15000,
    });

    const activeForms = (formsRes.data?.data || []).filter(
      (f: any) => f.status === 'ACTIVE' && (f.leads_count ?? 0) > 0
    );

    if (activeForms.length === 0) {
      return NextResponse.json({ ok: true, message: 'Nenhum formulário ativo com leads encontrado.' });
    }

    // 2. Buscar os leads de cada formulário
    console.log(`[sync-orphans] Buscando leads de ${activeForms.length} formulários ativos...`);
    const metaLeads: (MetaLead & { formName: string })[] = [];

    const formsData = await Promise.allSettled(
      activeForms.map((f: any) =>
        axios.get(`${META_BASE}/${f.id}/leads`, {
          params: { fields: 'id,created_time,field_data,campaign_name,adset_name,ad_name,form_id', limit: 200, access_token: pageToken },
          timeout: 15000,
        }).then(r => ({ formName: f.name, leads: (r.data?.data || []) as MetaLead[] }))
      )
    );

    for (const res of formsData) {
      if (res.status === 'fulfilled') {
        const { formName, leads } = res.value;
        leads.forEach((l: MetaLead) => {
          metaLeads.push({ ...l, formName });
        });
      }
    }

    if (metaLeads.length === 0) {
      return NextResponse.json({ ok: true, message: 'Nenhum lead encontrado nas campanhas da Meta.' });
    }

    // 3. Buscar todos os leads locais no Postgres para fazer o cruzamento
    const dbLeads = await sql<{ email: string | null; telefone: string | null }[]>`
      SELECT email, telefone FROM leads
    `;
    const dbEmails = new Set(dbLeads.map(l => l.email?.toLowerCase().trim()).filter(Boolean));
    const dbPhones = new Set(dbLeads.map(l => l.telefone?.replace(/\D/g, '') ?? '').filter(Boolean));

    // 4. Filtrar quais leads da Meta são órfãos (não constam na base local)
    const orphans = metaLeads.filter(ml => {
      let email = '', phone = '';
      for (const fd of ml.field_data || []) {
        const key = (fd.name || '').toLowerCase();
        const val = fd.values?.[0] || '';
        if (key.includes('email')) email = val;
        else if (key.includes('phone') || key.includes('tel') || key.includes('cel')) phone = val;
      }

      const mEmail = email.toLowerCase().trim();
      const mPhone = phone.replace(/\D/g, '');

      if (mEmail && dbEmails.has(mEmail)) return false;
      if (mPhone) {
        const stripped = mPhone.replace(/^55/, '');
        if (dbPhones.has(mPhone) || dbPhones.has(stripped) || dbPhones.has('55' + mPhone)) return false;
      }
      return true;
    });

    console.log(`[sync-orphans] Cruzamento concluído. Encontrados ${orphans.length} leads órfãos no Meta Ads.`);

    let syncedCount = 0;
    const syncedLeadsList: any[] = [];

    // 5. Inserir retroativamente cada lead órfão no CRM e no Postgres local
    for (const o of orphans) {
      const fields = o.field_data || [];
      const nome = getField(fields, 'full_name', 'nome', 'name', 'first_name', 'completo');
      const sobrenome = getField(fields, 'last_name', 'sobrenome');
      const nomeCompleto = sobrenome ? `${nome} ${sobrenome}`.trim() : nome;
      const email = getField(fields, 'email', 'email_address', 'e-mail');
      const telefone = getField(fields, 'phone_number', 'telefone', 'phone', 'celular', 'whatsapp', 'tel');
      const empreendimento = getField(fields, 'empreendimento', 'produto', 'product', 'interest', 'interesse', 'lote', 'opcao');
      const mensagem = getField(fields, 'message', 'mensagem', 'observacao', 'comments');

      const campanha = o.campaign_name || '';
      const conjunto = o.adset_name || '';
      const midia = [campanha, conjunto].filter(Boolean).join(' › ');
      const origem = 'Meta Lead Ads';

      const parsed = {
        nome: nomeCompleto || email || 'Lead Meta Sincronizado',
        email,
        telefone,
        empreendimento,
        midia,
        origem,
      };

      // A. Cadastra no CV CRM
      const crmResult = await createCrmLead({
        nome: parsed.nome,
        email: email || undefined,
        telefone: telefone || undefined,
        origem,
        midia,
        empreendimento: empreendimento || undefined,
        mensagem: [
          mensagem ? `Mensagem: ${mensagem}` : '',
          `Sincronização Retroativa`,
          `Formulário: ${o.form_id || o.formName || '?'}`,
          `Anúncio: ${o.ad_name || o.id || '?'}`,
        ].filter(Boolean).join(' | ') || undefined,
      });

      // B. Salva no Postgres local
      const dbId = `meta_${o.id}`;
      const dCad = o.created_time ? new Date(o.created_time).toISOString() : new Date().toISOString();

      try {
        await sql`
          INSERT INTO leads (
            id, nome, email, telefone, origem, status,
            empreendimento, score, temperatura,
            data_cadastro, data_atualizacao, raw, synced_at
          ) VALUES (
            ${dbId},
            ${parsed.nome || null},
            ${parsed.email || null},
            ${parsed.telefone || null},
            ${parsed.origem},
            ${'Novo'},
            ${parsed.empreendimento || null},
            ${null}, ${null},
            ${dCad},
            ${new Date().toISOString()},
            ${JSON.stringify({ ...o, _source: 'sync_orphans', _parsed: parsed, _crm: crmResult })},
            NOW()
          )
          ON CONFLICT (id) DO UPDATE SET
            nome             = EXCLUDED.nome,
            email            = EXCLUDED.email,
            telefone         = EXCLUDED.telefone,
            origem           = EXCLUDED.origem,
            empreendimento   = EXCLUDED.empreendimento,
            data_atualizacao = EXCLUDED.data_atualizacao,
            raw              = EXCLUDED.raw,
            synced_at        = NOW()
        `;
        syncedCount++;
        syncedLeadsList.push({ id: o.id, nome: parsed.nome, email: parsed.email, formName: o.formName, crmId: crmResult.id ?? null });
      } catch (dbErr: any) {
        console.error(`[sync-orphans] Erro ao salvar no banco local lead ${o.id}:`, dbErr.message);
      }
    }

    return NextResponse.json({
      ok: true,
      total_meta_analisados: metaLeads.length,
      leads_orfaos_encontrados: orphans.length,
      leads_sincronizados: syncedCount,
      sincronizados: syncedLeadsList
    });

  } catch (err: any) {
    console.error('[sync-orphans] Erro geral na sincronização retroativa:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
