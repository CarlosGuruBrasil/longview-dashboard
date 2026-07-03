/**
 * Construpoint API Client — Quality Vision
 *
 * Autenticação via OAuth2 (password grant) com Basic Auth.
 * Credenciais configuradas via variáveis de ambiente do Coolify:
 *   CONSTRUPOINT_BASIC_AUTH   — header Authorization Basic ...
 *   CONSTRUPOINT_USERNAME     — adminapi_longview@e-construmarket.com.br
 *   CONSTRUPOINT_PASSWORD     — *GSuG8U8
 *
 * Endpoints:
 *   Relatório customizado por modelo — fichas por tipo + período
 *   InspecoesPorRange                 — inspeções paginadas por ano
 *   VerificacoesPorModeloCustom       — verificações com resultado
 */

const AUTH_URL  = 'https://Authenticate.construpoint.com.br/api/Token';
const BASE_URL  = 'https://apiext.construpoint.com.br/api/RelatorioCKL';
const MODEL_REPORT_ENDPOINT = `InspecoesPorModeloCustom${String.fromCharCode(81, 117, 97, 108, 105, 100, 97, 100, 101)}`;

/** A API retorna datas em "DD/MM/AAAA" ou "DD/MM/AAAA HH:mm:ss" — new Date() do JS interpreta errado (assume MM/DD). */
export function parseConstrupointDate(value: unknown): Date | null {
  if (!value) return null;
  const str = String(value).trim();
  const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2}):(\d{2}))?$/);
  if (m) {
    const [, day, month, year, hh = '00', mm = '00', ss = '00'] = m;
    const d = new Date(Number(year), Number(month) - 1, Number(day), Number(hh), Number(mm), Number(ss));
    return isNaN(d.getTime()) ? null : d;
  }
  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
}

// Tipos de ficha Construpoint
export const MODEL_TYPES = {
  FVS: 1,
  FVM: 2,
  CHK: 3,
  SEG: 5,
  MA:  6,
  EDU: 7,
} as const;

export type ModelTypeKey = keyof typeof MODEL_TYPES;

// --- Tipos de retorno ---

export interface ConstrupointToken {
  access_token: string;
  expires_in: number;
  token_type: string;
}

/**
 * A API retorna chaves ACENTUADAS ("Código", "Criação", "Verificação"...) —
 * confirmado nos prints reais do Postman da doc oficial. Os tipos abaixo são
 * Record e o consumo usa cpField()/cpName(), que aceitam as duas grafias.
 */
export type Inspecao = Record<string, unknown>;

/** Primeiro valor não-vazio entre as variações de chave (com/sem acento). */
export function cpField<T = unknown>(obj: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== '') return v as T;
  }
  return undefined;
}

/** Campos de nome vêm ora como string, ora como objeto { Id, Nome } / { Id, Name }. */
export function cpName(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if (typeof o.Nome === 'string') return o.Nome;
    if (typeof o.Name === 'string') return o.Name;
  }
  return null;
}

export interface InspecaoPorRange {
  Id: number;
  Code?: string;
  Model?: { Id: number; Name: string };
  ProviderFantasyName?: string;
  Work?: { Id: number; Name: string };
  Location?: { Id: number; Name: string };
  Inspector?: { Id: number; Name: string };
  Status?: { Id: number; Name: string };
  StatusId?: number;
  CreateDate?: string;
  ScheduleDate?: string;
  UpdateDate?: string;
  WeightedGrade?: number;
}

export type Verificacao = Record<string, unknown>;

// --- Cache de token em memória (válido por duration-60s) ---
let _cachedToken: string | null = null;
let _tokenExpiry: number = 0;

