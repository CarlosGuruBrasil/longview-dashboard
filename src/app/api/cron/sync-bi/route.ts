import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/pg';
import { isCronAuthorized, unauthorizedJson } from '@/lib/internal-auth';
import axios from 'axios';

export const maxDuration = 300;
export const runtime = 'nodejs';

async function upsertDimTempo(): Promise<number> {
  const result = await sql`
    INSERT INTO dim_tempo (id_data, data, dia, mes, ano, nome_mes, trimestre, dia_semana, nome_dia_semana, fim_de_semana)
    SELECT
      to_char(d, 'YYYYMMDD')::int AS id_data,
      d::date AS data,
      EXTRACT(DAY FROM d)::int AS dia,
      EXTRACT(MONTH FROM d)::int AS mes,
      EXTRACT(YEAR FROM d)::int AS ano,
      to_char(d, 'TMMonth') AS nome_mes,
      EXTRACT(QUARTER FROM d)::int AS trimestre,
      EXTRACT(DOW FROM d)::int AS dia_semana,
      to_char(d, 'TMDay') AS nome_dia_semana,
      EXTRACT(DOW FROM d) IN (0, 6) AS fim_de_semana
    FROM generate_series(
      '2020-01-01'::date,
      CURRENT_DATE + INTERVAL '1 year',
      '1 day'::interval
    ) AS d
    ON CONFLICT (id_data) DO NOTHING
  `;
  return result.count ?? 0;
}

async function upsertDimEmpreendimentos(): Promise<number> {
  const rows = await sql`
    INSERT INTO dim_empreendimentos (id_empreendimento, nome, situacao, tipo, cidade, estado, regiao, segmento, situacao_obra, ativo)
    SELECT
      id,
      nome,
      situacao,
      tipo,
      raw->>'cidade' AS cidade,
      raw->>'estado' AS estado,
      raw->>'regiao' AS regiao,
      raw->'segmento'->0->>'nome' AS segmento,
      raw->'situacao_obra'->0->>'nome' AS situacao_obra,
      true AS ativo
    FROM cv_empreendimentos
    ON CONFLICT (id_empreendimento) DO UPDATE SET
      nome = EXCLUDED.nome,
      situacao = EXCLUDED.situacao,
      tipo = EXCLUDED.tipo,
      cidade = EXCLUDED.cidade,
      estado = EXCLUDED.estado,
      regiao = EXCLUDED.regiao,
      segmento = EXCLUDED.segmento,
      situacao_obra = EXCLUDED.situacao_obra,
      ativo = true
  `;
  return rows.count ?? 0;
}

async function upsertDimCampanhasMeta(): Promise<number> {
  const email = process.env.CV_CRM_EMAIL;
  const token = process.env.CV_CRM_TOKEN;
  if (!email || !token) return 0;

  try {
    const rows = await sql`
      INSERT INTO dim_campanhas_meta (id_campanha, nome)
      SELECT DISTINCT
        COALESCE(NULLIF(midia_principal, ''), 'unknown'),
        COALESCE(NULLIF(midia_principal, ''), 'Desconhecida')
      FROM leads
      WHERE midia_principal IS NOT NULL AND midia_principal != ''
      ON CONFLICT (id_campanha) DO NOTHING
    `;
    return rows.count ?? 0;
  } catch {
    return 0;
  }
}

async function upsertFatoLeads(): Promise<number> {
  await sql`DELETE FROM fato_leads`;

  const result = await sql`
    INSERT INTO fato_leads (
      id_lead, id_empreendimento, data_cadastro, data_venda,
      origem, midia, campanha, status, temperatura, score, valor_venda,
      tempo_conversao_dias, raw
    )
    SELECT
      l.id AS id_lead,
      de.id_empreendimento,
      l.data_cadastro::date AS data_cadastro,
      v.data_venda::date AS data_venda,
      l.origem,
      l.raw->>'midia_principal' AS midia,
      l.raw->>'midia_principal' AS campanha,
      l.status,
      l.temperatura,
      l.score,
      v.valor AS valor_venda,
      CASE
        WHEN v.data_venda IS NOT NULL AND l.data_cadastro IS NOT NULL
        THEN (v.data_venda::date - l.data_cadastro::date)
        ELSE NULL
      END AS tempo_conversao_dias,
      l.raw
    FROM leads l
    LEFT JOIN cv_vendas v ON v.id::text = (l.raw->>'idvenda')
    LEFT JOIN dim_empreendimentos de ON lower(de.nome) = lower(l.empreendimento)
    WHERE l.data_cadastro IS NOT NULL
    ON CONFLICT DO NOTHING
  `;
  return result.count ?? 0;
}

