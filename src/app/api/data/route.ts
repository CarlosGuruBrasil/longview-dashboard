export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';
import type { AxiosResponse } from 'axios';
import jwt from 'jsonwebtoken';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import type { MetaData, MetaLeadForm, MetaPageInfo } from '@/app/marketing-vision/types';
import logger from '@/lib/logger'

const JWT_SECRET   = process.env.JWT_SECRET ?? (() => { throw new Error('[LongView] JWT_SECRET nao configurado. Defina no .env.local') })();
const META_PAGE_ID = '259079394232614';
// Cache nunca expira no caminho de leitura — cron ou ?refresh=true renovam.

type AuthUser = {
  role?: string;
  email?: string;
  name?: string;
  permissions?: {
    viewMarketingDashboard?: boolean;
    isAdmin?: boolean;
  };
};

type PgLeadRow = {
  id: string | number;
  idlead: unknown;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  celular: unknown;
  midia_principal: unknown;
  midia_visita: unknown;
  origem: unknown;
  status: string | null;
  situacao: unknown;
  empreendimento: unknown;
  corretor: unknown;
  gestor: unknown;
  imobiliaria: unknown;
  autor_ultima_alteracao: unknown;
  temperatura: string | null;
  score: number | null;
  valor_negocio: unknown;
  valor_venda: unknown;
  data_venda: unknown;
  qtde_reservas_associadas: unknown;
  qtde_simulacoes_associadas: unknown;
  motivo_cancelamento: unknown;
  cidade: unknown;
  tags: unknown;
  bolsao: unknown;
  data_cadastro: string | Date | null;
  data_atualizacao: string | Date | null;
};

type DashboardLead = Record<string, unknown> & {
  corretor?: unknown;
  gestor?: unknown;
};

type CRMRawLead = DashboardLead & {
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
  corretor?: unknown;
  gestor?: unknown;
  score?: string | number | null;
  temperatura?: string;
  temperatura_lead?: string;
  data_cadastro?: string;
  created_at?: string;
  createdAt?: string;
  data_atualizacao?: string;
  updated_at?: string;
  updatedAt?: string;
};

type CRMLeadsResponse = { leads?: CRMRawLead[]; total?: number };
type MetaApiList<T> = { data?: T[] };
type MetaCache = { data?: Partial<MetaData>; updatedAt?: string };
type LeadResult = { leads: DashboardLead[]; total: number; crmTotal: number };

function parseJsonValue<T = unknown>(value: unknown): T {
  let current = value;
  while (typeof current === 'string' && (current.trim().startsWith('{') || current.trim().startsWith('['))) {
    try {
      const parsed = JSON.parse(current);
      if (parsed === current) break;
      current = parsed;
    } catch {
      break;
    }
  }
  return current as T;
}

function stringOrNull(value: unknown): string | null {
  return value == null ? null : String(value);
}

function personFields(value: unknown): { email?: string; nome?: string } {
  return typeof value === 'object' && value !== null ? value as { email?: string; nome?: string } : {};
}

async function verifyAuth(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return null;
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch { return null; }
}

async function readPgCache<T = unknown>(key: string): Promise<T | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { sql, ensureSchema } = await import('@/lib/pg');
    await ensureSchema();
    const rows = await sql`SELECT data FROM project_state WHERE key = ${key} LIMIT 1`;
    if (!rows[0]) return null;
    return parseJsonValue(rows[0].data);
  } catch { return null; }
}

