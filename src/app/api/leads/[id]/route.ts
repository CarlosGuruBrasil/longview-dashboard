import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import logger from '@/lib/logger'

const JWT_SECRET = process.env.JWT_SECRET ?? (() => { throw new Error('[LongView] JWT_SECRET nao configurado. Defina no .env.local') })();

type AuthUser = {
  role?: string;
  email?: string;
  name?: string;
  permissions?: {
    viewMarketingDashboard?: boolean;
  };
};

type LeadContact = {
  email?: string;
  nome?: string;
};

type LeadRaw = {
  nome?: string;
  email?: string;
  telefone?: string;
  situacao?: { id?: number; nome?: string };
  corretor?: LeadContact;
  gestor?: LeadContact;
  imobiliaria?: LeadContact;
  _crm?: { id?: string | number };
  idlead?: string | number;
  id?: string | number;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isString(value: string | undefined): value is string {
  return Boolean(value);
}

async function verifyAuth(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return null;
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch { return null; }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await verifyAuth();
  if (!authUser) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

  const canAccessMarketing =
    authUser.role === 'Desenvolvedor' ||
    authUser.permissions?.viewMarketingDashboard === true;

  if (!canAccessMarketing) {
    return NextResponse.json({ error: 'Sem permissão para acessar o Marketing Vision.' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const { sql, ensureSchema } = await import('@/lib/pg');
    await ensureSchema();

    const rows = await sql`
      SELECT raw FROM leads
      WHERE id = ${id}
      LIMIT 1
    `;

    if (!rows[0]) {
      return NextResponse.json({ error: 'Lead não encontrado.' }, { status: 404 });
    }

    // A coluna raw já é salva como JSONB, e o driver postgres o retorna como objeto/array nativo.
    const lead = rows[0].raw as LeadRaw;

    // Validação de escopo por papel (assim como em /api/data)
    const PRIVILEGED = ['Gestor', 'Diretoria', 'Desenvolvedor'];
    if (!PRIVILEGED.includes(String(authUser.role || ''))) {
      const myEmail = String(authUser.email || '').toLowerCase().trim();
      const myName  = String(authUser.name  || '').toLowerCase().trim();
      
      const corretorEmail = lead.corretor?.email?.toLowerCase().trim();
      const gestorEmail = lead.gestor?.email?.toLowerCase().trim();
      const corretorNome = lead.corretor?.nome?.toLowerCase().trim();
      const gestorNome = lead.gestor?.nome?.toLowerCase().trim();

      const emails = [corretorEmail, gestorEmail].filter(isString);
      const names = [corretorNome, gestorNome].filter(isString);

      const hasEmailAccess = myEmail && emails.includes(myEmail);
      const hasNameAccess = myName && names.includes(myName);

      if (!hasEmailAccess && !hasNameAccess) {
        return NextResponse.json({ error: 'Sem permissão para acessar este lead.' }, { status: 403 });
      }
    }

    return NextResponse.json({ ok: true, lead });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await verifyAuth();
  if (!authUser) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

  const canAccessMarketing =
    authUser.role === 'Desenvolvedor' ||
    authUser.permissions?.viewMarketingDashboard === true;

  if (!canAccessMarketing) {
    return NextResponse.json({ error: 'Sem permissão para acessar o Marketing Vision.' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { sql, ensureSchema } = await import('@/lib/pg');
    const axios = (await import('axios')).default;
    await ensureSchema();

    // 1. Buscar o lead atual no banco local
    const rows = await sql`SELECT raw FROM leads WHERE id = ${id} LIMIT 1`;
    if (!rows[0]) {
      return NextResponse.json({ error: 'Lead não encontrado.' }, { status: 404 });
    }

    const oldRaw = (rows[0].raw ?? {}) as LeadRaw;

    // 2. Resolver o idlead do CRM
    let idleadCrm: string | number = id;
    if (id.startsWith('meta_')) {
      const crm = oldRaw._crm;
      idleadCrm = String(crm?.id ?? oldRaw.idlead ?? oldRaw.id ?? id);
    }

    if (!idleadCrm || String(idleadCrm).startsWith('meta_')) {
      // Se ainda for meta_, não temos ID de CRM para atualizar
      return NextResponse.json({ error: 'Este lead do Meta Ads ainda não foi sincronizado com o CV CRM. Sincronize-o primeiro na aba Validação Meta.' }, { status: 400 });
    }

    // 3. Enviar atualização para a API comercial do CV CRM
    const email = process.env.CV_CRM_EMAIL;
    const token = process.env.CV_CRM_TOKEN;
    if (!email || !token) {
      return NextResponse.json({ error: 'Credenciais do CRM não configuradas.' }, { status: 500 });
    }

    logger.info(`[edit-lead] Atualizando lead $ no CV CRM...`);
    
    const payload: Record<string, unknown> = {
      idlead: Number(idleadCrm),
      permitir_alteracao: true,
      nome: body.nome || oldRaw.nome,
      email: body.email ?? oldRaw.email ?? undefined,
      telefone: body.telefone ?? oldRaw.telefone ?? undefined,
    };

    if (body.idsituacao) payload.idsituacao = Number(body.idsituacao);
    if (body.idcorretor) payload.idcorretor = Number(body.idcorretor);
    if (body.idusuario) payload.idusuario = Number(body.idusuario); // gestor
    if (body.idimobiliaria) payload.idimobiliaria = Number(body.idimobiliaria);

    await axios.post(
      'https://longviewempreendimentos.cvcrm.com.br/api/v1/comercial/leads',
      payload,
      {
        headers: { email, token, Accept: 'application/json', 'Content-Type': 'application/json' },
        timeout: 15000
      }
    );

    // 4. Montar o novo raw para o banco Postgres local
    const newRaw = {
      ...oldRaw,
      nome: payload.nome,
      email: payload.email,
      telefone: payload.telefone,
      situacao: body.idsituacao
        ? { id: Number(body.idsituacao), nome: body.nomeSituacao || oldRaw.situacao?.nome }
        : oldRaw.situacao,
      corretor: body.idcorretor
        ? { id: Number(body.idcorretor), nome: body.nomeCorretor || oldRaw.corretor?.nome }
        : oldRaw.corretor,
      gestor: body.idusuario
        ? { id: Number(body.idusuario), nome: body.nomeGestor || oldRaw.gestor?.nome }
        : oldRaw.gestor,
      imobiliaria: body.idimobiliaria
        ? { id: Number(body.idimobiliaria), nome: body.nomeImobiliaria || oldRaw.imobiliaria?.nome }
        : oldRaw.imobiliaria,
    };

    // 5. Atualizar no Postgres local
    await sql`
      UPDATE leads 
      SET 
        nome = ${payload.nome as string | null},
        email = ${(payload.email as string) || null},
        telefone = ${(payload.telefone as string) || null},
        status = ${newRaw.situacao?.nome || null},
        raw = ${newRaw as never},
        data_atualizacao = NOW(),
        synced_at = NOW()
      WHERE id = ${id}
    `;

    logger.info(`[edit-lead] Lead $ atualizado com sucesso local e no CRM.`);

    return NextResponse.json({ ok: true, lead: newRaw });

  } catch (err: unknown) {
    const axiosErr = err && typeof err === 'object' && 'response' in err
      ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
      : null;
    const msg = axiosErr || (err instanceof Error ? err.message : String(err));
    logger.error({ errorMsg: msg }, '[edit-lead] Erro ao editar lead:');
    return NextResponse.json({ ok: false, error: `Erro no CRM: ${msg}` }, { status: 500 });
  }
}
