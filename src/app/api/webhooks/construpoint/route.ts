import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/pg';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    console.log('[webhook/construpoint] Recebido:', JSON.stringify(body).slice(0, 500));
    await ensureSchema();

    // Como não temos a doc exata do webhook da Construpoint, vamos fazer um parser defensivo
    // Se for uma Inspeção, vamos atualizar/inserir.
    const id = body.Id || body.id;
    if (id) {
      // Se parecer com uma inspeção
      const code = body.Code || body.code || null;
      const modelo = body.Model?.Name || body.modelo || null;
      const obra = body.Work?.Name || body.obra || null;
      const local = body.Location?.Name || body.local || null;
      const inspetor = body.Inspector?.Name || body.inspetor || null;
      const status = body.Status?.Name || body.status || null;
      
      const dCriacao = body.CreateDate || body.data_criacao ? new Date(body.CreateDate || body.data_criacao) : null;
      const dAgend = body.ScheduleDate || body.data_agendamento ? new Date(body.ScheduleDate || body.data_agendamento) : null;
      const dAtualiz = body.UpdateDate || body.data_atualizacao ? new Date(body.UpdateDate || body.data_atualizacao) : null;
      
      const nota = body.WeightedGrade || body.nota || null;

      await sql`
        INSERT INTO construpoint_inspecoes (
          id, code, modelo, obra, local, inspetor, status, data_criacao,
          data_agendamento, data_atualizacao, nota, raw, synced_at
        ) VALUES (
          ${id}, ${code}, ${modelo}, ${obra}, ${local}, ${inspetor}, ${status},
          ${dCriacao}, ${dAgend}, ${dAtualiz}, ${nota}, ${JSON.stringify(body)}, NOW()
        ) ON CONFLICT (id) DO UPDATE SET
          code = EXCLUDED.code,
          modelo = EXCLUDED.modelo,
          obra = EXCLUDED.obra,
          local = EXCLUDED.local,
          inspetor = EXCLUDED.inspetor,
          status = EXCLUDED.status,
          data_criacao = EXCLUDED.data_criacao,
          data_agendamento = EXCLUDED.data_agendamento,
          data_atualizacao = EXCLUDED.data_atualizacao,
          nota = EXCLUDED.nota,
          raw = EXCLUDED.raw,
          synced_at = EXCLUDED.synced_at
      `;
    } else {
      // Se não reconhecermos o formato, podemos logar em uma tabela de webhooks genérica ou ignorar por enquanto
      console.log('[webhook/construpoint] Payload não reconhecido como inspeção (sem ID). Ignorando inserção.');
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[webhook/construpoint] Erro:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
