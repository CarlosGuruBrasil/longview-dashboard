// Cliente para o site público real (repo separado "SITE LONGVIEW", Express+Postgres próprio).
// Site Vision empurra dados pra lá via HTTP autenticado por token de serviço.

const BASE_URL = process.env.SITE_LONGVIEW_BASE_URL ?? '';
const SYNC_TOKEN = process.env.SITE_LONGVIEW_SYNC_TOKEN ?? '';

function assertConfigured() {
  if (!BASE_URL || !SYNC_TOKEN) {
    throw new Error('SITE_LONGVIEW_BASE_URL / SITE_LONGVIEW_SYNC_TOKEN não configurados no .env.');
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  assertConfigured();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-sync-token': SYNC_TOKEN,
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error || `Site LongView respondeu ${res.status}`);
  }
  return body as T;
}

export function triggerCvCrmSync() {
  return call<{ success: boolean; synced: number }>('/api/cv-crm/sync', { method: 'POST' });
}

export function pushMidia(cvCrmId: number, params: { tipo: 'foto' | 'video'; dataUrl: string; descricao?: string; ordem?: number }) {
  return call<{ success: boolean; midia: { id: number; url_storage: string } }>(
    `/api/admin/empreendimentos/${cvCrmId}/midias`,
    { method: 'POST', body: JSON.stringify(params) }
  );
}

export function deleteMidia(midiaId: number) {
  return call<{ success: boolean }>(`/api/admin/midias/${midiaId}`, { method: 'DELETE' });
}

export type UnidadePush = {
  numero: string;
  tipo?: string;
  dormitorios?: number | null;
  banheiros?: number | null;
  vagas?: number | null;
  planta_url?: string | null;
  area_privativa?: number | null;
  area_comum?: number | null;
  area_total?: number | null;
  preco?: number | null;
  status?: 'disponivel' | 'reservado' | 'vendido' | 'indisponivel';
  andar?: number | null;
  bloco?: string | null;
  observacoes?: string | null;
};

export function pushUnidades(cvCrmId: number, unidades: UnidadePush[]) {
  return call<{ success: boolean; upserted: number }>(
    `/api/admin/empreendimentos/${cvCrmId}/unidades`,
    { method: 'PUT', body: JSON.stringify({ unidades }) }
  );
}

export type UsuarioPush = {
  nome: string;
  email: string;
  telefone?: string | null;
  creci?: string | null;
  cargo?: string | null;
  ativo?: boolean;
};

export function pushUsuarios(usuarios: UsuarioPush[]) {
  return call<{ success: boolean; upserted: number }>('/api/admin/usuarios', {
    method: 'PUT',
    body: JSON.stringify({ usuarios }),
  });
}

export type EmpreendimentoConfigPush = Partial<{
  descricaoCurta: string;
  descricao: string;
  logoUrl: string;
  videoUrl: string;
  vagasLabel: string;
  ativo: boolean;
}>;

export function pushEmpreendimentoConfig(cvCrmId: number, params: EmpreendimentoConfigPush) {
  return call<{ success: boolean }>(`/api/admin/empreendimentos/${cvCrmId}`, {
    method: 'PUT',
    body: JSON.stringify(params),
  });
}

export type EmpreendimentoPublicState = {
  id: number;
  cv_crm_id: number;
  nome: string;
  descricao: string | null;
  descricao_curta: string | null;
  logo_url: string | null;
  video_url: string | null;
  vagas_label: string | null;
  ativo: boolean;
  midias: Array<{ id: number; tipo: 'foto' | 'video'; url_storage: string; url_thumb: string | null; descricao: string | null; ordem: number }>;
  unidades: Array<{ id: number; numero: string; status: string }>;
  materiais?: Array<{ id: number; tipo: string; titulo: string; url_storage: string; origem: string }>;
};

