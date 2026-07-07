/**
 * Sincroniza reservas do CV CRM (/comercial/reservas) para cv_vendas.
 * Compartilhado entre cron/sync-cv-vendas e a rota cv/vendas.
 */
import axios from 'axios';
import { sql } from '@/lib/pg';
import logger from '@/lib/logger';

type CvReserva = {
  situacao?: { idsituacao?: number; situacao?: string };
  unidade?: { empreendimento?: string; idempreendimento_cv?: number; idunidade_cv?: number; unidade?: string; tipologia?: string; bloco?: string };
  titular?: { nome?: string; email?: string; telefone?: string; celular?: string; documento?: string };
  corretor?: { corretor?: string; email?: string; idcorretor_cv?: number };
  imobiliaria?: { nome?: string };
  condicoes?: { valor_contrato?: string | number; vgv_tabela?: string | number | null };
  leads_associados?: { idlead?: number | string; data_cad?: string }[];
  data?: string;
  data_venda?: string | null;
  data_contrato?: string | null;
  data_cancelamento?: string | null;
  data_distrato?: string | null;
};

export async function syncReservas(email: string, token: string): Promise<number> {
  const headers = { email, token, Accept: 'application/json' };
  let reservas: Record<string, CvReserva> = {};

  try {
    const res = await axios.get<Record<string, CvReserva>>(
      'https://longviewempreendimentos.cvcrm.com.br/api/v1/comercial/reservas',
      { params: { situacao: 'todas' }, headers, timeout: 45000 }
    );
    reservas = res.data && typeof res.data === 'object' ? res.data : {};
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, '[cv-sync] Erro ao buscar reservas');
    return 0;
  }

  const ids = Object.keys(reservas);
  if (ids.length === 0) return 0;

  // Fallback de valor: valor_contrato → valor_venda do lead → valor de tabela da unidade
  const unidadeValores = new Map<number, number>();
  const unRows = await sql<{ id: number; valor: string | null }[]>`SELECT id, valor FROM cv_unidades`;
  unRows.forEach(u => { if (u.valor != null) unidadeValores.set(Number(u.id), Number(u.valor)); });

  const leadValores = new Map<string, number>();
  const leadRows = await sql<{ id: string; vv: string | null }[]>`
    SELECT id, raw->>'valor_venda' AS vv FROM leads
    WHERE NULLIF(raw->>'valor_venda','') IS NOT NULL`;
  leadRows.forEach(l => {
    const v = parseFloat(l.vv ?? '0');
    if (v > 0) leadValores.set(String(l.id), v);
  });

  let upserted = 0;
  for (const idStr of ids) {
    const r = reservas[idStr];
    const id = parseInt(idStr, 10);
    if (!Number.isFinite(id)) continue;

    const situacao   = r.situacao?.situacao ?? null;
    const cancelada  = !!(r.data_cancelamento || r.data_distrato);
    const vendida    = situacao === 'Vendida' && !cancelada;
    const idUnidade  = r.unidade?.idunidade_cv != null ? Number(r.unidade.idunidade_cv) : null;
    const valorContrato = parseFloat(String(r.condicoes?.valor_contrato ?? '0')) || 0;
    const dataVenda  = r.data_venda ? new Date(r.data_venda) : null;
    const idlead     = r.leads_associados?.[0]?.idlead != null ? String(r.leads_associados[0].idlead) : null;
    const valor      = valorContrato > 0 ? valorContrato
      : (idlead != null ? leadValores.get(idlead) : undefined)
      ?? (idUnidade != null ? unidadeValores.get(idUnidade) ?? 0 : 0);

    const raw = {
      idreserva: id,
      situacao,
      aprovada: vendida ? '1' : cancelada ? '0' : null,
      empreendimento: r.unidade?.empreendimento ?? null,
      unidade: r.unidade?.unidade ?? null,
      tipologia: r.unidade?.tipologia ?? null,
      corretor: r.corretor?.corretor ?? null,
      corretor_email: r.corretor?.email ?? null,
      imobiliaria: r.imobiliaria?.nome ?? null,
      cliente: r.titular?.nome ?? null,
      email: r.titular?.email ?? null,
      telefone: r.titular?.telefone ?? r.titular?.celular ?? null,
      documento: r.titular?.documento ?? null,
      idlead,
      valor_contrato: valor > 0 ? String(valor) : null,
      valor_contrato_original: valorContrato > 0 ? String(valorContrato) : null,
      data_reserva: r.data ?? null,
      data_venda: r.data_venda ?? null,
      data_contrato: r.data_contrato ?? null,
      data_cancelamento: r.data_cancelamento ?? null,
      _reserva: r,
    };

    await sql`
      INSERT INTO cv_vendas (id, id_empreendimento, id_unidade, valor, data_venda, status, raw, synced_at)
      VALUES (${id}, ${r.unidade?.idempreendimento_cv ?? null}, ${idUnidade}, ${valor || null}, ${dataVenda}, ${situacao}, ${raw as never}, NOW())
      ON CONFLICT (id) DO UPDATE SET
        id_empreendimento = EXCLUDED.id_empreendimento,
        id_unidade        = EXCLUDED.id_unidade,
        valor             = EXCLUDED.valor,
        data_venda        = EXCLUDED.data_venda,
        status            = EXCLUDED.status,
        raw               = EXCLUDED.raw,
        synced_at         = EXCLUDED.synced_at
    `;
    upserted++;
  }

  logger.info(`[cv-sync] ${upserted} reservas sincronizadas`);
  return upserted;
}