async function readLeadsFromPg(
  startDate?: string | null,
  endDate?: string | null,
  detailed = false,
  page = 1,
  limit = 50,
  search?: string | null
): Promise<LeadResult | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { sql, ensureSchema } = await import('@/lib/pg');
    await ensureSchema();
    const [countRow] = await sql<{ count: string }[]>`SELECT COUNT(*) AS count FROM leads`;
    const count = parseInt(countRow?.count ?? '0', 10);
    if (count === 0) return null;

    const pct = search ? `%${search.replace(/%/g, '\\%').replace(/_/g, '\\_')}%` : null;
    const searchCond = pct
      ? sql`AND (nome ILIKE ${pct} OR email ILIKE ${pct})`
      : sql``;

    const selectFields = sql`
      id,
      nome,
      email,
      telefone,
      origem,
      status,
      empreendimento,
      score,
      temperatura,
      data_cadastro,
      data_atualizacao,
      raw
    `;

    let rows: any[];
    if (startDate && endDate) {
      if (detailed) {
        rows = await sql`
          SELECT ${selectFields}
          FROM leads
          WHERE data_cadastro >= ${startDate}::date
            AND data_cadastro <  (${endDate}::date + INTERVAL '1 day')
            ${searchCond}
          ORDER BY data_cadastro DESC NULLS LAST
          LIMIT ${limit} OFFSET ${(page - 1) * limit}
        `;
      } else {
        // Modo dashboard: expande para trazer também o mês passado completo
        let adjustedStart = startDate;
        try {
          const d = new Date(startDate);
          d.setMonth(d.getMonth() - 1);
          d.setDate(1);
          adjustedStart = d.toISOString().split('T')[0];
        } catch (e) {}

        rows = await sql`
          SELECT ${selectFields}
          FROM leads
          WHERE data_cadastro >= ${adjustedStart}::date
            AND data_cadastro <  (${endDate}::date + INTERVAL '1 day')
          ORDER BY data_cadastro DESC NULLS LAST
          LIMIT 5000
        `;
      }
    } else if (startDate) {
      if (detailed) {
        rows = await sql`
          SELECT ${selectFields}
          FROM leads
          WHERE data_cadastro >= ${startDate}::date
            ${searchCond}
          ORDER BY data_cadastro DESC NULLS LAST
          LIMIT ${limit} OFFSET ${(page - 1) * limit}
        `;
      } else {
        // Modo dashboard: expande para trazer também o mês passado completo
        let adjustedStart = startDate;
        try {
          const d = new Date(startDate);
          d.setMonth(d.getMonth() - 1);
          d.setDate(1);
          adjustedStart = d.toISOString().split('T')[0];
        } catch (e) {}

        rows = await sql`
          SELECT ${selectFields}
          FROM leads
          WHERE data_cadastro >= ${adjustedStart}::date
          ORDER BY data_cadastro DESC NULLS LAST
          LIMIT 5000
        `;
      }
    } else if (endDate) {
      if (detailed) {
        rows = await sql`
          SELECT ${selectFields}
          FROM leads
          WHERE data_cadastro < (${endDate}::date + INTERVAL '1 day')
            ${searchCond}
          ORDER BY data_cadastro DESC NULLS LAST
          LIMIT ${limit} OFFSET ${(page - 1) * limit}
        `;
      } else {
        rows = await sql`
          SELECT ${selectFields}
          FROM leads
          WHERE data_cadastro < (${endDate}::date + INTERVAL '1 day')
          ORDER BY data_cadastro DESC NULLS LAST
          LIMIT 5000
        `;
      }
    } else {
      if (detailed) {
        rows = await sql`
          SELECT ${selectFields}
          FROM leads
          WHERE true ${searchCond}
          ORDER BY data_cadastro DESC NULLS LAST
          LIMIT ${limit} OFFSET ${(page - 1) * limit}
        `;
      } else {
        rows = await sql`
          SELECT ${selectFields}
          FROM leads
          ORDER BY data_cadastro DESC NULLS LAST
          LIMIT 5000
        `;
      }
    }

    const leads: DashboardLead[] = rows.map((r: any) => {
      let leadObj: any = {};
      try {
        let currentRaw = r.raw;
        while (typeof currentRaw === 'string') {
          currentRaw = JSON.parse(currentRaw);
        }
        leadObj = currentRaw || {};
      } catch (err) {
        // ignore parse errors
      }

      let empVal = leadObj.empreendimento || r.empreendimento || [];
      if (typeof empVal === 'string') {
        try { empVal = JSON.parse(empVal); } catch { empVal = [{ nome: empVal }]; }
      }
      if (!Array.isArray(empVal)) {
        empVal = typeof empVal === 'object' && empVal ? [empVal] : [];
      }

      let sitVal = leadObj.situacao || r.status || {};
      if (typeof sitVal === 'string') {
        try { sitVal = JSON.parse(sitVal); } catch { sitVal = { nome: sitVal }; }
      }

      const base: DashboardLead = {
        id: r.id,
        idlead: leadObj.idlead ?? r.id,
        midia_principal: leadObj.midia_principal ?? null,
        midia_visita: leadObj.midia_visita ?? null,
        origem: leadObj.origem ?? r.origem ?? 'Desconhecido',
        status: r.status || leadObj.situacao?.nome || 'Desconhecido',
        situacao: sitVal,
        empreendimento: empVal,
        corretor: leadObj.corretor || null,
        imobiliaria: leadObj.imobiliaria || null,
        temperatura: r.temperatura || leadObj.temperatura || null,
        score: r.score != null ? r.score : (leadObj.score != null ? Number(leadObj.score) : null),
        valor_negocio: leadObj.valor_negocio ?? null,
        valor_venda: leadObj.valor_venda ?? null,
        data_venda: leadObj.data_venda ?? null,
        cidade: leadObj.cidade ?? null,
        bolsao: leadObj.bolsao ?? null,
        data_cadastro: r.data_cadastro || leadObj.data_cad || leadObj.data_cadastro,
      };

      if (detailed) {
        base.nome = r.nome || leadObj.nome || undefined;
        base.email = r.email || leadObj.email || undefined;
        base.telefone = r.telefone || leadObj.telefone || undefined;
        base.celular = leadObj.celular ?? null;
        base.midia_visita = leadObj.midia_visita ?? null;
        base.gestor = leadObj.gestor || null;
        base.autor_ultima_alteracao = leadObj.autor_ultima_alteracao ?? null;
        base.qtde_reservas_associadas = leadObj.qtde_reservas_associadas ?? 0;
        base.qtde_simulacoes_associadas = leadObj.qtde_simulacoes_associadas ?? 0;
        base.motivo_cancelamento = leadObj.motivo_cancelamento || null;
        base.tags = leadObj.tags || [];
        base.data_atualizacao = r.data_atualizacao || leadObj.data_atualizacao;
      }

      return base;
    });

    let totalCount = count;
    if (startDate || endDate) {
      const [filterCountRow] = await sql<{ count: string }[]>`
        SELECT COUNT(*)::int AS count 
        FROM leads 
        WHERE 1=1 
          ${startDate ? sql`AND data_cadastro >= ${startDate}::date` : sql``}
          ${endDate ? sql`AND data_cadastro < (${endDate}::date + INTERVAL '1 day')` : sql``}
      `;
      totalCount = parseInt(filterCountRow?.count ?? '0', 10);
    }

    return { leads, total: leads.length, crmTotal: totalCount };
  } catch (e: unknown) {
    logger.warn({ err: e instanceof Error ? e.message : e }, '[/api/data] Postgres leads falhou:');
    return null;
  }
}

