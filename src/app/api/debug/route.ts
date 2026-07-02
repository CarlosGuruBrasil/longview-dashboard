import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/pg';
import { verifyAdminAuth } from '@/lib/auth';
import axios from 'axios';

type DebugLead = {
  idlead?: string | number;
  id?: string | number;
  nome?: string;
  situacao?: { nome?: string };
  data_cadastro?: string;
  data_cad?: string;
  data_venda?: string;
  qtde_reservas_associadas?: number;
  valor_venda?: number;
  valor_negocio?: number;
};

function isSale(lead: DebugLead): boolean {
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
  // Rota de debug expõe PII de todos os leads — restrita a admin/dev.
  const admin = await verifyAdminAuth();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  try {
    await ensureSchema();

    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids'); // ex: ?ids=3217,3720

    // ── Dados do Postgres ──────────────────────────────────────────────────────
    const rows = await sql<{ raw: unknown }[]>`SELECT raw FROM leads`;
    const leads: DebugLead[] = rows.map(r => (typeof r.raw === 'object' ? r.raw : JSON.parse(String(r.raw))) as DebugLead);
    const sales = leads.filter(isSale);

    const salesReport = sales.map(l => ({
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
    type CrmDiag = {
      idlead?: string | number;
      nome?: string;
      situacao?: string;
      data_cadastro?: string;
      data_venda?: string;
      qtde_reservas?: number;
      error?: string;
    };
    let specificDiag: {
      id: string;
      inDb: boolean;
      dbSituacao: string | null;
      dbDataVenda: string | null;
      dbIsSale: boolean | null;
      crm: CrmDiag;
      mismatch: boolean | null;
    }[] = [];
    if (idsParam) {
      const ids = idsParam.split(',').map(s => s.trim());
      const email = process.env.CV_CRM_EMAIL!;
      const token = process.env.CV_CRM_TOKEN!;
      const headers = { email, token, Accept: 'application/json' };

      specificDiag = await Promise.all(ids.map(async id => {
        const inDb = leads.find(l => String(l.idlead) === id || String(l.id) === id);

        let fromCrm: CrmDiag;
        try {
          const res = await axios.get<DebugLead>(
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
        } catch (e) {
          fromCrm = { error: e instanceof Error ? e.message : String(e) };
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
    type ProjectState = {
      tasks?: unknown[];
      projects?: { name?: string }[];
      responsibles?: unknown[];
    };
    const pvRows = await sql`SELECT data FROM project_state WHERE key = 'state'`;
    const pv = pvRows[0]?.data as ProjectState | undefined;
    const projectVisionSummary = pv ? {
      tasks:        (pv.tasks || []).length,
      projects:     (pv.projects || []).map(p => p.name),
      responsibles: (pv.responsibles || []).length,
    } : null;

    return NextResponse.json({
      postgresTotalLeads:   leads.length,
      totalSalesInDb:       sales.length,
      totalVendasByReserva: sales.reduce((s, l) => s + (l.qtde_reservas_associadas || 1), 0),
      salesWithDataVenda:   sales.filter(s => s.data_venda).length,
      salesReport,
      projectVision: projectVisionSummary,
      ...(idsParam ? { specificDiag } : {}),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

