import { NextResponse, NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { sql, ensureSchema } from '@/lib/pg';

const JWT_SECRET = process.env.JWT_SECRET ?? (() => { throw new Error('[LongView] JWT_SECRET nao configurado. Defina no .env.local') })();
export const runtime = 'nodejs';
export const revalidate = 0;

type AuthUser = { role?: string; email?: string; name?: string };

type VendaRow = {
  raw: unknown;
};

// Reserva do endpoint /comercial/reservas — campos que usamos
type CvReserva = {
  situacao?: { idsituacao?: number; situacao?: string };
  unidade?: { empreendimento?: string; idempreendimento_cv?: number; idunidade_cv?: number; unidade?: string; tipologia?: string; bloco?: string };
  titular?: { nome?: string; email?: string; telefone?: string; celular?: string; documento?: string };
  corretor?: { corretor?: string; email?: string; idcorretor_cv?: number };
  imobiliaria?: { nome?: string };
  condicoes?: { valor_contrato?: string | number; vgv_tabela?: string | number | null };
  leads_associados?: { idlead?: number | string; data_cad?: string }[];
  vendida?: unknown;
  data?: string;
  data_venda?: string | null;
  data_contrato?: string | null;
  data_cancelamento?: string | null;
  data_distrato?: string | null;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function verifyAuth(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return null;
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch { return null; }
}

// Busca todas as reservas do funil de reservas do CV CRM.
// O CVDW (/api/v1/cvdw/*) retorna 403 com o token atual — a fonte real é /comercial/reservas.
async function fetchAllReservas(email: string, token: string): Promise<Record<string, CvReserva>> {
  const headers = { email, token, Accept: 'application/json' };
  try {
    const res = await axios.get<Record<string, CvReserva>>(
      'https://longviewempreendimentos.cvcrm.com.br/api/v1/comercial/reservas',
      { params: { situacao: 'todas' }, headers, timeout: 45000 }
    );
    return res.data && typeof res.data === 'object' ? res.data : {};
  } catch (err: unknown) {
    console.error('[/api/cv/vendas] Erro ao buscar reservas do CV:', errorMessage(err));
    return {};
  }
}

async function syncReservas(email: string, token: string): Promise<number> {
  const reservas = await fetchAllReservas(email, token);
  const ids = Object.keys(reservas);
  if (ids.length === 0) return 0;

  // Fallback de valor: 95% das reservas vêm com valor_contrato = 0 do CV.
  // Cadeia: valor_contrato → valor_venda do lead associado → valor de tabela da unidade.
  const unidadeValores = new Map<number, number>();
  const unidadeRows = await sql<{ id: number; valor: string | null }[]>`SELECT id, valor FROM cv_unidades`;
  unidadeRows.forEach(u => { if (u.valor != null) unidadeValores.set(Number(u.id), Number(u.valor)); });

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

    // raw normalizado — mantém os nomes de campo que o funil-intelligence consulta
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
      _reserva: r, // payload original completo do CV
    };

    await sql`
      INSERT INTO cv_vendas (
        id, id_empreendimento, id_unidade, valor, data_venda, status, raw, synced_at
      ) VALUES (
        ${id},
        ${r.unidade?.idempreendimento_cv ?? null},
        ${idUnidade},
        ${valor || null},
        ${dataVenda},
        ${situacao},
        ${raw as never},
        NOW()
      ) ON CONFLICT (id) DO UPDATE SET
        id_empreendimento = EXCLUDED.id_empreendimento,
        id_unidade = EXCLUDED.id_unidade,
        valor = EXCLUDED.valor,
        data_venda = EXCLUDED.data_venda,
        status = EXCLUDED.status,
        raw = EXCLUDED.raw,
        synced_at = EXCLUDED.synced_at
    `;
    upserted++;
  }
  console.log(`[api/cv/vendas] ${upserted} reservas sincronizadas do funil de reservas`);
  return upserted;
}

export async function GET(request: NextRequest) {
  const authUser = await verifyAuth();
  if (!authUser) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get('refresh') === 'true';

  try {
    await ensureSchema();

    const email = process.env.CV_CRM_EMAIL;
    const token = process.env.CV_CRM_TOKEN;

    // Sincroniza quando pedido explicitamente ou quando a tabela está vazia/velha (>6h)
    if (email && token) {
      const [freshness] = await sql<{ n: number; age_min: number | null }[]>`
        SELECT COUNT(*)::int AS n,
               EXTRACT(EPOCH FROM (NOW() - MAX(synced_at)))/60 AS age_min
        FROM cv_vendas
      `;
      const stale = !freshness?.n || (freshness.age_min ?? Infinity) > 360;
      if (forceRefresh || stale) {
        await syncReservas(email, token);
      }
    }

    const rows = await sql`
      SELECT raw
      FROM cv_vendas
      ORDER BY data_venda DESC NULLS LAST
    `;

    const parseItem = (value: unknown): unknown => {
      let current = value;
      while (typeof current === 'string' && (current.trim().startsWith('{') || current.trim().startsWith('['))) {
        try {
          const parsed = JSON.parse(current);
          if (parsed === current) break;
          current = parsed;
        } catch {
          break;
        }
      }
      return current;
    };
    const vendas = (rows as unknown as VendaRow[]).map((r) => parseItem(r.raw));

    return NextResponse.json({ vendas, total: vendas.length, _cached: false });
  } catch (err: unknown) {
    console.error('[/api/cv/vendas] Erro ao buscar vendas do postgres:', errorMessage(err));
    return NextResponse.json({ error: 'Erro ao buscar vendas', vendas: [], total: 0 }, { status: 500 });
  }
}
