import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/pg';
import { verifyPermission } from '@/lib/auth';
import logger from '@/lib/logger'

export const runtime = 'nodejs';
export const revalidate = 0;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Ocorrências individuais por trás de uma linha de "falha sistêmica" (verificação + modelo) —
// cada uma linkada de volta pro id da inspeção, pra abrir o InspecaoDetailModal.
export async function GET(req: Request) {
  const user = await verifyPermission('viewQualityVision');
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const verificacao = searchParams.get('verificacao');
  const modelo = searchParams.get('modelo');
  if (!verificacao || !modelo) return NextResponse.json({ error: 'verificacao e modelo são obrigatórios' }, { status: 400 });

  const obra = searchParams.get('obra') || null;
  const inspetor = searchParams.get('inspetor') || null;

  try {
    await ensureSchema();

    const rows = await sql`
      SELECT v.codigo, v.obra, v.inspetor, v.data, v.problema, v.solucao, i.id as inspecao_id
      FROM construpoint_verificacoes v
      LEFT JOIN construpoint_inspecoes i ON i.code = v.codigo
      WHERE v.resultado = 'Reprovado' AND v.verificacao = ${verificacao} AND v.modelo = ${modelo}
        AND v.data >= now() - interval '180 days'
        ${obra ? sql`AND v.obra = ${obra}` : sql``}
        ${inspetor ? sql`AND v.inspetor = ${inspetor}` : sql``}
      ORDER BY v.data DESC
      LIMIT 200
    `;

    return NextResponse.json({
      ocorrencias: rows.map(r => ({
        codigo: r.codigo,
        obra: r.obra,
        inspetor: r.inspetor,
        data: r.data,
        problema: r.problema,
        solucao: r.solucao,
        inspecaoId: r.inspecao_id,
      })),
    });
  } catch (error: unknown) {
    logger.error({ error }, '[API/construpoint/intelligence/item]');
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