async function upsertFatoVendas(): Promise<number> {
  await sql`DELETE FROM fato_vendas`;

  const result = await sql`
    INSERT INTO fato_vendas (id_venda, id_empreendimento, id_unidade, data_venda, valor, status)
    SELECT
      v.id AS id_venda,
      v.id_empreendimento,
      v.id_unidade,
      v.data_venda::date AS data_venda,
      v.valor,
      v.status
    FROM cv_vendas v
    WHERE v.data_venda IS NOT NULL
    ON CONFLICT (id_venda) DO UPDATE SET
      id_empreendimento = EXCLUDED.id_empreendimento,
      id_unidade = EXCLUDED.id_unidade,
      data_venda = EXCLUDED.data_venda,
      valor = EXCLUDED.valor,
      status = EXCLUDED.status
  `;
  return result.count ?? 0;
}

async function upsertFatoInteracoes(): Promise<number> {
  await sql`DELETE FROM fato_interacoes`;

  const result = await sql`
    INSERT INTO fato_interacoes (id_lead, lead_nome, de, para, autor, changed_at)
    SELECT
      h.lead_id AS id_lead,
      h.lead_nome,
      h.de,
      h.para,
      h.autor,
      h.changed_at
    FROM lead_stage_history h
    ON CONFLICT DO NOTHING
  `;
  return result.count ?? 0;
}

async function upsertFatoMidiaPaga(): Promise<number> {
  await sql`DELETE FROM fato_midia_paga`;

  const metaToken = process.env.META_TOKEN;
  const actId     = process.env.META_ACT_ID;
  if (!metaToken || !actId) return 0;

  try {
    // Busca insights por campanha, por dia, últimos 90 dias
    const res = await axios.get(`https://graph.facebook.com/v21.0/${actId}/insights`, {
      params: {
        level:         'campaign',
        fields:        'campaign_id,campaign_name,spend,impressions,clicks,reach,frequency,cpc,cpm,ctr,actions',
        date_preset:   'last_90d',
        time_increment: 1,
        limit:         500,
        access_token:  metaToken,
      },
      timeout: 30000,
    });

    type InsightRow = {
      campaign_id: string; campaign_name: string;
      date_start: string; spend: string; impressions: string;
      clicks: string; reach: string; frequency: string;
      cpc: string; cpm: string; ctr: string;
      actions?: { action_type: string; value: string }[];
    };

    const rows: InsightRow[] = res.data?.data ?? [];
    if (rows.length === 0) return 0;

    // Garante que as campanhas existam na dim
    const campaignNames = [...new Set(rows.map(r => ({ id: r.campaign_id, nome: r.campaign_name })))];
    for (const c of campaignNames) {
      await sql`
        INSERT INTO dim_campanhas_meta (id_campanha, nome)
        VALUES (${c.id}, ${c.nome})
        ON CONFLICT (id_campanha) DO UPDATE SET nome = EXCLUDED.nome
      `;
    }

    let inserted = 0;
    for (const r of rows) {
      const leadsAction = r.actions?.find(a => a.action_type === 'lead')?.value ?? '0';
      await sql`
        INSERT INTO fato_midia_paga (id_campanha, data, spend, impressions, clicks, reach, frequency, cpc, cpm, ctr, leads_meta)
        VALUES (
          ${r.campaign_id},
          ${r.date_start}::date,
          ${parseFloat(r.spend || '0')},
          ${parseInt(r.impressions || '0')},
          ${parseInt(r.clicks || '0')},
          ${parseInt(r.reach || '0')},
          ${parseFloat(r.frequency || '0')},
          ${parseFloat(r.cpc || '0')},
          ${parseFloat(r.cpm || '0')},
          ${parseFloat(r.ctr || '0')},
          ${parseInt(leadsAction)}
        )
        ON CONFLICT DO NOTHING
      `;
      inserted++;
    }
    return inserted;
  } catch {
    return 0;
  }
}