// GET público (sem auth) do site real — a "verdade" do que está de fato ao vivo, pra não
// depender de tabelas locais do dashboard que podem ficar desatualizadas/vazias.
export async function fetchEmpreendimentoPublicState(cvCrmId: number): Promise<EmpreendimentoPublicState | null> {
  if (!BASE_URL) return null;
  try {
    // by=cv_crm_id desambigua: id (PK) e cv_crm_id sao numeracoes independentes que podem colidir.
    const res = await fetch(`${BASE_URL}/api/empreendimentos/${cvCrmId}?by=cv_crm_id`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as EmpreendimentoPublicState;
  } catch {
    return null;
  }
}

export type MaterialPush =
  | { tipo: 'material' | 'planta' | 'ebook'; titulo: string; descricao?: string; url: string }
  | { tipo: 'material' | 'planta' | 'ebook'; titulo: string; descricao?: string; dataUrl: string };

export function pushMaterial(cvCrmId: number, params: MaterialPush) {
  return call<{ success: boolean; material: { id: number; titulo: string; url_storage: string } }>(
    `/api/admin/empreendimentos/${cvCrmId}/materiais`,
    { method: 'POST', body: JSON.stringify(params) }
  );
}

export function deleteMaterial(materialId: number) {
  return call<{ success: boolean }>(`/api/admin/materiais/${materialId}`, { method: 'DELETE' });
}

export type RevendaPush = {
  unidadeNumero?: string;
  titulo: string;
  preco?: number | null;
  descricao?: string;
  corretorNome?: string;
  corretorTelefone?: string;
  corretorEmail?: string;
  posicao?: string;
  vagas?: number | null;
};

export function pushRevenda(cvCrmId: number, params: RevendaPush) {
  return call<{ success: boolean; revenda: { id: number; titulo: string; preco: number | null; status: string } }>(
    `/api/admin/empreendimentos/${cvCrmId}/revendas`,
    { method: 'POST', body: JSON.stringify(params) }
  );
}

export function deleteRevendaRemota(revendaId: number) {
  return call<{ success: boolean }>(`/api/admin/revendas/${revendaId}`, { method: 'DELETE' });
}

// ── Empreendimento manual (nao vem do CV CRM) + revenda por empreendimentoId ──
// Complementa o fluxo acima (que so aceita cvCrmId) pra suportar projetos que
// existem no site mas nunca foram sincronizados do CV CRM (ex: empreendimentos
// antigos, so com link pro site legado).

export type EmpreendimentoManualPush = {
  nome: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep?: string;
  descricao?: string;
  descricaoCurta?: string;
  logoUrl?: string;
  videoUrl?: string;
};

export function createEmpreendimentoManual(params: EmpreendimentoManualPush) {
  return call<{ success: boolean; empreendimento: { id: number; nome: string; slug: string } }>(
    '/api/admin/empreendimentos',
    { method: 'POST', body: JSON.stringify(params) }
  );
}

export type RevendaByEmpIdPush = {
  empreendimentoId: number;
  titulo: string;
  preco?: number | null;
  descricao?: string;
  corretorNome?: string;
  corretorTelefone?: string;
  corretorEmail?: string;
  posicao?: string;
  vagas?: number | null;
  areaPrivativa?: number | null;
  areaTotal?: number | null;
  dormitorios?: number | null;
  suites?: number | null;
  andar?: number | null;
  bloco?: string;
};

export function createRevendaByEmpId(params: RevendaByEmpIdPush) {
  return call<{ success: boolean; revenda: { id: number; slug: string; titulo: string; preco: number | null; status: string } }>(
    '/api/admin/revendas',
    { method: 'POST', body: JSON.stringify(params) }
  );
}

export function pushRevendaMidia(revendaId: number, params: { tipo: 'foto' | 'planta' | 'documento'; dataUrl: string; ordem?: number }) {
  return call<{ success: boolean; midia: { id: number; tipo: string; url_storage: string; ordem: number } }>(
    `/api/admin/revendas/${revendaId}/midias`,
    { method: 'POST', body: JSON.stringify(params) }
  );
}

export function deleteRevendaMidiaRemota(midiaId: number) {
  return call<{ success: boolean }>(`/api/admin/revenda-midias/${midiaId}`, { method: 'DELETE' });
}

export type RevendaPublica = {
  id: number;
  slug: string;
  titulo: string;
  descricao: string | null;
  posicao: string | null;
  vagas: number | null;
  status: string;
  dormitorios: number | null;
  area_privativa: string | null;
  area_total: string | null;
  suites: number | null;
  andar: number | null;
  bloco: string | null;
  corretor_nome: string | null;
  corretor_telefone: string | null;
  corretor_email: string | null;
  empreendimento: { id: number; nome: string; slug: string; cidade: string; estado: string };
  midias: Array<{ id: number; tipo: 'foto' | 'planta' | 'documento'; url_storage: string; ordem: number }>;
};

export async function fetchRevendaPublica(slug: string): Promise<RevendaPublica | null> {
  if (!BASE_URL) return null;
  try {
    const res = await fetch(`${BASE_URL}/api/revendas/${slug}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as RevendaPublica;
  } catch {
    return null;
  }
}

export type EmpreendimentoListItem = {
  id: number;
  nome: string;
  slug: string;
  cidade: string;
  estado: string;
  origem: 'cvcrm' | 'manual';
  ordem: number;
};

export async function fetchEmpreendimentosPublicos(): Promise<EmpreendimentoListItem[]> {
  if (!BASE_URL) return [];
  try {
    const res = await fetch(`${BASE_URL}/api/empreendimentos`, { cache: 'no-store' });
    if (!res.ok) return [];
    return (await res.json()) as EmpreendimentoListItem[];
  } catch {
    return [];
  }
}

export type EmpreendimentoDetailPublico = EmpreendimentoListItem & {
  revendas: Array<{ id: number; slug: string; titulo: string; preco: number | null; status: string }>;
};

// Busca por ID interno (PK), nao por cv_crm_id — funciona pra empreendimento manual
// (que nao tem cv_crm_id) e pra CV CRM igual.
export async function fetchEmpreendimentoDetailById(id: number): Promise<EmpreendimentoDetailPublico | null> {
  if (!BASE_URL) return null;
  try {
    const res = await fetch(`${BASE_URL}/api/empreendimentos/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as EmpreendimentoDetailPublico;
  } catch {
    return null;
  }
}

export type EmpreendimentoManualUpdate = Partial<EmpreendimentoManualPush> & { ordem?: number; ativo?: boolean };

export function updateEmpreendimentoManual(id: number, params: EmpreendimentoManualUpdate) {
  return call<{ success: boolean; empreendimento: { id: number; nome: string; slug: string } }>(
    `/api/admin/empreendimentos/${id}`,
    { method: 'PATCH', body: JSON.stringify(params) }
  );
}

export type RevendaUpdate = Partial<Omit<RevendaByEmpIdPush, 'empreendimentoId'>> & { status?: 'disponivel' | 'vendida' };

export function updateRevenda(id: number, params: RevendaUpdate) {
  return call<{ success: boolean }>(`/api/admin/revendas/${id}`, { method: 'PATCH', body: JSON.stringify(params) });
}

export function reorderRevendaMidias(revendaId: number, ordem: Array<{ id: number; ordem: number }>) {
  return call<{ success: boolean }>(
    `/api/admin/revendas/${revendaId}/midias/ordem`,
    { method: 'PUT', body: JSON.stringify({ ordem }) }
  );
}
