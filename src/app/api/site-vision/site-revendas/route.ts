import { NextRequest, NextResponse } from 'next/server';
import { verifyPermission } from '@/lib/auth';
import { createRevendaByEmpId } from '@/lib/site-longview-client';
import logger from '@/lib/logger';

// Cria revenda no site real por empreendimentoId direto — funciona pra
// empreendimento manual ou CV CRM, ao contrario do fluxo antigo (baseado em
// converter uma unidade vendida do CRM) que so aceita CV CRM.
export async function POST(request: NextRequest) {
  const user = await verifyPermission('viewSiteVision');
  if (!user) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  try {
    const body = await request.json();
    if (!body.empreendimentoId || !body.titulo) {
      return NextResponse.json({ error: 'empreendimentoId e titulo sao obrigatorios.' }, { status: 400 });
    }

    const result = await createRevendaByEmpId(body);
    return NextResponse.json(result);
  } catch (error) {
    logger.error({ error }, '[site-vision/site-revendas] erro ao criar revenda:');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao criar revenda.' },
      { status: 502 }
    );
  }
}