/**
 * Retorna dados analíticos pré-agregados via SQL — payload alvo < 5 KB.
 * Usado no modo ?aggregate=true para o carregamento inicial do dashboard.
 */
async function readLeadsSummaryFromPg(
  startDate?: string | null,
  endDate?: string | null
): Promise<import('@/app/marketing-vision/types').LeadSummary | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { sql, ensureSchema } = await import('@/lib/pg');
    await ensureSchema();

    const [countRow] = await sql<{ count: string }[]>`SELECT COUNT(*) AS count FROM leads`;
    const totalLeads = parseInt(countRow?.count ?? '0', 10);
    if (totalLeads === 0) return null;

    // Condição de data reutilizável
    const dateWhere = (startDate || endDate)
      ? sql`WHERE 1=1
          ${startDate ? sql`AND data_cadastro >= ${startDate}::date` : sql``}
          ${endDate   ? sql`AND data_cadastro < (${endDate}::date + INTERVAL '1 day')` : sql``}`
      : sql`WHERE 1=1`;

    const [filteredCountRow] = await sql<{ count: string }[]>`
      SELECT COUNT(*)::int AS count FROM leads ${dateWhere}
    `;
    const totalLeadsFiltered = parseInt(filteredCountRow?.count ?? '0', 10);

    // Agregações paralelas
    const [situacoes, origens, empreendimentos, corretores, monthly, weekly, sourceStatus, temperatura, scoreRow, bolsaoRow] =
      await Promise.all([
        sql<{ nome: string; total: number }[]>`
          SELECT status AS nome, COUNT(*)::int AS total
          FROM leads ${dateWhere}
          GROUP BY status ORDER BY total DESC LIMIT 20
        `,
        sql<{ origem: string; total: number }[]>`
          SELECT COALESCE(origem, 'Desconhecido') AS origem, COUNT(*)::int AS total
          FROM leads ${dateWhere}
          GROUP BY origem ORDER BY total DESC LIMIT 20
        `,
        sql<{ empreendimento: string; total: number }[]>`
          SELECT COALESCE(empreendimento, 'Não informado') AS empreendimento, COUNT(*)::int AS total
          FROM leads ${dateWhere}
          GROUP BY empreendimento ORDER BY total DESC LIMIT 15
        `,
        sql<{ corretor: string; total: number }[]>`
          SELECT
            COALESCE(raw->>'corretor', 'Sem corretor') AS corretor,
            COUNT(*)::int AS total
          FROM leads ${dateWhere}
          GROUP BY raw->>'corretor' ORDER BY total DESC LIMIT 10
        `,
        sql<{ mes: string; total: number }[]>`
          SELECT
            TO_CHAR(DATE_TRUNC('month', data_cadastro), 'YYYY-MM') AS mes,
            COUNT(*)::int AS total
          FROM leads
          WHERE data_cadastro IS NOT NULL
          ${startDate ? sql`AND data_cadastro >= ${startDate}::date` : sql``}
          ${endDate   ? sql`AND data_cadastro < (${endDate}::date + INTERVAL '1 day')` : sql``}
          GROUP BY DATE_TRUNC('month', data_cadastro)
          ORDER BY mes DESC LIMIT 24
        `,
        sql<{ semana: string; total: number; meta: number; portais: number; manual: number; outros: number }[]>`
          SELECT
            TO_CHAR(DATE_TRUNC('week', data_cadastro), 'YYYY-MM-DD') AS semana,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE origem IN ('Meta Lead Ads','Facebook','Remarketing','Social','Instagram','Mídia Paga'))::int AS meta,
            COUNT(*) FILTER (WHERE origem IN ('Busca Compartilhada','Busca Orgânica','Tráfego Direto','Referência','Contako'))::int AS portais,
            COUNT(*) FILTER (WHERE origem IN ('Painel Gestor','Painel Corretor','Painel PDV','Painel Cliente'))::int AS manual,
            COUNT(*) FILTER (WHERE origem NOT IN ('Meta Lead Ads','Facebook','Remarketing','Social','Instagram','Mídia Paga','Busca Compartilhada','Busca Orgânica','Tráfego Direto','Referência','Contako','Painel Gestor','Painel Corretor','Painel PDV','Painel Cliente') OR origem IS NULL)::int AS outros
          FROM leads
          WHERE data_cadastro >= NOW() - INTERVAL '16 weeks'
          GROUP BY DATE_TRUNC('week', data_cadastro)
          ORDER BY semana ASC
        `,
        sql<{ canal: string; total: number; ultimo_lead: string | null }[]>`
          SELECT
            CASE
              WHEN origem IN ('Meta Lead Ads','Facebook','Remarketing','Social','Instagram','Mídia Paga') THEN 'Meta / Paid'
              WHEN origem IN ('Busca Compartilhada') THEN 'Portais (Zap/OLX)'
              WHEN origem IN ('Busca Orgânica') THEN 'Google Orgânico'
              WHEN origem IN ('Tráfego Direto','Referência','Contako','Whatsapp') THEN 'Outros Digitais'
              WHEN origem IN ('Painel Gestor','Painel Corretor','Painel PDV','Painel Cliente') THEN 'Manual (CRM)'
              ELSE 'Não Definido'
            END AS canal,
            COUNT(*)::int AS total,
            MAX(data_cadastro)::text AS ultimo_lead
          FROM leads
          WHERE data_cadastro IS NOT NULL
          GROUP BY 1
          ORDER BY total DESC
        `,
        sql<{ temperatura: string; total: number }[]>`
          SELECT COALESCE(temperatura, 'Desconhecida') AS temperatura, COUNT(*)::int AS total
          FROM leads ${dateWhere}
          GROUP BY temperatura ORDER BY total DESC LIMIT 5
        `,
        sql<{ avg: string | null }[]>`
          SELECT AVG(score)::numeric(5,2) AS avg FROM leads ${dateWhere} WHERE score IS NOT NULL
        `,
        sql<{ pct: string }[]>`
          SELECT
            ROUND(100.0 * COUNT(*) FILTER (WHERE raw->>'bolsao' = 'true' OR raw->>'bolsao' = '1') / NULLIF(COUNT(*), 0), 1)::text AS pct
          FROM leads ${dateWhere}
        `,
      ]);

    return {
      totalLeads,
      totalLeadsFiltered,
      avgScore: scoreRow[0]?.avg != null ? parseFloat(scoreRow[0].avg) : null,
      pctBolsao: parseFloat(bolsaoRow[0]?.pct ?? '0'),
      bySituacao:         situacoes,
      byOrigem:           origens,
      byEmpreendimento:   empreendimentos,
      byCorretor:         corretores,
      monthly:            monthly.reverse(),
      weekly:             weekly,
      sourceStatus:       sourceStatus.map(r => {
        const ultimo = r.ultimo_lead ? new Date(r.ultimo_lead) : null;
        const diasSemLead = ultimo ? Math.floor((Date.now() - ultimo.getTime()) / 86400000) : null;
        return { canal: r.canal, total: r.total, ultimoLead: r.ultimo_lead, diasSemLead, ativo: diasSemLead !== null && diasSemLead <= 14 };
      }),
      topTemperatura:     temperatura,
    };
  } catch (e: unknown) {
    logger.warn({ err: e instanceof Error ? e.message : e }, '[/api/data] readLeadsSummaryFromPg falhou:');
    return null;
  }
}

