/**
 * /api/cron/sync-leads
 *
 * Sincroniza TODOS os leads do CV CRM para a tabela `leads` no Postgres.
 * Remove o limite de 3000 que existe na rota /api/data (que serve dados ao vivo).
 *
 * Rodar a cada 2h via Coolify scheduled tasks:
 *   GET /api/cron/sync-leads  Authorization: Bearer <CRON_SECRET>
 */
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { sql, ensureSchema } from '@/lib/pg';
import { parseCrmDate } from '@/lib/dateUtils';
import logger from '@/lib/logger'

type CrmLead = Record<string, unknown> & {
  idlead?: string | number;
  id?: string | number;
  nome?: string;
  name?: string;
  email?: string;
  telefone?: string;
  celular?: string;
  phone?: string;
  origem?: unknown;
  source?: unknown;
  status?: string;
  empreendimento?: { nome?: string } | string;
  score?: string | number | null;
  temperatura?: string;
  temperatura_lead?: string;
  data_cad?: string;
  data_cadastro?: string;
  created_at?: string;
  createdAt?: string;
  data_atualizacao?: string;
  updated_at?: string;
  updatedAt?: string;
};

type CrmLeadResponse = {
  total?: number;
  leads?: CrmLead[];
};

function isCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const auth   = request.headers.get('Authorization') || '';
  if (!secret) return false; // fail-safe: exige CRON_SECRET em produção
  return auth === `Bearer ${secret}`;
}

function scalar(value: unknown): string | number | boolean | null {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return value == null ? null : String(value);
}

function errorMessage(error: unknown): string {
  return axios.isAxiosError(error) ? error.message : error instanceof Error ? error.message : String(error);
}

async function fetchAllLeadsFromCRM(email: string, token: string): Promise<{ leads: CrmLead[]; total: number }> {
  const base    = 'https://longviewempreendimentos.cvcrm.com.br/api/v1/comercial/leads';
  const headers = { email, token, Accept: 'application/json' };
  const limit   = 500;

  const initial = await axios.get<CrmLeadResponse>(base, { params: { limit: 1 }, headers, timeout: 10000 });
  const totalInCRM = initial.data.total || 0;
  const totalPages = Math.ceil(totalInCRM / limit);

  const pages = await Promise.allSettled(
    Array.from({ length: totalPages }, (_, i) =>
      axios.get<CrmLeadResponse>(base, { params: { limit, offset: i * limit }, headers, timeout: 20000 })
    )
  );

  const leads = pages
    .flatMap((r) => r.status === 'fulfilled' ? r.value.data?.leads || [] : []);

  return { leads, total: totalInCRM };
}

function parseDate(val: string | null | undefined): string | null {
  const d = parseCrmDate(val);
  return d ? d.toISOString() : null;
}

export async function GET(request: NextRequest) {
  if (!isCron(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL não configurada — Postgres necessário' }, { status: 503 });
  }

  const email = process.env.CV_CRM_EMAIL;
  const token = process.env.CV_CRM_TOKEN;
  if (!email || !token) {
    return NextResponse.json({ error: 'CV_CRM_EMAIL ou CV_CRM_TOKEN não configurados' }, { status: 503 });
  }

  const startedAt = new Date().toISOString();

  try {
    await ensureSchema();

    const { leads, total } = await fetchAllLeadsFromCRM(email, token);

    let upserted = 0;
    // Batch upsert em grupos de 100 para não estourar o statement size
    const BATCH = 100;
    for (let i = 0; i < leads.length; i += BATCH) {
      const batch = leads.slice(i, i + BATCH);
      for (const lead of batch) {
        const id           = String(lead.idlead ?? lead.id ?? '');
        if (!id) continue;

        const nome         = lead.nome || lead.name || null;
        const email_lead   = lead.email || null;
        const telefone     = lead.telefone || lead.celular || lead.phone || null;
        const origem       = typeof lead.origem === 'object' && lead.origem !== null
          ? (lead.origem as { nome?: string }).nome || null
          : scalar(lead.origem || lead.source);
        const status       = (typeof lead.situacao === 'object' && lead.situacao !== null
          ? (lead.situacao as { nome?: string }).nome
          : lead.status) || null;
        const empreend     = Array.isArray(lead.empreendimento)
          ? (lead.empreendimento as { nome?: string }[]).map(e => e?.nome).filter(Boolean).join(', ') || null
          : typeof lead.empreendimento === 'object' && lead.empreendimento
            ? (lead.empreendimento as { nome?: string }).nome || null
            : (lead.empreendimento as string) || null;
        const score        = lead.score != null ? Number(lead.score) : null;
        const temperatura  = lead.temperatura || lead.temperatura_lead || null;
        const dataCad      = parseDate(lead.data_cad || lead.data_cadastro || lead.created_at || lead.createdAt);
        const dataAtual    = parseDate(lead.data_atualizacao || lead.updated_at || lead.updatedAt);

        await sql`
          INSERT INTO leads
            (id, nome, email, telefone, origem, status, empreendimento,
             score, temperatura, data_cadastro, data_atualizacao, raw, synced_at)
          VALUES
            (${id}, ${nome}, ${email_lead}, ${telefone}, ${origem}, ${status},
             ${empreend}, ${score}, ${temperatura}, ${dataCad}, ${dataAtual},
             ${lead as never}, NOW())
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
            raw              = CASE
              WHEN leads.raw ? '_meta'
              THEN EXCLUDED.raw || jsonb_build_object('_meta', leads.raw->'_meta')
              ELSE EXCLUDED.raw
            END,
            synced_at        = EXCLUDED.synced_at
        `;
        upserted++;
      }
    }

    const result = { ok: true, startedAt, finishedAt: new Date().toISOString(), totalInCRM: total, upserted };
    logger.info({ result }, '[cron/sync-leads]');
    return NextResponse.json(result);

  } catch (err: unknown) {
    const message = errorMessage(err);
    logger.error({ message }, '[cron/sync-leads] Erro:');
    return NextResponse.json({ ok: false, startedAt, error: message }, { status: 500 });
  }
}
