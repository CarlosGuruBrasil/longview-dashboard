import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/pg';
import { getBearerToken } from '@/lib/internal-auth';
import { parseConstrupointDate } from '@/lib/construpoint';

type ConstrupointPayload = Record<string, unknown> & {
  Id?: string | number;
  id?: string | number;
  Code?: string;
  code?: string;
  Model?: { Name?: string };
  Work?: { Name?: string };
  Location?: { Name?: string };
  Inspector?: { Name?: string };
  Status?: { Name?: string };
  modelo?: string;
  obra?: string;
  local?: string;
  inspetor?: string;
  status?: string;
  CreateDate?: string | number | Date;
  data_criacao?: string | number | Date;
  ScheduleDate?: string | number | Date;
  data_agendamento?: string | number | Date;
  UpdateDate?: string | number | Date;
  data_atualizacao?: string | number | Date;
  WeightedGrade?: string | number;
  nota?: string | number;
};

function asPayload(value: unknown): ConstrupointPayload {
  return value && typeof value === 'object' ? value as ConstrupointPayload : {};
}

function sqlScalar(value: unknown): string | number | boolean | null {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return value == null ? null : String(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.CONSTRUPOINT_WEBHOOK_SECRET;
    const incomingSecret =
      request.headers.get('x-webhook-secret') ||
      request.headers.get('x-construpoint-secret') ||
      getBearerToken(request);
    if (!secret || incomingSecret !== secret) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const rawBody = await request.text();
    let body: ConstrupointPayload;
    try {
      body = asPayload(JSON.parse(rawBody));
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
      
      const dCriacao = parseConstrupointDate(body.CreateDate || body.data_criacao);
      const dAgend = parseConstrupointDate(body.ScheduleDate || body.data_agendamento);
      const dAtualiz = parseConstrupointDate(body.UpdateDate || body.data_atualizacao);
      
      const nota = body.WeightedGrade || body.nota || null;

      await sql`
        INSERT INTO construpoint_inspecoes (
          id, code, modelo, obra, local, inspetor, status, data_criacao,
          data_agendamento, data_atualizacao, nota, raw, synced_at
        ) VALUES (
          ${sqlScalar(id)}, ${code}, ${modelo}, ${obra}, ${local}, ${inspetor}, ${status},
          ${dCriacao}, ${dAgend}, ${dAtualiz}, ${nota ?? null}, ${JSON.stringify(body)}, NOW()
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
  } catch (error: unknown) {
    console.error('[webhook/construpoint] Erro:', errorMessage(error));
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
