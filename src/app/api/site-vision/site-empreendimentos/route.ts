import { NextRequest, NextResponse } from 'next/server';
import { verifyPermission } from '@/lib/auth';
import { fetchEmpreendimentosPublicos, createEmpreendimentoManual } from '@/lib/site-longview-client';
import logger from '@/lib/logger';

// Empreendimentos do site real (site-longview) — CV CRM + manuais juntos. Fonte
// de verdade e o site, nao uma tabela local, pra nunca ficar dessincronizado.
export async function GET() {
  const user = await verifyPermission('viewSiteVision');
  if (!user) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  const empreendimentos = await fetchEmpreendimentosPublicos();
  return NextResponse.json({ empreendimentos });
}

export async function POST(request: NextRequest) {
  const user = await verifyPermission('viewSiteVision');
  if (!user) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  try {
    const body = await request.json();
    if (!body.nome || !body.endereco || !body.cidade || !body.estado) {
      return NextResponse.json({ error: 'nome, endereco, cidade e estado sao obrigatorios.' }, { status: 400 });
    }

    const result = await createEmpreendimentoManual(body);
    return NextResponse.json(result);
  } catch (error) {
    logger.error({ error }, '[site-vision/site-empreendimentos] erro ao criar empreendimento manual:');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao criar empreendimento.' },
      { status: 502 }
    );
  }
}