async function readEstoqueFromPg() {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { sql, ensureSchema } = await import('@/lib/pg');
    await ensureSchema();
    const empreendimentos = await sql`
      SELECT id, nome, situacao, tipo,
        raw->>'cidade' AS cidade,
        raw->>'bairro' AS bairro,
        raw->>'estado' AS estado,
        raw->>'endereco' AS endereco,
        raw->>'regiao' AS regiao,
        raw->>'cep' AS cep,
        raw->>'sigla' AS sigla,
        raw->>'numero' AS numero,
        raw->>'data_entrega' AS data_entrega,
        (raw->>'andamento')::int AS andamento,
        raw->>'foto' AS foto,
        raw->>'logo' AS logo,
        (raw->>'latitude')::float AS latitude,
        (raw->>'longitude')::float AS longitude,
        raw->>'area_construida' AS area_construida,
        raw->>'area_privativa' AS area_privativa,
        raw->>'nome_empresa' AS nome_empresa,
        raw->>'periodo_venda_inicio' AS periodo_venda_inicio,
        raw->>'disponivel' AS disponivel,
        raw->>'link_disponibilidade' AS link_disponibilidade,
        raw->'segmento'->0->>'nome' AS segmento,
        raw->'situacao_obra'->0->>'nome' AS situacao_obra,
        raw->'tabela' AS tabela
      FROM cv_empreendimentos ORDER BY id
    `;
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
    const unidades = await sql`
      SELECT id, id_empreendimento, bloco, numero, status, status_venda, valor, metragem,
        (raw->>'andar')::int AS andar,
        (raw->>'coluna')::int AS coluna,
        raw->>'tipologia' AS tipologia,
        (raw->'situacao'->>'situacao_mapa_disponibilidade')::int AS situacao_mapa_disponibilidade
      FROM cv_unidades
    `;
    
    if (empreendimentos.length === 0) return null;
    return { empreendimentos, resumo, unidades };
  } catch(e: unknown) {
    logger.warn({ err: e instanceof Error ? e.message : e }, '[/api/data] Postgres estoque falhou:');
    return null;
  }
}

