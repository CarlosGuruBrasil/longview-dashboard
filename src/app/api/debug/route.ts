import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/pg';
import axios from 'axios';

function isSale(lead: any): boolean {
  if (!lead.situacao?.nome) return false;
  const s = lead.situacao.nome.toLowerCase().trim();
  return (
    s === 'venda realizada' ||
    s.includes('negócio ganho') ||
    s.includes('negocio ganho') ||
    s.includes('vendid') ||
    s.includes('venda real')
  );
}

export async function GET(request: NextRequest) {
  try {
    await ensureSchema();

    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids'); // ex: ?ids=3217,3720

    // ── Dados do Postgres ──────────────────────────────────────────────────────
    const rows = await sql`SELECT raw FROM leads`;
    const leads = rows.map((r: any) => typeof r.raw === 'object' ? r.raw : JSON.parse(r.raw));
    const sales = leads.filter(isSale);

    const salesReport = sales.map((l: any) => ({
      idlead:          l.idlead,
      nome:            l.nome,
      situacao:        l.situacao?.nome,
      data_cadastro:   l.data_cadastro || l.data_cad,
      data_venda:      l.data_venda,
      qtde_reservas:   l.qtde_reservas_associadas,
      valor_venda:     l.valor_venda,
      valor_negocio:   l.valor_negocio,
    }));

    // ── Diagnóstico por IDs específicos ────────────────────────────────────────
    let specificDiag: any[] = [];
    if (idsParam) {
      const ids = idsParam.split(',').map(s => s.trim());
      const email = process.env.CV_CRM_EMAIL!;
      const token = process.env.CV_CRM_TOKEN!;
      const headers = { email, token, Accept: 'application/json' };

      specificDiag = await Promise.all(ids.map(async id => {
        const inDb = leads.find((l: any) => String(l.idlead) === id || String(l.id) === id);

        let fromCrm: any = null;
        try {
          const res = await axios.get(
            `https://longviewempreendimentos.cvcrm.com.br/api/v1/comercial/leads/${id}`,
            { headers, timeout: 8000 }
          );
          fromCrm = {
            idlead:        res.data?.idlead,
            nome:          res.data?.nome,
            situacao:      res.data?.situacao?.nome,
            data_cadastro: res.data?.data_cad || res.data?.data_cadastro,
            data_venda:    res.data?.data_venda,
            qtde_reservas: res.data?.qtde_reservas_associadas,
          };
        } catch (e: any) {
          fromCrm = { error: e.message };
        }

        return {
          id,
          inDb:         !!inDb,
          dbSituacao:   inDb?.situacao?.nome ?? null,
          dbDataVenda:  inDb?.data_venda ?? null,
          dbIsSale:     inDb ? isSale(inDb) : null,
          crm:          fromCrm,
          mismatch:     inDb && fromCrm && !fromCrm.error
            ? inDb.situacao?.nome !== fromCrm.situacao
            : null,
        };
      }));
    }

    // ── Dados do Project Vision ────────────────────────────────────────────────
    const pvRows = await sql`SELECT data FROM project_state WHERE key = 'state'`;
    const pv = pvRows[0]?.data as any;
    const projectVisionSummary = pv ? {
      tasks:        (pv.tasks || []).length,
      projects:     (pv.projects || []).map((p: any) => p.name),
      responsibles: (pv.responsibles || []).length,
    } : null;

    return NextResponse.json({
      postgresTotalLeads:   leads.length,
      totalSalesInDb:       sales.length,
      totalVendasByReserva: sales.reduce((s: number, l: any) => s + (l.qtde_reservas_associadas || 1), 0),
      salesWithDataVenda:   sales.filter((s: any) => s.data_venda).length,
      salesReport,
      projectVision: projectVisionSummary,
      ...(idsParam ? { specificDiag } : {}),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Migração temporária Upstash → Postgres kv_store — remover após usar
export async function POST(request: NextRequest) {
  const { secret, kv_data } = await request.json();
  if (secret !== process.env.CV_CRM_TOKEN) return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  await ensureSchema();
  let ok = 0, fail = 0;
  for (const [key, value] of Object.entries(kv_data as Record<string, unknown>)) {
    try {
      await sql`
        INSERT INTO kv_store (key, value, expires_at)
        VALUES (${key}, ${JSON.stringify(value)}, NULL)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, expires_at = NULL
      `;
      ok++;
    } catch { fail++; }
  }
  const total = await sql`SELECT COUNT(*) as c FROM kv_store`;
  return NextResponse.json({ ok, fail, total_kv: (total[0] as any).c });
}
