export interface LeadSituacao {
  nome: string;
  id?: string | number;
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
  descricao?: string;
}

export interface Lead {
  idlead?: string | number;
  id?: string | number;
  raw?: Record<string, unknown>;
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
  monthly?: MetaDailyInsight[];
  leadForms: MetaLeadForm[];
  page: MetaPageInfo | null;
}

// ── Estoque ───────────────────────────────────────────────────────────────────

export interface Empreendimento {
  id: number;
  nome: string;
  situacao: string;
  tipo: string;
  cidade?: string | null;
  bairro?: string | null;
  estado?: string | null;
  endereco?: string | null;
  regiao?: string | null;
  cep?: string | null;
  sigla?: string | null;
  numero?: string | null;
  data_entrega?: string | null;
  andamento?: number | null;
  segmento?: string | null;
  situacao_obra?: string | null;
  foto?: string | null;
  logo?: string | null;
  tabela?: Record<string, unknown> | null;
  link_disponibilidade?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  area_construida?: string | null;
  area_privativa?: string | null;
  nome_empresa?: string | null;
  periodo_venda_inicio?: string | null;
  disponivel?: string | null;
  raw?: Record<string, unknown>;
}

export interface EmpreendimentoResumo {
  id_empreendimento: number;
  total: number;
  disponivel: number;
  reservado: number;
  vendido: number;
  vgv_disponivel: number;
  vgv_vendido: number;
}

export interface UnidadeResumida {
  id: number;
  id_empreendimento: number;
  bloco: string;
  numero: string;
  status: string;
  status_venda: number;
  valor: number;
  metragem: number;
  andar?: number | null;
  coluna?: number | null;
  tipologia?: string | null;
  situacao_mapa_disponibilidade?: number | null;
}