// Fallback: busca ao vivo do CRM (quando Postgres vazio)
async function fetchAllCRMLeads(email: string, token: string): Promise<{ leads: CRMRawLead[]; total: number; crmTotal: number }> {
  const headers = { email, token, Accept: 'application/json' };
  const base    = 'https://longviewempreendimentos.cvcrm.com.br/api/v1/comercial/leads';
  try {
    const initial = await axios.get<CRMLeadsResponse>(base, { params: { limit: 1 }, headers, timeout: 8000 });
    const maxLeads   = initial.data.total || 0;
    const limit      = 500;
    const totalPages = Math.ceil(maxLeads / limit);
    const results = await Promise.allSettled(
      Array.from({ length: totalPages }, (_, i) =>
        axios.get<CRMLeadsResponse>(base, { params: { limit, offset: i * limit }, headers, timeout: 12000 })
      )
    );
    const allLeads = results.flatMap(r => r.status === 'fulfilled' ? r.value.data.leads ?? [] : []);
    return { leads: allLeads, total: allLeads.length, crmTotal: initial.data.total || allLeads.length };
  } catch (err: unknown) {
    logger.warn({ err: err instanceof Error ? err.message : err }, '[/api/data] CRM leads falhou:');
    return { leads: [], total: 0, crmTotal: 0 };
  }
}

