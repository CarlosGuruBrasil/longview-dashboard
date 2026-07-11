import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/pg';
import { verifyPermission } from '@/lib/auth';
import logger from '@/lib/logger'

export const runtime = 'nodejs';
export const revalidate = 0;

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await verifyPermission('viewQualityVision');
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id } = await params;
  const inspId = parseInt(id, 10);
  if (!Number.isFinite(inspId)) return NextResponse.json({ error: 'Id inválido' }, { status: 400 });

  try {
    await ensureSchema();

    const rows = await sql`
      SELECT id, code, modelo, obra, local, inspetor, status,
             data_criacao, data_agendamento, data_atualizacao, nota,
             raw->>'Nivel1' as nivel1, raw->>'Nivel2' as nivel2,
             raw->>'Nivel3' as nivel3, raw->>'Nivel4' as nivel4
      FROM construpoint_inspecoes
      WHERE id = ${inspId}
    `;
    const insp = rows[0];
    if (!insp) return NextResponse.json({ error: 'Inspeção não encontrada' }, { status: 404 });

    // Verificações não têm FK — ligam pela mesma string de código.
    const verificacoes = insp.code
      ? await sql`
          SELECT verificacao, resultado, problema, solucao, inspetor, data, nota_item
          FROM construpoint_verificacoes
          WHERE codigo = ${insp.code}
          ORDER BY data ASC
        `
      : [];

    return NextResponse.json({
      inspecao: {
        id: insp.id,
        code: insp.code,
        modelo: insp.modelo,
        obra: insp.obra,
        local: insp.local,
        inspetor: insp.inspetor,
        status: insp.status,
        dataCriacao: insp.data_criacao,
        dataAgendamento: insp.data_agendamento,
        dataAtualizacao: insp.data_atualizacao,
        nota: insp.nota,
        nivel1: insp.nivel1,
        nivel2: insp.nivel2,
        nivel3: insp.nivel3,
        nivel4: insp.nivel4,
      },
      verificacoes: verificacoes.map(v => ({
        verificacao: v.verificacao,
        resultado: v.resultado,
        problema: v.problema,
        solucao: v.solucao,
        inspetor: v.inspetor,
        data: v.data,
        notaItem: v.nota_item,
      })),
    });
  } catch (error: unknown) {
    logger.error({ error }, '[API/construpoint/inspecao/:id]');
    return NextResponse.json({ error: 'Erro ao buscar inspeção' }, { status: 500 });
  }
}
