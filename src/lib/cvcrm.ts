/**
 * lib/cvcrm.ts
 *
 * Helper para interagir com o CV CRM (Construtor de Vendas) API.
 * Usado pelo pipeline de webhook Meta → CV CRM para criar leads em tempo real,
 * sem passar pelo RD Station (que adiciona latência de minutos a horas).
 */
import axios from 'axios';

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

    console.log(`[cvcrm] lead criado: id=${id} nome="${lead.nome}"`);
    return { ok: true, id, raw: data };

  } catch (err: unknown) {
    const data = axios.isAxiosError(err) ? err.response?.data as { message?: string; error?: string } | undefined : undefined;
    const detail =
      data?.message ??
      data?.error   ??
      (err instanceof Error ? err.message : String(err));
    console.warn(`[cvcrm] createLead falhou: ${detail}`);
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
