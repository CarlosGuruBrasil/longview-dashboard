export interface LeadSituacao {
  nome: string;
  cor?: string;
}

export interface LeadEmpreendimento {
  nome: string;
  id?: string;
}

export interface LeadPessoa {
  nome: string;
  id?: string | number;
  email?: string;
}

export interface LeadMotivoCancelamento {
  nome: string;
}

export interface LeadTag {
  nome?: string;
  id?: string;
}

export interface LeadInteracao {
  data_cad?: string;
  tipo?: string;
}

export interface Lead {
  idlead?: string | number;
  id?: string | number;
  nome?: string;
  email?: string;
  telefone?: string;
  celular?: string;
  // datas — CV CRM usa qualquer um destes
  data_cad?: string;
  data_cadastro?: string;
  data_cadastramento?: string;
  data_atualizacao?: string;
  ultima_data_conversao?: string;
  situacao?: LeadSituacao;
  origem?: string | { nome: string };
  midia_principal?: string;
  midia_visita?: string;
  empreendimento?: LeadEmpreendimento[];
  corretor?: LeadPessoa;
  gestor?: LeadPessoa;
  imobiliaria?: LeadPessoa;
  /** Email de quem fez a última alteração (≈ quem cadastrou, nos leads manuais) */
  autor_ultima_alteracao?: string;
  temperatura?: string;
  score?: number;
  valor_negocio?: string | number;
  data_venda?: string;
  valor_venda?: string | number;
  qtde_reservas_associadas?: number;
  qtde_simulacoes_associadas?: number;
  motivo_cancelamento?: LeadMotivoCancelamento;
  genero?: string;
  cidade?: string;
  estado_civil?: string;
  tags?: Array<string | LeadTag>;
  interacao?: LeadInteracao[];
  bolsao?: boolean | string | number;
}

export interface LeadsApiResponse {
  leads: Lead[];
  total: number;
  crmTotal: number;
}

// ── Meta Ads ─────────────────────────────────────────────────────────────────

export interface MetaAction {
  action_type: string;
  value: string;
}

export interface MetaInsights {
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
  frequency?: string;
  cpc?: string;
  cpm?: string;
  ctr?: string;
  cpp?: string;
  actions?: MetaAction[];
  cost_per_action_type?: MetaAction[];
  date_start?: string;
  date_stop?: string;
}

export interface MetaCampaignInsight extends MetaInsights {
  campaign_id: string;
  campaign_name: string;
}

export interface MetaCampaignDetail {
  id: string;
  name: string;
  status: string;
  objective?: string;
  buying_type?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  spend_cap?: string;
  created_time?: string;
  start_time?: string;
  stop_time?: string;
}

export interface MetaAdset extends MetaInsights {
  campaign_id: string;
  campaign_name: string;
  adset_id: string;
  adset_name: string;
}

export interface MetaDemographic extends MetaInsights {
  gender: string;
  age: string;
}

export interface MetaRegion extends MetaInsights {
  region: string;
}

export interface MetaPlatform extends MetaInsights {
  publisher_platform: string;
}

export interface MetaDevice extends MetaInsights {
  device_platform: string;
}

export interface MetaDailyInsight extends MetaInsights {
  date_start: string;
  date_stop: string;
}

export interface MetaLeadForm {
  id: string;
  name: string;
  status?: string;
  leads_count?: number;
  created_time?: string;
}

export interface MetaPageInfo {
  id: string;
  name?: string;
  fan_count?: number;
  followers_count?: number;
  instagram_business_account?: { id: string };
}

export interface MetaData {
  global: MetaInsights | null;
  campaigns: MetaCampaignInsight[];
  campaignDetails: MetaCampaignDetail[];
  adsets: MetaAdset[];
  demographics: MetaDemographic[];
  regions: MetaRegion[];
  platforms: MetaPlatform[];
  devices: MetaDevice[];
  daily: MetaDailyInsight[];
  leadForms: MetaLeadForm[];
  page: MetaPageInfo | null;
}

// ── Estoque ───────────────────────────────────────────────────────────────────

export interface EstoqueData {
  empreendimentos: { id: number; nome: string; situacao: string; tipo: string }[];
  resumo: {
    id_empreendimento: number;
    total: number;
    disponivel: number;
    reservado: number;
    vendido: number;
    vgv_disponivel: number;
    vgv_vendido: number;
  }[];
  unidades: {
    id: number;
    id_empreendimento: number;
    bloco: string;
    numero: string;
    status: string;
    valor: number;
    metragem: number;
  }[];
}

// ── API response ──────────────────────────────────────────────────────────────

export interface DashboardApiResponse {
  leads: LeadsApiResponse;
  meta: MetaData;
  estoque: EstoqueData;
  leadForms: MetaLeadForm[];
  page: MetaPageInfo | null;
  updatedAt: string;
  _cached: boolean;
}

// ── CVDW Vendas ───────────────────────────────────────────────────────────────

/** Estrutura de uma venda individual retornada pelo endpoint /api/v1/cvdw/vendas */
export interface CvdwVenda {
  referencia?: string;
  referencia_data?: string;
  ativo?: string;
  idreserva?: number;
  idlead?: string;
  aprovada?: string;
  data_reserva?: string;
  data_venda?: string;
  idhistorico?: number;
  data_historico?: string;
  empreendimento?: string;
  idempreendimento?: number;
  codigointerno_empreendimento?: string;
  regiao?: string;
  etapa?: string;
  planta?: string;
  bloco?: string;
  unidade?: string;
  idunidade?: number;
  area_privativa?: number;
  cliente?: string;
  idcliente?: number;
  documento_cliente?: string;
  email?: string;
  cidade?: string;
  cep_cliente?: string;
  renda?: number;
  sexo?: string;
  idade?: number;
  estado_civil?: string;
  idcorretor?: number;
  corretor?: string;
  idimobiliaria?: number;
  imobiliaria?: string;
  campanha?: string;
  valor_contrato?: number;
  contrato_interno?: string;
  idpessoa_cv?: number;
  idpessoa_int?: string;
  idmidia?: number;
  midia?: string;
  idtabela?: string;
  nometabela?: string;
  codigointernotabela?: string;
  idtipovenda?: number;
  tipovenda?: string;
  associados?: Array<{
    ativo?: string;
    idpessoa_cv?: number;
    idtipo_associacao?: number;
    tipo_associacao?: string;
    percentagem_participacao?: number;
  }>;
}

// ── UI helpers ────────────────────────────────────────────────────────────────

export interface StatusColor {
  bg: string;
  text: string;
}

export type ActiveView =
  | 'dashboard'
  | 'leads'
  | 'oportunidades'
  | 'empreendimentos'
  | 'vendas'
  | 'marketing'
  | 'publicar'
  | 'audiences'
  | 'links'
  | 'score'
  | 'metrics';
export interface DateRange {
  start: string;
  end: string;
}
