import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'secret-longview-key';

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
  corretor?: LeadContact;
  gestor?: LeadContact;
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
