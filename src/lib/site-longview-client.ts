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
