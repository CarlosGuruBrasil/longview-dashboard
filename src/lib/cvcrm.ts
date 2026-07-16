/**
 * lib/cvcrm.ts
 *
 * Helper para interagir com o CV CRM (Construtor de Vendas) API.
 * Usado pelo pipeline de webhook Meta → CV CRM para criar leads em tempo real,
 * sem passar pelo RD Station (que adiciona latência de minutos a horas).
 */
import axios from 'axios';
import logger from '@/lib/logger'

const CRM_BASE    = 'https://longviewempreendimentos.cvcrm.com.br/api/v1';
const CRM_TIMEOUT = 15_000; // 15s

function crmHeaders() {
  return {
    email:  process.env.CV_CRM_EMAIL ?? '',
    token:  process.env.CV_CRM_TOKEN ?? '',
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

export interface CrmLeadInput {
  nome:           string;
  email?:         string;
  telefone?:      string;
  /** Origem do lead — ex: "Meta Lead Ads", "Site", "Indicação" */
  origem?:        string;
  /** Nome da campanha ou mídia */
  midia?:         string;
  /** Nome do empreendimento de interesse */
  empreendimento?: string;
  /** Mensagem livre / observação */
  mensagem?:      string;
  /** Campos extras livres para o CRM */
  [key: string]: unknown;
}

export interface CrmLeadResult {
  ok:      boolean;
  id?:     string | number;
  raw?:    unknown;
  error?:  string;
  action?: 'created' | 'reactivated' | 'annotated_existing';
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === 'number') return String(value);
  return undefined;
}

function pickLeadId(lead: Record<string, unknown>): string | number | undefined {
  return toOptionalString(lead.idlead) ?? toOptionalString(lead.id) ?? toOptionalString(asRecord(lead.lead).id) ?? toOptionalString(asRecord(lead.lead).idlead);
}

function pickSituacaoId(lead: Record<string, unknown>): number | null {
  const situacao = asRecord(lead.situacao);
  const raw = situacao.id ?? lead.idsituacao;
  const parsed = raw != null ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function pickCorretorId(lead: Record<string, unknown>): number | null {
  const corretor = asRecord(lead.corretor);
  const raw = corretor.id ?? lead.idcorretor;
  const parsed = raw != null ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function isLikelyDuplicateError(detail: string): boolean {
  const normalized = detail.toLowerCase();
  return [
    'duplic',
    'ja existe',
    'já existe',
    'existente',
    'erro_ao_alterar_lead',
    'lead existente',
    'lead ja cadastrado',
    'lead já cadastrado',
  ].some((token) => normalized.includes(token));
}

function buildDuplicateMotivo(lead: CrmLeadInput): string {
  const origem = lead.origem ?? 'Origem não informada';
  const parts = [
    `Lead recorrente identificado.`,
    `Origem: ${origem}.`,
    lead.midia ? `Mídia/Campanha: ${lead.midia}.` : '',
    lead.empreendimento ? `Empreendimento: ${lead.empreendimento}.` : '',
    lead.mensagem ? `Observação capturada: ${lead.mensagem}.` : '',
  ].filter(Boolean);
  return parts.join(' ').slice(0, 32000);
}

async function anotarLeadExistente(input: {
  idlead: string | number;
  email?: string;
  telefone?: string;
  motivo: string;
}): Promise<ReativarLeadResult> {
  try {
    const payload: Record<string, unknown> = {
      idlead: input.idlead,
      permitir_alteracao: true,
      ...(input.email ? { email: input.email } : {}),
      ...(input.telefone ? { telefone: input.telefone } : {}),
      interacoes: [{
        tipo: 'A',
        descricao: input.motivo.slice(0, 32000),
      }],
    };

    const res = await axios.post(
      `${CRM_BASE}/comercial/leads`,
      payload,
      { headers: crmHeaders(), timeout: CRM_TIMEOUT }
    );

    logger.info({ idlead: input.idlead }, '[cvcrm] lead existente anotado');
    return { ok: true, raw: res.data };
  } catch (err: unknown) {
    const data = axios.isAxiosError(err) ? err.response?.data as { message?: string; error?: string } | undefined : undefined;
    const detail =
      data?.message ??
      data?.error   ??
      (err instanceof Error ? err.message : String(err));
    logger.warn({ idlead: input.idlead, detail }, '[cvcrm] anotar lead existente falhou');
    return { ok: false, error: detail };
  }
}

/**
 * Cria ou atualiza um lead no CV CRM.
 * Retorna { ok, id } em sucesso ou { ok: false, error } em falha.
 *
 * O CV CRM pode retornar o lead existente se o e-mail/telefone já existe
 * — comportamento depende da configuração da conta.
 */
export async function createCrmLead(lead: CrmLeadInput): Promise<CrmLeadResult> {
  try {
    const payload: Record<string, unknown> = {
      nome:    lead.nome,
      email:   lead.email   ?? undefined,
      telefone: lead.telefone ?? undefined,
      origem:  lead.origem  ?? 'Meta Lead Ads',
      midia:   lead.midia   ?? undefined,
      // CV CRM aceita empreendimento como string (nome) ou id
      ...(lead.empreendimento ? { empreendimento: lead.empreendimento } : {}),
      ...(lead.mensagem       ? { mensagem: lead.mensagem }             : {}),
    };

    const res = await axios.post(
      `${CRM_BASE}/comercial/leads`,
      payload,
      { headers: crmHeaders(), timeout: CRM_TIMEOUT }
    );

    const data = res.data as { idlead?: string | number; id?: string | number; lead?: { id?: string | number; idlead?: string | number } };
    const id   = data.idlead ?? data.id ?? data.lead?.id ?? data.lead?.idlead;

    logger.info({ id, nome: lead.nome }, '[cvcrm] lead criado');
    return { ok: true, id, raw: data, action: 'created' };

  } catch (err: unknown) {
    const data = axios.isAxiosError(err) ? err.response?.data as { message?: string; error?: string } | undefined : undefined;
    const detail =
      data?.message ??
      data?.error   ??
      (err instanceof Error ? err.message : String(err));

    if ((lead.email || lead.telefone) && isLikelyDuplicateError(detail)) {
      const existing = await findCrmLeadByContact(lead.email, lead.telefone);
      const existingLead = asRecord(existing);
      const existingId = pickLeadId(existingLead);

      if (existingId) {
        const motivo = buildDuplicateMotivo(lead);
        const idsituacaoAtual = pickSituacaoId(existingLead);
        const idcorretor = pickCorretorId(existingLead);
        const email = toOptionalString(existingLead.email) ?? lead.email;
        const telefone = toOptionalString(existingLead.telefone) ?? toOptionalString(existingLead.celular) ?? lead.telefone;

        if (idsituacaoAtual != null && !idsituacaoExcluidaDeReativacao(idsituacaoAtual)) {
          const reactivation = await reativarLead({
            idlead: existingId,
            email,
            telefone,
            idcorretor,
            motivo,
          });

          if (reactivation.ok) {
            logger.info({ id: existingId, nome: lead.nome }, '[cvcrm] lead duplicado reativado');
            return {
              ok: true,
              id: existingId,
              raw: { existing: existingLead, reactivation: reactivation.raw },
              action: 'reactivated',
            };
          }
        }

        const annotation = await anotarLeadExistente({
          idlead: existingId,
          email,
          telefone,
          motivo,
        });

        if (annotation.ok) {
          logger.info({ id: existingId, nome: lead.nome }, '[cvcrm] lead duplicado anotado');
          return {
            ok: true,
            id: existingId,
            raw: { existing: existingLead, annotation: annotation.raw },
            action: 'annotated_existing',
          };
        }
      }
    }

    logger.warn({ detail, nome: lead.nome, email: lead.email, telefone: lead.telefone }, '[cvcrm] createLead falhou');
    return { ok: false, error: detail };
  }
}

/**
 * Busca leads recentes do CRM por e-mail ou telefone.
 * Útil para dedup antes de criar.
 */
export async function findCrmLeadByContact(email?: string, telefone?: string): Promise<unknown | null> {
  if (!email && !telefone) return null;
  try {
    const params: Record<string, string> = {};
    if (email)    params.email    = email;
    if (telefone) params.telefone = telefone;

    const res = await axios.get(`${CRM_BASE}/comercial/leads`, {
      params: { ...params, limit: 1 },
      headers: crmHeaders(),
      timeout: CRM_TIMEOUT,
    });
    const leads = res.data?.leads ?? res.data ?? [];
    return Array.isArray(leads) && leads.length > 0 ? leads[0] : null;
  } catch {
    return null;
  }
}

// ─── Reativação de lead (reengajamento com campanha / e-mail marketing) ───────
//
// Regra de negócio (definida em 2026-07-14):
//  - Lead da corretora Marianne Maier (idcorretor 23) -> volta pra "Aguardando Atendimento" (1)
//  - Qualquer outro corretor/sem corretor              -> volta pra "Aguardando Atendimento Corretor" (2)
//  - Leads em "Com Reserva" (5) ou "Venda Realizada" (6) NUNCA são revertidos automaticamente
//
// Validado ao vivo em 2026-07-14 contra a API de produção (lead 3841): o POST
// com idsituacao + interacoes[].tarefa atribuída ao corretor reativa o lead e
// cria uma tarefa pra ele dentro do CV CRM. Ver histórico da conversa pro payload de teste.

const IDSITUACAO_AGUARDANDO_ATENDIMENTO          = 1;
const IDSITUACAO_AGUARDANDO_ATENDIMENTO_CORRETOR = 2;
const IDCORRETOR_MARIANNE_MAIER                  = 23;

/** Etapas que nunca sofrem reversão automática — lead já vendido ou com reserva ativa */
const IDSITUACOES_EXCLUIDAS_DE_REATIVACAO = new Set([5 /* Com Reserva */, 6 /* Venda Realizada */]);

export function idsituacaoExcluidaDeReativacao(idsituacaoAtual: number | null | undefined): boolean {
  return idsituacaoAtual != null && IDSITUACOES_EXCLUIDAS_DE_REATIVACAO.has(idsituacaoAtual);
}

export function idsituacaoDestinoReativacao(idcorretor: number | null | undefined): number {
  return idcorretor === IDCORRETOR_MARIANNE_MAIER
    ? IDSITUACAO_AGUARDANDO_ATENDIMENTO
    : IDSITUACAO_AGUARDANDO_ATENDIMENTO_CORRETOR;
}

/** "YYYY-MM-DD HH:mm" em horário de Brasília (aproximado, sem lib de timezone) */
function agoraBrasilia(): string {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

export interface ReativarLeadInput {
  idlead:     string | number;
  email?:     string;
  telefone?:  string;
  /** id do corretor no CV CRM — decide a etapa de destino e quem recebe a tarefa */
  idcorretor?: number | null;
  /** descrição da interação registrada no lead — o "o que aconteceu / de onde veio" */
  motivo:     string;
}

export interface ReativarLeadResult {
  ok:         boolean;
  idsituacao?: number;
  error?:     string;
  raw?:       unknown;
}

/**
 * Reativa um lead já cadastrado (volta pra etapa de "aguardando atendimento")
 * e registra uma interação com tarefa atribuída ao corretor, pra ele saber
 * o motivo do reengajamento. Nunca chamar sem antes checar
 * idsituacaoExcluidaDeReativacao() na etapa atual do lead.
 */
export async function reativarLead(input: ReativarLeadInput): Promise<ReativarLeadResult> {
  if (!input.email && !input.telefone) {
    return { ok: false, error: 'email_ou_telefone_obrigatorio' };
  }

  const idsituacao = idsituacaoDestinoReativacao(input.idcorretor);

  const interacao: Record<string, unknown> = {
    tipo: 'A', // Anotação
    descricao: input.motivo.slice(0, 32_000),
  };

  // Só cria tarefa se soubermos pra quem atribuir — sem corretor, a distribuição
  // fica a cargo das regras normais do CV CRM (fila, imobiliária etc.)
  if (input.idcorretor) {
    interacao.tarefa = {
      nome: `Lead reengajou — ${input.motivo}`.slice(0, 255),
      data: agoraBrasilia(),
      situacao: 'P',        // Pendente
      prioridade: 'N',      // Normal
      tipo_responsavel: 'C', // Corretor
      idresponsavel: input.idcorretor,
      lembrete_tarefa: 'S',
    };
  }

  try {
    const payload: Record<string, unknown> = {
      idlead: input.idlead,
      permitir_alteracao: true,
      idsituacao,
      ...(input.email    ? { email: input.email }       : {}),
      ...(input.telefone ? { telefone: input.telefone } : {}),
      interacoes: [interacao],
    };

    const res = await axios.post(
      `${CRM_BASE}/comercial/leads`,
      payload,
      { headers: crmHeaders(), timeout: CRM_TIMEOUT }
    );

    logger.info(`[cvcrm] lead ${input.idlead} reativado -> idsituacao=${idsituacao}`);
    return { ok: true, idsituacao, raw: res.data };

  } catch (err: unknown) {
    const data = axios.isAxiosError(err) ? err.response?.data as { message?: string; error?: string } | undefined : undefined;
    const detail =
      data?.message ??
      data?.error   ??
      (err instanceof Error ? err.message : String(err));
    logger.warn(`[cvcrm] reativarLead falhou (lead ${input.idlead}): ${detail}`);
    return { ok: false, error: detail };
  }
}
