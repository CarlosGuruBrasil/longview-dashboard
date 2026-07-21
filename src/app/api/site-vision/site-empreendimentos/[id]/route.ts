import { NextResponse } from 'next/server';
import { verifyPermission } from '@/lib/auth';
import { fetchEmpreendimentoDetailById } from '@/lib/site-longview-client';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await verifyPermission('viewSiteVision');
  if (!user) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  const { id } = await params;
  const empId = Number(id);
  if (!Number.isFinite(empId)) {
    return NextResponse.json({ error: 'ID invalido.' }, { status: 400 });
  }

  const empreendimento = await fetchEmpreendimentoDetailById(empId);
  if (!empreendimento) {
    return NextResponse.json({ error: 'Empreendimento nao encontrado no site real.' }, { status: 404 });
  }
  return NextResponse.json({ empreendimento });
}