async function getToken(): Promise<string> {
  if (_cachedToken && Date.now() < _tokenExpiry) return _cachedToken;

  const basicAuth = process.env.CONSTRUPOINT_BASIC_AUTH;
  const username  = process.env.CONSTRUPOINT_USERNAME;
  const password  = process.env.CONSTRUPOINT_PASSWORD;
  if (!basicAuth || !username || !password) {
    throw new Error('Construpoint credentials are not configured.');
  }

  console.log('Fetching token for user:', username);
  const body = new URLSearchParams({
    grant_type: 'password',
    username,
    password,
  });

  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Construpoint auth failed: ${res.status} ${errText}`);
  }

  const data: ConstrupointToken = await res.json();
  console.log('Token successfully fetched, expires in:', data.expires_in);
  _cachedToken = data.access_token;
  _tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return _cachedToken;
}

async function authHeaders(): Promise<HeadersInit> {
  const token = await getToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

// --- Endpoint 1: relatório customizado por modelo ---
export interface InspecoesParams {
  BeginDate: string;       // 'YYYY-MM-DD'
  EndDate: string;         // 'YYYY-MM-DD'
  ModelTypeId: number;     // 1,2,3,5,6,7
  StatusVerificacoesId?: number;
  HistoricoCompleto?: boolean;
  CamposPersonalizados?: boolean;
  WorkId?: number[];
  ReviewId?: number[];
}

export async function getInspections(params: InspecoesParams): Promise<Inspecao[]> {
  const headers = await authHeaders();
  const body = {
    BeginDate: params.BeginDate,
    EndDate: params.EndDate,
    ModelTypeId: params.ModelTypeId,
    StatusVerificacoesId: params.StatusVerificacoesId ?? 0,
    HistoricoCompleto: params.HistoricoCompleto ?? false,
    CamposPersonalizados: params.CamposPersonalizados ?? false,
    WorkId: params.WorkId ?? [],
    ReviewId: params.ReviewId ?? [],
  };

  const res = await fetch(`${BASE_URL}/${MODEL_REPORT_ENDPOINT}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`${MODEL_REPORT_ENDPOINT}: ${res.status} - ${errText}`);
  }
  return res.json();
}

// --- Endpoint 2: InspecoesPorRange ---
export interface InspecoesByRangeParams {
  StartYear: number;
  EndYear: number;
  Page?: number;
  PageSize?: number;
  ModelType: number;
  OnlyActiveWorks?: boolean;
}

export interface InspecoesByRangeResponse {
  Items: InspecaoPorRange[];
  TotalCount: number;
  Page: number;
  PageSize: number;
}

export async function getInspectionsByRange(params: InspecoesByRangeParams): Promise<InspecoesByRangeResponse> {
  const headers = await authHeaders();
  // Este endpoint recebe os filtros via query string, não JSON body.
  const qs = new URLSearchParams({
    startYear: String(params.StartYear),
    endYear: String(params.EndYear),
    page: String(params.Page ?? 1),
    pageSize: String(params.PageSize ?? 500),
    modelType: String(params.ModelType),
    onlyActiveWorks: String(params.OnlyActiveWorks ?? true),
  });
  const res = await fetch(`${BASE_URL}/InspecoesPorRange?${qs.toString()}`, {
    method: 'POST',
    headers,
  });
  if (!res.ok) throw new Error(`InspecoesPorRange: ${res.status}`);
  return res.json();
}

// --- Endpoint 3: VerificacoesPorModeloCustom ---
export interface VerificacoesParams {
  BeginDate: string;
  EndDate: string;
  ModelTypeId: number;
  StatusVerificacoesId?: number;
  HistoricoCompleto?: boolean;
  CamposPersonalizados?: boolean;
  WorkId?: number[];
  ReviewId?: number[];
}

export async function getVerifications(params: VerificacoesParams): Promise<Verificacao[]> {
  const headers = await authHeaders();
  const res = await fetch(`${BASE_URL}/VerificacoesPorModeloCustom`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      BeginDate: params.BeginDate,
      EndDate: params.EndDate,
      ModelTypeId: params.ModelTypeId,
      StatusVerificacoesId: params.StatusVerificacoesId ?? 0,
      HistoricoCompleto: params.HistoricoCompleto ?? false,
      CamposPersonalizados: params.CamposPersonalizados ?? false,
      WorkId: params.WorkId ?? [],
      ReviewId: params.ReviewId ?? [],
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`VerificacoesPorModeloCustom: ${res.status} - ${errText}`);
  }
  return res.json();
}
