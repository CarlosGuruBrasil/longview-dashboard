import { NextRequest, NextResponse } from 'next/server';
import { parseCrmDate } from '@/lib/dateUtils';
import logger from '@/lib/logger'

type NamedValue = {
  nome?: string;
};

type CvRecord = Record<string, unknown> & {
  id?: string | number;
  idlead?: string | number;
  idvenda?: string | number;
  idunidade?: string | number;
  idempreendimento?: string | number;
  referencia?: string | number;
  nome?: string;
  name?: string;
  email?: string;
  telefone?: string;
  celular?: string;
  phone?: string;
  origem?: NamedValue | string;
  origin?: string;
  empreendimento?: unknown;
  produto?: unknown;
  responsavel?: NamedValue;
  corretor?: NamedValue;
  gestor?: NamedValue;
  autor_ultima_alteracao?: string;
  status?: string;
  situacao?: string | (NamedValue & {
    situacao_para_venda?: string | number;
    reservada?: unknown;
    vendida?: unknown;
    vendida_idsituacao?: string | number;
  });
  valor_venda?: string | number;
  valor?: string | number;
  metragem_real?: string | number;
  bloco_nome?: string;
  bloco?: string;
  numero?: string;
  status_venda?: string | number;
  score?: unknown;
  temperatura?: unknown;
  data_venda?: string | number | Date;
  data_cad?: string;
  data_cadastro?: string;
  data_atualizacao?: string;
};

type CvWebhookBody = CvRecord & {
  lead?: CvRecord;
  venda?: CvRecord;
  unidade?: CvRecord;
};

function asRecord(value: unknown): CvRecord {
  return value && typeof value === 'object' ? value as CvRecord : {};
}

function sqlScalar(value: unknown): string | number | boolean | null {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return value == null ? null : String(value);
}

function situacaoNome(value: CvRecord['situacao']): string | null {
  return typeof value === 'object' && value ? value.nome ?? null : typeof value === 'string' ? value : null;
}

/**
 * Busca o lead completo no CV CRM. Necessário porque os webhooks estão
 * configurados com forma_envio="id" — o CV manda só o id, não o objeto.
 */
async function fetchLeadById(id: string | number): Promise<CvRecord | null> {
  const email = process.env.CV_CRM_EMAIL, token = process.env.CV_CRM_TOKEN;
  if (!email || !token) return null;
  try {
    const res = await fetch(
      `https://longviewempreendimentos.cvcrm.com.br/api/v1/comercial/leads?limit=1&idlead=${encodeURIComponent(String(id))}`,
      { headers: { email, token, Accept: 'application/json' } }
    );
    const data = await res.json() as { leads?: CvRecord[] };
    const leads = data?.leads ?? [];
    return Array.isArray(leads) && leads[0] ? leads[0] : null;
  } catch { logger.warn('[webhook/cvcrm] fetchLeadById falhou'); return null; }
}

