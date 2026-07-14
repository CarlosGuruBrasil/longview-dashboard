/**
 * lib/leadReativacao.ts
 *
 * Reengajamento de lead já cadastrado: quando um lead conhecido interage de
 * novo com uma campanha (Meta) ou com e-mail marketing (RD Station), busca
 * o cadastro existente no nosso Postgres e reativa no CV CRM — em vez de
 * criar um lead duplicado.
 */
import logger from '@/lib/logger';
import { reativarLead, idsituacaoExcluidaDeReativacao } from '@/lib/cvcrm';

export interface ReengajarInput {
  email?:    string;
  telefone?: string;
  /** descrição do que aconteceu — ex: "Reengajamento: abriu e-mail 'Newsletter Julho' (RD Station)" */
  motivo:    string;
}

export type ReengajarReason =
  | 'reativado'
  | 'sem_email_ou_telefone'
  | 'lead_nao_encontrado'
  | 'etapa_excluida'
  | 'situacao_desconhecida'
  | string; // erro vindo do CV CRM

export interface ReengajarResult {
  ok:     boolean;
  reason: ReengajarReason;
  leadId?: string;
}

/**
 * Procura um lead já cadastrado por e-mail/telefone e, se encontrado e fora
 * das etapas protegidas (Com Reserva, Venda Realizada), manda reativar no
 * CV CRM. Se a etapa atual não puder ser determinada com confiança, prefere
 * não agir (fail-safe) a arriscar mexer num lead vendido/reservado.
 */
export async function reengajarLeadPorContato(input: ReengajarInput): Promise<ReengajarResult> {
  const { email, telefone, motivo } = input;
  if (!email && !telefone) return { ok: false, reason: 'sem_email_ou_telefone' };

  const { sql } = await import('@/lib/pg');

  const rows = await sql<{ id: string; raw: Record<string, unknown> }[]>`
    SELECT id, raw FROM leads
    WHERE (${email ?? null}::text IS NOT NULL AND LOWER(email) = LOWER(${email ?? ''}))
       OR (${telefone ?? null}::text IS NOT NULL AND telefone = ${telefone ?? ''})
    ORDER BY data_atualizacao DESC NULLS LAST
    LIMIT 1
  `;
  const lead = rows[0];
  if (!lead) return { ok: false, reason: 'lead_nao_encontrado' };

  const raw = lead.raw ?? {};
  const situacaoObj = raw.situacao as { id?: unknown; nome?: unknown } | undefined;
  const idsituacaoAtual = situacaoObj?.id != null ? Number(situacaoObj.id) : NaN;

  if (Number.isNaN(idsituacaoAtual)) {
    logger.warn(`[reengajamento] lead ${lead.id} sem etapa conhecida — não arrisca reativar`);
    return { ok: false, reason: 'situacao_desconhecida', leadId: lead.id };
  }

  if (idsituacaoExcluidaDeReativacao(idsituacaoAtual)) {
    logger.info(`[reengajamento] lead ${lead.id} em etapa protegida (${idsituacaoAtual}) — ignorado`);
    return { ok: false, reason: 'etapa_excluida', leadId: lead.id };
  }

  const corretorObj = raw.corretor as { id?: unknown } | undefined;
  const idcorretor = corretorObj?.id != null ? Number(corretorObj.id) : null;
  const leadEmail    = (raw.email as string | undefined)    ?? email;
  const leadTelefone = (raw.telefone as string | undefined) ?? telefone;

  const result = await reativarLead({
    idlead: lead.id,
    email: leadEmail || undefined,
    telefone: leadTelefone || undefined,
    idcorretor,
    motivo,
  });

  return { ok: result.ok, reason: result.ok ? 'reativado' : (result.error ?? 'erro_desconhecido'), leadId: lead.id };
}
