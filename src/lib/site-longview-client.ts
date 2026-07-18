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
