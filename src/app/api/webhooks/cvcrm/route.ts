import { NextRequest, NextResponse } from 'next/server';
import { parseCrmDate } from '@/lib/dateUtils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // CV CRM envia payload em várias chaves (lead, venda, unidade) dependendo do evento
    const lead = body?.lead ?? body;
    const venda = body?.venda;
    const unidade = body?.unidade;

    const { sql, ensureSchema } = await import('@/lib/pg');
    await ensureSchema();

    // -- Tratar Evento de Venda --
    if (venda?.idvenda || body?.idvenda) {
      const v = venda || body;
      const dVenda = v.data_venda ? new Date(v.data_venda) : null;
      const valor = v.valor_venda ? parseFloat(v.valor_venda) : null;
      await sql`
        INSERT INTO cv_vendas (id, id_empreendimento, id_unidade, valor, data_venda, status, raw, synced_at)
        VALUES (${v.idvenda}, ${v.idempreendimento ?? null}, ${v.idunidade ?? null}, ${valor}, ${dVenda}, ${v.situacao ?? null}, ${JSON.stringify(v)}, NOW())
        ON CONFLICT (id) DO UPDATE SET
          id_empreendimento = EXCLUDED.id_empreendimento, id_unidade = EXCLUDED.id_unidade, valor = EXCLUDED.valor,
          data_venda = EXCLUDED.data_venda, status = EXCLUDED.status, raw = EXCLUDED.raw, synced_at = EXCLUDED.synced_at
      `;
      console.log(`[webhook/cvcrm] Venda ${v.idvenda} upserted`);
      return NextResponse.json({ ok: true });
    }

    // -- Tratar Evento de Unidade --
    if (unidade?.idunidade || body?.idunidade) {
      const u = unidade || body;
      const sitObj = u.situacao || {};
      const statusVenda = Number(sitObj.situacao_para_venda ?? u.status_venda ?? 0);
      let statusText = 'Desconhecido';
      if (statusVenda === 1) statusText = 'Disponivel';
      else if (statusVenda === 2 || statusVenda === 5 || sitObj.reservada != null) statusText = 'Reservado';
      else if (statusVenda === 3 || sitObj.vendida != null || sitObj.vendida_idsituacao === 3) statusText = 'Vendido';

      const valor = parseFloat(u.valor) || null;
      const metragem = parseFloat(u.metragem_real) || null;

      await sql`
        INSERT INTO cv_unidades (id, id_empreendimento, bloco, numero, status, status_venda, valor, metragem, raw, synced_at)
        VALUES (${u.idunidade}, ${u.idempreendimento ?? null}, ${u.bloco_nome ?? u.bloco ?? null}, ${u.nome ?? u.numero ?? null}, ${statusText}, ${statusVenda}, ${valor}, ${metragem}, ${JSON.stringify(u)}, NOW())
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status, status_venda = EXCLUDED.status_venda, valor = EXCLUDED.valor, raw = EXCLUDED.raw, synced_at = EXCLUDED.synced_at
      `;
      console.log(`[webhook/cvcrm] Unidade ${u.idunidade} upserted`);
      return NextResponse.json({ ok: true });
    }

    // -- Tratar Evento de Lead (Legado) --
    if (!lead?.id) {
      return NextResponse.json({ ok: false, error: 'payload sem id' }, { status: 400 });
    }
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

    // ── Notificação FCM: nova venda realizada ────────────────────────────
    const statusNome = (lead.situacao?.nome ?? lead.status ?? '').toLowerCase();
    const isVenda = statusNome === 'venda realizada' || statusNome.includes('negócio ganho') || statusNome.includes('negocio ganho');
    if (isVenda) {
      try {
        const baseUrl = process.env.NEXTAUTH_URL ?? 'https://app.guru.dev.br';
        fetch(`${baseUrl}/api/notifications/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.CRON_SECRET}` },
          body: JSON.stringify({
            title: '🏆 Nova Venda Realizada!',
            body: `${lead.nome ?? 'Cliente'} • ${lead.empreendimento ?? ''}`.trim(),
            roles: ['Desenvolvedor', 'Diretoria', 'Gestor'],
            data: { url: '/marketing-vision', type: 'venda' },
          }),
        }).catch(() => {});
      } catch { /* não bloqueia o webhook */ }
    }

    return NextResponse.json({ ok: true });

  } catch (e: any) {
    console.error('[webhook/cvcrm]', e.message);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
