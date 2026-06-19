import { NextRequest, NextResponse } from 'next/server';
import { parseCrmDate } from '@/lib/dateUtils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // CV CRM envia o lead diretamente ou dentro de { lead: {...} }
    const lead = body?.lead ?? body;
    if (!lead?.id) {
      return NextResponse.json({ ok: false, error: 'payload sem id' }, { status: 400 });
    }

    const { sql, ensureSchema } = await import('@/lib/pg');
    await ensureSchema();

    await sql`
      INSERT INTO leads (
        id, nome, email, telefone, origem, status,
        empreendimento, score, temperatura,
        data_cadastro, data_atualizacao, raw, synced_at
      ) VALUES (
        ${String(lead.id)},
        ${lead.nome ?? lead.name ?? null},
        ${lead.email ?? null},
        ${lead.telefone ?? lead.phone ?? null},
        ${lead.origem ?? lead.origin ?? null},
        ${lead.status ?? null},
        ${lead.empreendimento ?? lead.produto ?? null},
        ${lead.score ?? null},
        ${lead.temperatura ?? null},
        ${parseCrmDate(lead.data_cadastro)},
        ${parseCrmDate(lead.data_atualizacao)},
        ${JSON.stringify(lead)},
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        nome             = EXCLUDED.nome,
        email            = EXCLUDED.email,
        telefone         = EXCLUDED.telefone,
        origem           = EXCLUDED.origem,
        status           = EXCLUDED.status,
        empreendimento   = EXCLUDED.empreendimento,
        score            = EXCLUDED.score,
        temperatura      = EXCLUDED.temperatura,
        data_cadastro    = EXCLUDED.data_cadastro,
        data_atualizacao = EXCLUDED.data_atualizacao,
        raw              = EXCLUDED.raw,
        synced_at        = NOW()
    `;

    console.log(`[webhook/cvcrm] lead ${lead.id} upserted`);
    return NextResponse.json({ ok: true });

  } catch (e: any) {
    console.error('[webhook/cvcrm]', e.message);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