async function upsertFatoAtribuicao(): Promise<number> {
  await sql`DELETE FROM fato_atribuicao_marketing`;

  const result = await sql`
    INSERT INTO fato_atribuicao_marketing (
      id_campanha, nome_campanha, data,
      spend, impressions, clicks,
      leads_gerados, leads_com_venda, valor_vendas,
      cpl, cac, roas
    )
    SELECT
      COALESCE(NULLIF(l.midia, ''), 'Sem origem')   AS id_campanha,
      COALESCE(dc.nome, NULLIF(l.midia, ''), 'Sem origem') AS nome_campanha,
      l.data_cadastro                               AS data,
      COALESCE(SUM(mp.spend), 0)                    AS spend,
      COALESCE(SUM(mp.impressions), 0)              AS impressions,
      COALESCE(SUM(mp.clicks), 0)                   AS clicks,
      COUNT(DISTINCT l.id_lead)::bigint             AS leads_gerados,
      COUNT(DISTINCT l.id_lead) FILTER (
        WHERE lower(l.status) LIKE '%venda%'
           OR lower(l.status) LIKE '%negócio ganho%'
      )::bigint                                     AS leads_com_venda,
      COALESCE(SUM(fv.valor) FILTER (
        WHERE fv.id_venda IS NOT NULL
      ), 0)                                         AS valor_vendas,
      CASE WHEN COUNT(DISTINCT l.id_lead) > 0 AND COALESCE(SUM(mp.spend), 0) > 0
        THEN ROUND(SUM(mp.spend) / COUNT(DISTINCT l.id_lead), 2)
        ELSE 0 END                                  AS cpl,
      CASE WHEN COUNT(DISTINCT l.id_lead) FILTER (WHERE lower(l.status) LIKE '%venda%') > 0
             AND COALESCE(SUM(mp.spend), 0) > 0
        THEN ROUND(SUM(mp.spend) / COUNT(DISTINCT l.id_lead) FILTER (WHERE lower(l.status) LIKE '%venda%'), 2)
        ELSE 0 END                                  AS cac,
      CASE WHEN COALESCE(SUM(mp.spend), 0) > 0 AND COALESCE(SUM(fv.valor), 0) > 0
        THEN ROUND(SUM(fv.valor) / SUM(mp.spend), 2)
        ELSE 0 END                                  AS roas
    FROM fato_leads l
    LEFT JOIN fato_midia_paga mp
           ON mp.id_campanha = COALESCE(NULLIF(l.midia, ''), 'Sem origem')
          AND mp.data = l.data_cadastro
    LEFT JOIN dim_campanhas_meta dc
           ON dc.id_campanha = COALESCE(NULLIF(l.midia, ''), 'Sem origem')
    LEFT JOIN fato_vendas fv
           ON fv.data_venda = l.data_venda
          AND l.data_venda IS NOT NULL
    WHERE l.data_cadastro IS NOT NULL
    GROUP BY l.midia, dc.nome, l.data_cadastro
    ON CONFLICT DO NOTHING
  `;
  return result.count ?? 0;
}

async function updateIdDataReferences(): Promise<void> {
  await sql`
    UPDATE fato_leads f
    SET id_data_cadastro = t.id_data
    FROM dim_tempo t
    WHERE f.data_cadastro = t.data
      AND f.id_data_cadastro IS NULL
  `;
  await sql`
    UPDATE fato_leads f
    SET id_data_venda = t.id_data
    FROM dim_tempo t
    WHERE f.data_venda = t.data
      AND f.id_data_venda IS NULL
  `;
  await sql`
    UPDATE fato_vendas f
    SET id_data = t.id_data
    FROM dim_tempo t
    WHERE f.data_venda = t.data
      AND f.id_data IS NULL
  `;
  await sql`
    UPDATE fato_midia_paga f
    SET id_data = t.id_data
    FROM dim_tempo t
    WHERE f.data = t.data
      AND f.id_data IS NULL
  `;
  await sql`
    UPDATE fato_interacoes f
    SET id_data = t.id_data
    FROM dim_tempo t
    WHERE f.changed_at::date = t.data
      AND f.id_data IS NULL
  `;
  await sql`
    UPDATE fato_atribuicao_marketing f
    SET id_data = t.id_data
    FROM dim_tempo t
    WHERE f.data = t.data
      AND f.id_data IS NULL
  `;
}

async function safe(name: string, fn: () => Promise<number>, results: Record<string, number | string>) {
  try {
    results[name] = await fn();
  } catch (e: unknown) {
    results[name] = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }
}

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) return unauthorizedJson();

  try {
    await ensureSchema();
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: `ensureSchema: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
  }

  const results: Record<string, number | string> = {};

  await safe('dim_tempo',           upsertDimTempo,           results);
  await safe('dim_empreendimentos', upsertDimEmpreendimentos, results);
  await safe('dim_campanhas_meta',  upsertDimCampanhasMeta,   results);
  await safe('fato_leads',          upsertFatoLeads,          results);
  await safe('fato_vendas',         upsertFatoVendas,         results);
  await safe('fato_interacoes',     upsertFatoInteracoes,     results);
  await safe('fato_midia_paga',     upsertFatoMidiaPaga,      results);
  await safe('fato_atribuicao',     upsertFatoAtribuicao,     results);

  try { await updateIdDataReferences(); } catch (e: unknown) {
    results['updateIdDataReferences'] = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  const hasErrors = Object.values(results).some(v => typeof v === 'string' && v.startsWith('ERROR'));
  return NextResponse.json({ ok: !hasErrors, message: 'BI Star Schema sincronizado', results });
}