export interface EstoqueData {
  empreendimentos: Empreendimento[];
  resumo: EmpreendimentoResumo[];
  unidades: UnidadeResumida[];
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

// ── Lead Summary (modo agregado, payload leve) ────────────────────────────────

export interface LeadSummaryBySituacao {
  nome: string;
  total: number;
}

export interface LeadSummaryByOrigem {
  origem: string;
  total: number;
}

export interface LeadSummaryByEmpreendimento {
  empreendimento: string;
  total: number;
}

export interface LeadSummaryByCorretor {
  corretor: string;
  total: number;
}

export interface LeadSummaryMonthly {
  mes: string; // YYYY-MM
  total: number;
}

/** Dados analíticos pré-calculados no servidor — substitui o array bruto de leads
 *  no carregamento inicial. Payload alvo: < 5 KB (vs ~8 MB do array bruto).
 */
export interface LeadSummary {
  totalLeads: number;
  totalLeadsFiltered: number;
  avgScore: number | null;
  pctBolsao: number;
  bySituacao: LeadSummaryBySituacao[];
  byOrigem: LeadSummaryByOrigem[];
  byEmpreendimento: LeadSummaryByEmpreendimento[];
  byCorretor: LeadSummaryByCorretor[];
  monthly: LeadSummaryMonthly[];
  topTemperatura: { temperatura: string; total: number }[];
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
  | 'funil'
  | 'marketing'
  | 'publicar'
  | 'audiences'
  | 'links'
  | 'score'
  | 'trafego'
  | 'metrics'
  | 'insights'
  | 'intelligence'
  // ── Novas views do Marketing Vision refatorado ──
  | 'comando'
  | 'jornada'
  | 'ads'
  | 'assistente'
  | 'social'
  | 'integracoes';

// ── BI / Star Schema ──────────────────────────────────────────────────────────

export interface BiInsights {
  funnel: BiFunnelStage[];
  perDevelopment: BiPerDevelopment[];
  conversionTime: BiConversionTime[];
  campaignAttribution: BiCampaignAttribution[];
  monthlySeries: BiMonthlySeries[];
  metaPageInsights: BiPageInsights | null;
  summary: BiSummary;
  syncedAt: string;
}

export interface BiSummary {
  totalLeads: number;
  totalSales: number;
  totalVGV: number;
  avgTicket: number;
  avgConversionDays: number;
  totalSpend: number;
  cpl: number;
  cac: number;
  roas: number;
  leadsWithSale: number;
}

export interface BiFunnelStage {
  name: string;
  value: number;
  percentage: number;
}

export interface BiPerDevelopment {
  nome: string;
  leads: number;
  visits: number;
  reservations: number;
  sales: number;
  vgv: number;
  avgTicket: number;
  conversionPct: number;
  cpl: number;
}

export interface BiConversionTime {
  range: string;
  count: number;
  percentage: number;
}

export interface BiCampaignAttribution {
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  sales: number;
  revenue: number;
  cpl: number;
  cac: number;
  roas: number;
}

export interface BiMonthlySeries {
  month: string;
  leads: number;
  sales: number;
  vgv: number;
  spend: number;
}

export interface BiPageInsights {
  followers: number;
  instagramFollowers: number;
  profileViews: number;
  reach: number;
  engagement: number;
}
export interface DateRange {
  start: string;
  end: string;
}

// ── Funil Inteligente (cruzamento Leads + Reservas/Vendas) ────────────────────

export interface FunilConversionStep {
  label: string;
  value: number;
  percentage: number;
  color: string;
}

export interface FunilVgvByOrigin {
  origem: string;
  leads: number;
  reservas: number;
  vgv: number;
  cpl: number;
  roas: number;
  ticket_medio: number;
}

export interface FunilCycleByEmp {
  empreendimento: string;
  leads: number;
  reservas: number;
  avg_days_to_reserva: number | null;
  avg_days_to_venda: number | null;
  vgv: number;
}

export interface FunilMonthlySeries {
  month: string;
  leads: number;
  reservas: number;
  vgv: number;
}

export interface FunilTopCorretor {
  corretor: string;
  reservas: number;
  vgv: number;
  ticket_medio: number;
  cancelamentos: number;
}

export interface FunilIntelligenceData {
  steps: FunilConversionStep[];
  vgvByOrigin: FunilVgvByOrigin[];
  cycleByEmp: FunilCycleByEmp[];
  monthly: FunilMonthlySeries[];
  topCorretores: FunilTopCorretor[];
  summary: {
    totalLeads: number;
    totalReservas: number;
    totalVendas: number;
    totalVgv: number;
    avgTicket: number;
    avgDaysLeadToReserva: number | null;
    conversionRate: number;
    cancelamentos: number;
  };
}

// ── Integração de Plataformas (Hub de APIs) ───────────────────────────────────

export type IntegrationStatus = 'connected' | 'error' | 'disconnected' | 'pending';
export type IntegrationPlatform = 'meta' | 'google_ads' | 'google_business' | 'rd_station' | 'cv_crm' | 'other';

export interface Integration {
  id: string;
  platform: IntegrationPlatform;
  name: string;
  status: IntegrationStatus;
  accountId?: string;
  accountName?: string;
  lastSync?: string;
  errorMessage?: string;
  scopes?: string[];
}

export interface IntegrationInstructions {
  platform: IntegrationPlatform;
  steps: Array<{ step: number; title: string; description: string }>;
  fields: Array<{ key: string; label: string; type: 'text' | 'password'; placeholder?: string; helpText?: string }>;
  docsUrl?: string;
}

// ── Criativos de Campanhas ─────────────────────────────────────────────────────

export interface CampaignCreative {
  adId: string;
  adName: string;
  campaignId: string;
  campaignName: string;
  adsetName?: string;
  format: 'video' | 'image' | 'carousel' | 'story';
  thumbnailUrl?: string;
  videoId?: string;
  videoUrl?: string;
  title?: string;
  body?: string;
  callToAction?: string;
  targeting?: string;
}

// ── Score de Performance de Campanha ──────────────────────────────────────────

export type CampaignScore = 'good' | 'attention' | 'bad' | 'unknown';
export type CampaignStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'DELETED';

export interface CampaignPerformance {
  campaignId: string;
  campaignName: string;
  status: CampaignStatus;
  score: CampaignScore;
  spend: number;
  leads: number;
  cpl: number;
  ctr: number;
  roas: number;
  impressions: number;
  clicks: number;
  budget?: number;
  startDate?: string;
}

// ── Insights de IA ────────────────────────────────────────────────────────────

export type AIInsightType = 'warning' | 'success' | 'opportunity' | 'info' | 'critical';
export type AIInsightAction = 'pause_campaign' | 'increase_budget' | 'review_creative' | 'sync_leads' | 'custom';

export interface AIInsight {
  id: string;
  type: AIInsightType;
  title: string;
  description: string;
  action?: AIInsightAction;
  actionLabel?: string;
  actionPayload?: Record<string, unknown>;
  generatedAt: string;
  source: 'rule' | 'gemini';
  dismissed?: boolean;
}