/** empreendimento pode vir como array de objetos — normaliza pra texto */
function empreendimentoText(emp: unknown): string | null {
  if (!emp) return null;
  if (Array.isArray(emp)) return emp.map((e) => asRecord(e).nome ?? e).filter(Boolean).join(', ') || null;
  if (typeof emp === 'object') return asRecord(emp).nome ?? null;
  return String(emp);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as CvWebhookBody;

    // CV CRM envia payload em várias chaves (lead, venda, unidade) dependendo do evento
    const lead = body?.lead ?? body;
    const venda = body?.venda;
    const unidade = body?.unidade;

    const { sql, ensureSchema } = await import('@/lib/pg');
    await ensureSchema();

    // -- Tratar Evento de Venda --
    if (venda?.idvenda || body?.idvenda) {
      const v = venda || body;
      const vendaId = v.idvenda ?? body.idvenda ?? null;
      const dVenda = v.data_venda ? new Date(v.data_venda) : null;
      const valor = v.valor_venda ? parseFloat(String(v.valor_venda)) : null;
      await sql`
        INSERT INTO cv_vendas (id, id_empreendimento, id_unidade, valor, data_venda, status, raw, synced_at)
        VALUES (${vendaId}, ${v.idempreendimento ?? null}, ${v.idunidade ?? null}, ${valor}, ${dVenda}, ${sqlScalar(v.situacao)}, ${JSON.stringify(v)}, NOW())
        ON CONFLICT (id) DO UPDATE SET
          id_empreendimento = EXCLUDED.id_empreendimento, id_unidade = EXCLUDED.id_unidade, valor = EXCLUDED.valor,
          data_venda = EXCLUDED.data_venda, status = EXCLUDED.status, raw = EXCLUDED.raw, synced_at = EXCLUDED.synced_at
      `;
      logger.info(`[webhook/cvcrm] Venda ${vendaId} upserted`);
      return NextResponse.json({ ok: true });
    }

    // -- Tratar Evento de Unidade --
    if (unidade?.idunidade || body?.idunidade) {
      const u = unidade || body;
      const unidadeId = u.idunidade ?? body.idunidade ?? null;
      const sitObj = asRecord(u.situacao);
      const statusVenda = Number(sitObj.situacao_para_venda ?? u.status_venda ?? 0);
      let statusText = 'Desconhecido';
      if (statusVenda === 1) statusText = 'Disponivel';
      else if (statusVenda === 2 || statusVenda === 5 || sitObj.reservada != null) statusText = 'Reservado';
      else if (statusVenda === 3 || sitObj.vendida != null || sitObj.vendida_idsituacao === 3) statusText = 'Vendido';

      const valor = parseFloat(String(u.valor)) || null;
      const metragem = parseFloat(String(u.metragem_real)) || null;

      await sql`
        INSERT INTO cv_unidades (id, id_empreendimento, bloco, numero, status, status_venda, valor, metragem, raw, synced_at)
        VALUES (${unidadeId}, ${u.idempreendimento ?? null}, ${u.bloco_nome ?? u.bloco ?? null}, ${u.nome ?? u.numero ?? null}, ${statusText}, ${statusVenda}, ${valor}, ${metragem}, ${JSON.stringify(u)}, NOW())
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status, status_venda = EXCLUDED.status_venda, valor = EXCLUDED.valor, raw = EXCLUDED.raw, synced_at = EXCLUDED.synced_at
      `;
      logger.info(`[webhook/cvcrm] Unidade ${unidadeId} upserted`);
      return NextResponse.json({ ok: true });
    }

    // -- Tratar Evento de Lead --
    // O id pode vir como objeto completo OU só id (forma_envio="id" no CV CRM).
    const leadId = lead?.idlead ?? lead?.id ?? body?.idlead ?? body?.referencia ?? null;
    if (leadId == null) {
      return NextResponse.json({ ok: false, error: 'payload sem id' }, { status: 400 });
    }

    // Se veio sem os campos (só id), busca o lead completo na API do CV.
    let full = lead;
    if (!full?.nome && !full?.situacao && !full?.email) {
      const fetched = await fetchLeadById(leadId);
      if (fetched) full = fetched;
    }

    const id          = String(full.idlead ?? full.id ?? leadId);
    const statusNomeV = situacaoNome(full.situacao) ?? full.status ?? null;

    // Histórico de etapa: detecta mudança comparando com o status já salvo
    if (statusNomeV) {
      const [prev] = await sql`SELECT status FROM leads WHERE id = ${id}`;
      if (!prev || prev.status !== statusNomeV) {
        const autor = full.responsavel?.nome ?? full.autor_ultima_alteracao ?? full.corretor?.nome
          ?? full.gestor?.nome ?? null;
        await sql`
          INSERT INTO lead_stage_history (lead_id, lead_nome, de, para, autor, raw)
          VALUES (${id}, ${full.nome ?? null}, ${prev?.status ?? null}, ${statusNomeV},
                  ${autor ? String(autor) : null}, ${JSON.stringify(full)})
        `;
      }
    }

    await sql`
      INSERT INTO leads (
        id, nome, email, telefone, origem, status,
        empreendimento, score, temperatura,
        data_cadastro, data_atualizacao, raw, synced_at
      ) VALUES (
        ${id},
        ${full.nome ?? full.name ?? null},
        ${full.email ?? null},
        ${full.telefone ?? full.celular ?? full.phone ?? null},
        ${typeof full.origem === 'object' ? full.origem?.nome ?? null : (full.origem ?? full.origin ?? null)},
        ${statusNomeV},
        ${empreendimentoText(full.empreendimento ?? full.produto)},
        ${sqlScalar(full.score)},
        ${sqlScalar(full.temperatura)},
        ${parseCrmDate(full.data_cad ?? full.data_cadastro)},
        ${parseCrmDate(full.data_atualizacao)},
        ${full as never},
        NOW()
      )
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
        synced_at        = NOW()
    `;

    logger.info(`[webhook/cvcrm] lead ${id} upserted (${statusNomeV ?? '?'})`);

    // ── Notificação FCM: nova venda realizada ────────────────────────────
    const statusNome = (statusNomeV ?? '').toLowerCase();
    const isVenda = statusNome === 'venda realizada' || statusNome.includes('negócio ganho') || statusNome.includes('negocio ganho');
    if (isVenda) {
      try {
        const baseUrl = process.env.NEXTAUTH_URL ?? 'https://app.guru.dev.br';
        fetch(`${baseUrl}/api/notifications/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.CRON_SECRET}` },
          body: JSON.stringify({
            title: '🏆 Nova Venda Realizada!',
            body: `${full.nome ?? 'Cliente'} • ${empreendimentoText(full.empreendimento) ?? ''}`.trim(),
            roles: ['Desenvolvedor', 'Diretoria', 'Gestor'],
            data: { url: '/marketing-vision', type: 'venda' },
          }),
        }).catch(() => logger.warn('[webhook/cvcrm] notificação FCM falhou'));
      } catch { /* não bloqueia o webhook */ }
    }

    return NextResponse.json({ ok: true });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error({ msg }, '[webhook/cvcrm]');
    // Grava falha para retry manual — não retorna 500 para o CV não parar de reenviar
    try {
      const { sql } = await import('@/lib/pg');
      await sql`
        INSERT INTO webhook_errors (source, payload, error, created_at)
        VALUES ('cvcrm', ${{} as never}, ${msg}, NOW())
        ON CONFLICT DO NOTHING
      `.catch(() => logger.warn('[webhook/cvcrm] webhook_errors insert falhou')); // ignora se tabela não existe ainda
    } catch { /* não bloqueia resposta */ }
    return NextResponse.json({ ok: true, warning: 'processed with errors' });
  }
}