// Fallback: busca empreendimentos ao vivo do CRM e persiste no Postgres
async function fetchCRMEmpreendimentos(): Promise<{ empreendimentos: unknown[]; resumo: unknown[]; unidades: unknown[] } | null> {
  const email = process.env.CV_CRM_EMAIL;
  const token = process.env.CV_CRM_TOKEN;
  if (!email || !token) return null;
  const headers = { email, token, Accept: 'application/json' };

  try {
    const { sql, ensureSchema } = await import('@/lib/pg');
    await ensureSchema();

    logger.info('[fetchCRMEmpreendimentos] Iniciando fallback...');
    const projRes = await axios.get('https://longviewempreendimentos.cvcrm.com.br/api/v1/cadastros/empreendimentos', { headers, timeout: 20000 });
    const projects = Array.isArray(projRes.data) ? projRes.data : [];
    logger.info(`[fetchCRMEmpreendimentos] $ projetos recebidos do CRM`);
    const validProjects = projects.filter((p: Record<string, unknown>) => {
      const te = (p.tipo_empreendimento as { nome?: string }[] | undefined);
      const sc = (p.situacao_comercial as { nome?: string }[] | undefined);
      return te?.[0]?.nome !== null && sc?.[0]?.nome !== null;
    });

    const empreendimentos: { id: number; nome: string; situacao: string; tipo: string }[] = [];
    const unidades: { id: number; id_empreendimento: number; bloco: string; numero: string; status: string; valor: number; metragem: number; andar: number | null; coluna: number | null; tipologia: string; situacao_mapa_disponibilidade: number | null }[] = [];

    for (const raw of validProjects) {
      const p = raw as Record<string, unknown>;
      const idEmp = Number(p.idempreendimento);
      if (!idEmp) continue;

      const te = (p.tipo_empreendimento as { nome?: string }[] | undefined);
      const sc = (p.situacao_comercial as { nome?: string }[] | undefined);
      const nome = String(p.nome || p.empreendimento || '');
      const situacao = String(sc?.[0]?.nome || '');
      const tipo = String(te?.[0]?.nome || '');

      empreendimentos.push({ id: idEmp, nome, situacao, tipo });

      // Upsert into Postgres for persistence
      await sql`
        INSERT INTO cv_empreendimentos (id, nome, situacao, tipo, raw, synced_at)
        VALUES (${idEmp}, ${nome}, ${situacao}, ${tipo}, ${p as never}, NOW())
        ON CONFLICT (id) DO UPDATE SET
          nome = EXCLUDED.nome, situacao = EXCLUDED.situacao, tipo = EXCLUDED.tipo,
          raw = EXCLUDED.raw, synced_at = EXCLUDED.synced_at
      `;
      await sql`DELETE FROM cv_unidades WHERE id_empreendimento = ${idEmp}`;

      try {
        const detRes = await axios.get(`https://longviewempreendimentos.cvcrm.com.br/api/v1/cadastros/empreendimentos/${idEmp}`, {
          params: { limite_dados_unidade: 1000 }, headers, timeout: 20000
        });
        const rawData = detRes.data as { etapas?: { blocos?: { nome?: string; unidades?: Record<string, unknown>[] }[] }[] };
        const rawUnidades: Record<string, unknown>[] = [];

        if (Array.isArray(rawData?.etapas)) {
          for (const etapa of rawData.etapas) {
            if (Array.isArray(etapa.blocos)) {
              for (const bloco of etapa.blocos) {
                if (Array.isArray(bloco.unidades)) {
                  for (const uni of bloco.unidades) {
                    uni._bloco_nome = bloco.nome;
                    rawUnidades.push(uni);
                  }
                }
              }
            }
          }
        }

        for (const uni of rawUnidades) {
          const idUni = Number(uni.idunidade);
          if (!idUni) continue;

          const sitObj = (uni.situacao || {}) as Record<string, unknown>;
          const statusVenda = Number(sitObj.situacao_para_venda ?? 0);
          let statusText = 'Desconhecido';
          if (statusVenda === 1) statusText = 'Disponivel';
          else if (statusVenda === 2 || statusVenda === 5 || sitObj.reservada != null) statusText = 'Reservado';
          else if (statusVenda === 3 || sitObj.vendida != null || sitObj.vendida_idsituacao === 3) statusText = 'Vendido';

          const valor = parseFloat(String(uni.valor)) || 0;
          const metragem = parseFloat(String(uni.metragem_real)) || 0;
          const blocoNome = String(uni._bloco_nome || '');
          const num = String(uni.nome || '');
          const andar = uni.andar ? parseInt(String(uni.andar), 10) : null;
          const coluna = uni.coluna ? parseInt(String(uni.coluna), 10) : null;
          const tipologia = String(uni.tipologia ?? uni.tipo ?? '');
          const situacao_mapa_disponibilidade = (sitObj.situacao_mapa_disponibilidade != null) ? Number(sitObj.situacao_mapa_disponibilidade) : null;

          unidades.push({ id: idUni, id_empreendimento: idEmp, bloco: blocoNome, numero: num, status: statusText, valor, metragem, andar, coluna, tipologia, situacao_mapa_disponibilidade });

          // andar/coluna/tipologia ficam só no raw — as colunas não existem no banco
          // de produção (usuário sem permissão de ALTER) e a leitura já usa raw->>.
          await sql`
            INSERT INTO cv_unidades (id, id_empreendimento, bloco, numero, status, status_venda, valor, metragem, raw, synced_at)
            VALUES (${idUni}, ${idEmp}, ${blocoNome}, ${num}, ${statusText}, ${statusVenda},
              ${valor}, ${metragem}, ${uni as never}, NOW())
            ON CONFLICT (id) DO UPDATE SET
              id_empreendimento = EXCLUDED.id_empreendimento, bloco = EXCLUDED.bloco,
              numero = EXCLUDED.numero, status = EXCLUDED.status, status_venda = EXCLUDED.status_venda,
              valor = EXCLUDED.valor, metragem = EXCLUDED.metragem, raw = EXCLUDED.raw, synced_at = EXCLUDED.synced_at
          `;
        }
      } catch (detErr: unknown) {
        logger.warn({ err: detErr instanceof Error ? detErr.message : detErr }, '[/api/data] Detalhes emp $ falhou:');
      }
    }

    // Build resumo aggregated from collected unidades
    const resumoMap = new Map<number, { total: number; disponivel: number; reservado: number; vendido: number; vgv_disponivel: number; vgv_vendido: number }>();
    for (const u of unidades) {
      let r = resumoMap.get(u.id_empreendimento);
      if (!r) { r = { total: 0, disponivel: 0, reservado: 0, vendido: 0, vgv_disponivel: 0, vgv_vendido: 0 }; resumoMap.set(u.id_empreendimento, r); }
      r.total++;
      if (u.status === 'Disponivel') { r.disponivel++; r.vgv_disponivel += u.valor; }
      else if (u.status === 'Reservado') { r.reservado++; r.vgv_vendido += u.valor; }
      else if (u.status === 'Vendido') { r.vendido++; r.vgv_vendido += u.valor; }
    }
    const resumo = Array.from(resumoMap.entries()).map(([id_empreendimento, v]) => ({ id_empreendimento, ...v }));

    logger.info(`[fetchCRMEmpreendimentos] Retornando $ emp, $ unid ($ projetos válidos de $)`);
    return { empreendimentos, resumo, unidades };
  } catch (e: unknown) {
    logger.warn({ err: e instanceof Error ? e.message : e }, '[/api/data] CRM empreendimentos falhou:');
    return null;
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
      axios.get<MetaApiList<unknown>>(`${metaBase}/insights`, { params: { level: 'account', fields: 'spend,impressions,clicks,reach,frequency,cpc,cpm,ctr,cpp,actions,cost_per_action_type', ...timeParams, ...metaAuth }, timeout: 15000 }),
      axios.get<MetaApiList<unknown>>(`${metaBase}/insights`, { params: { level: 'campaign', fields: 'campaign_id,campaign_name,spend,impressions,clicks,reach,frequency,cpc,cpm,ctr,actions,cost_per_action_type,date_start,date_stop', ...timeParams, limit: 500, ...metaAuth }, timeout: 15000 }),
      axios.get<MetaApiList<unknown>>(`${metaBase}/campaigns`, { params: { fields: 'id,name,created_time,start_time,stop_time,status,objective,buying_type,daily_budget,lifetime_budget,spend_cap', limit: 1000, ...metaAuth }, timeout: 15000 }),
      axios.get<MetaApiList<unknown>>(`${metaBase}/insights`, { params: { level: 'adset', fields: 'campaign_id,campaign_name,adset_id,adset_name,spend,impressions,clicks,reach,cpc,cpm,ctr,actions,cost_per_action_type', ...timeParams, limit: 500, ...metaAuth }, timeout: 15000 }),
      axios.get<MetaApiList<unknown>>(`${metaBase}/insights`, { params: { level: 'account', fields: 'clicks,impressions,spend,reach', breakdowns: 'gender,age', ...timeParams, ...metaAuth }, timeout: 15000 }),
      axios.get<MetaApiList<unknown>>(`${metaBase}/insights`, { params: { level: 'account', fields: 'clicks,impressions,spend,reach', breakdowns: 'region', ...timeParams, ...metaAuth }, timeout: 15000 }),
      axios.get<MetaApiList<unknown>>(`${metaBase}/insights`, { params: { level: 'account', fields: 'clicks,impressions,spend,reach', breakdowns: 'publisher_platform', ...timeParams, ...metaAuth }, timeout: 15000 }),
      axios.get<MetaApiList<unknown>>(`${metaBase}/insights`, { params: { level: 'account', fields: 'clicks,impressions,spend,reach', breakdowns: 'device_platform', ...timeParams, ...metaAuth }, timeout: 15000 }),
      axios.get<MetaApiList<unknown>>(`${metaBase}/insights`, { params: { level: 'account', fields: 'spend,impressions,clicks,reach,actions', time_increment: 1, ...(startDate || endDate ? timeParams : { date_preset: 'last_30d' }), limit: 90, ...metaAuth }, timeout: 15000 }),
      axios.get<MetaApiList<MetaLeadForm>>(`https://graph.facebook.com/${META_API_VERSION}/${META_PAGE_ID}/leadgen_forms`, { params: { fields: 'id,name,status,leads_count,created_time', limit: 50, ...metaAuth }, timeout: 10000 }),
      axios.get<MetaPageInfo>(`https://graph.facebook.com/${META_API_VERSION}/${META_PAGE_ID}`, { params: { fields: 'id,name,fan_count,followers_count,instagram_business_account', ...metaAuth }, timeout: 8000 }),
    ]);

  const get = <T>(r: PromiseSettledResult<AxiosResponse<T>>) => r.status === 'fulfilled' ? r.value.data : null;

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
  leadForms: unknown[],
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
      logger.info(`[meta-validation] $ formulários ativos`);
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
      logger.error({ msg }, '[meta-validation] erro:');
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
  const syncForce    = searchParams.get('sync') === 'true';
  const validateMeta = searchParams.get('validateMeta') === 'true';
  const page         = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit        = Math.max(1, Math.min(500, parseInt(searchParams.get('limit') || '50', 10)));
  const detailed     = searchParams.get('detailed') === 'true';
  const aggregate    = searchParams.get('aggregate') === 'true';
  const search       = searchParams.get('search') || null;

  // ── Modo agregado (payload leve — substituição do array bruto de leads) ──────
  // ?aggregate=true → retorna dados pré-calculados por SQL em vez do array de leads.
  // Payload esperado: < 5 KB (vs ~8 MB no modo padrão com 5000 leads).
  if (aggregate && !syncForce && !forceRefresh) {
    const [summary, pgEstoque, metaCache] = await Promise.all([
      readLeadsSummaryFromPg(startDate, endDate),
      readEstoqueFromPg(),
      readPgCache<MetaCache>('meta_cache'),
    ]);

    type MetaDataShape = { leadForms?: unknown[]; page?: unknown; [k: string]: unknown };
    const metaData: MetaDataShape | null = metaCache?.data ? metaCache.data as MetaDataShape : null;
    const metaFinal = metaData ?? {
      global: null, campaigns: [], campaignDetails: [], adsets: [],
      demographics: [], regions: [], platforms: [], devices: [], daily: [],
      leadForms: [], page: null,
    };

    return NextResponse.json({
      aggregate:    true,
      leadSummary:  summary,
      meta:         metaFinal,
      estoque:      pgEstoque ?? { empreendimentos: [], resumo: [], unidades: [] },
      leadForms:    metaFinal.leadForms,
      page:         metaFinal.page,
      updatedAt:    new Date().toISOString(),
      _cached:      !!metaCache,
    });
  }

  if (syncForce || forceRefresh) {
    const canForceSync = authUser.role === 'Desenvolvedor' || authUser.permissions?.isAdmin === true || authUser.role === 'Gestor' || authUser.role === 'Diretoria';
    if (!canForceSync) {
      return NextResponse.json({ error: 'Apenas administradores, gestores ou diretoria podem atualizar os dados.' }, { status: 403 });
    }

    try {
      const email = process.env.CV_CRM_EMAIL;
      const token = process.env.CV_CRM_TOKEN;
      if (email && token) {
        logger.info('[api/data] Sincronização forçada iniciada...');
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
              const origem = stringOrNull(lead.origem || lead.source);
              const status = (lead.situacao as { nome?: string } | undefined)?.nome || lead.status || null;
              const empreend = typeof lead.empreendimento === 'object'
                ? lead.empreendimento.nome ?? null
                : lead.empreendimento ?? null;
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
                  raw              = EXCLUDED.raw,
                  synced_at        = EXCLUDED.synced_at
              `;
              upserted++;
            }
          }
          logger.info(`[api/data] Sincronização forçada concluída. $ leads atualizados.`);
        }
      }
    } catch (e: unknown) {
      logger.error({ err: e instanceof Error ? e.message : e }, '[api/data] Erro na sincronização forçada:');
    }
  }

  const [pgLeads, metaCache, pgEstoque] = await Promise.all([
    readLeadsFromPg(startDate, endDate, detailed, page, limit, search),
    readPgCache<MetaCache>('meta_cache'),
    readEstoqueFromPg(),
  ]);

  // Se estoque vazio, busca ao vivo do CRM e persiste
  if (!pgEstoque) logger.info('[/api/data] pgEstoque vazio — tentando fallback CRM');
  const estoque = pgEstoque ?? (await fetchCRMEmpreendimentos()) ?? { empreendimentos: [], resumo: [], unidades: [] };
  logger.info(`[/api/data] estoque: $ emp, $ unid`);

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

  // Se o usuário selecionou datas específicas no dashboard, precisamos buscar
  // os dados do Meta ao vivo para esse período específico para os números baterem exato!
  const isFiltered = !!startDate || !!endDate;
  const needMetaLive = forceRefresh || !metaData || cacheStale || isFiltered;
  logger.warn({ err: metaData, ageMin: Math.round(cacheAgeMin) }, 'meta_cache stale — buscando ao vivo');

  const CV_EMAIL = process.env.CV_CRM_EMAIL || '';
  const CV_TOKEN = process.env.CV_CRM_TOKEN || '';

  const [liveMetaResult, liveCRMLeads] = await Promise.allSettled([
    needMetaLive ? fetchMetaLive(startDate, endDate) : Promise.resolve(null),
    !pgLeads ? fetchAllCRMLeads(CV_EMAIL, CV_TOKEN) : Promise.resolve(null),
  ]);

  if (needMetaLive && liveMetaResult.status === 'fulfilled' && liveMetaResult.value) {
    metaData = liveMetaResult.value as MetaDataShape;
    // Só persiste no banco se NÃO for um filtro temporário de período
    if (!isFiltered) {
      import('@/lib/pg').then(({ sql }) =>
        sql`INSERT INTO project_state (key, data) VALUES ('meta_cache', ${{ data: metaData, updatedAt: new Date().toISOString() } as never})
            ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data`.catch(() => logger.warn('[api/data] meta_cache persist falhou'))
      );
    }
  }

  const leadsResultRaw: LeadResult = (pgLeads ?? (liveCRMLeads.status === 'fulfilled' ? liveCRMLeads.value : null)) ?? { leads: [], total: 0, crmTotal: 0 };

  // ── Escopo por papel ────────────────────────────────────────────────────────
  // Gestor / Diretoria / Desenvolvedor veem tudo. Demais veem só os leads
  // ligados a eles (corretor.email ou gestor.email == email do usuário).
  // Filtro no servidor — não envia leads de terceiros pro navegador.
  const PRIVILEGED = ['Gestor', 'Diretoria', 'Desenvolvedor'];
  let leadsResult: LeadResult = leadsResultRaw;
  if (!PRIVILEGED.includes(authUser.role ?? '')) {
    const myEmail = String(authUser.email || '').toLowerCase().trim();
    const myName  = String(authUser.name  || '').toLowerCase().trim();
    const mine = leadsResultRaw.leads.filter(l => {
      const corretor = personFields(l.corretor);
      const gestor = personFields(l.gestor);
      const emails = [corretor.email, gestor.email].flatMap((e) => e ? [e.toLowerCase().trim()] : []);
      if (myEmail && emails.includes(myEmail)) return true;
      const names = [corretor.nome, gestor.nome].flatMap((n) => n ? [n.toLowerCase().trim()] : []);
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
    estoque,
    leadForms: metaFinal.leadForms,
    page:      metaFinal.page,
    metaValidation,
    updatedAt: new Date().toISOString(),
    _cached:   !needMetaLive && !!pgLeads,
  });
}
