import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/pg';
import { getInspectionsByRange, getVerifications, MODEL_TYPES, type ModelTypeKey } from '@/lib/construpoint';

export const maxDuration = 300; // 5 minutes
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const secret = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  await ensureSchema();
  const startYear = 2025;
  const endYear = new Date().getFullYear();

  let upsertedInspections = 0;
  let upsertedVerifications = 0;

  const modelKeys = Object.keys(MODEL_TYPES) as ModelTypeKey[];

  try {
    // 1. Sync Inspecoes
    for (const key of modelKeys) {
      const res = await getInspectionsByRange({
        StartYear: startYear,
        EndYear: endYear,
        ModelType: MODEL_TYPES[key],
        OnlyActiveWorks: true,
        PageSize: 1000,
      });

      if (!res.Items || res.Items.length === 0) continue;

      for (const insp of res.Items) {
        if (!insp.Id) continue;
        const dCriacao = insp.CreateDate ? new Date(insp.CreateDate) : null;
        const dAgend = insp.ScheduleDate ? new Date(insp.ScheduleDate) : null;
        const dAtualiz = insp.UpdateDate ? new Date(insp.UpdateDate) : null;

        await sql`
          INSERT INTO construpoint_inspecoes (
            id, code, modelo, obra, local, inspetor, status, data_criacao,
            data_agendamento, data_atualizacao, nota, raw, synced_at
          ) VALUES (
            ${insp.Id},
            ${insp.Code ?? null},
            ${insp.Model?.Name ?? key},
            ${insp.Work?.Name ?? null},
            ${insp.Location?.Name ?? null},
            ${insp.Inspector?.Name ?? null},
            ${insp.Status?.Name ?? null},
            ${dCriacao},
            ${dAgend},
            ${dAtualiz},
            ${insp.WeightedGrade ?? null},
            ${JSON.stringify(insp)},
            NOW()
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
        upsertedInspections++;
      }
    }

    // 2. Sync Verificacoes
    await sql`TRUNCATE TABLE construpoint_verificacoes`;

    const today = new Date();
    const begin = `${startYear}-01-01`;
    const end   = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

    for (const key of modelKeys) {
      const items = await getVerifications({
        BeginDate: begin,
        EndDate: end,
        ModelTypeId: MODEL_TYPES[key],
        HistoricoCompleto: false,
        CamposPersonalizados: false,
      });

      if (!items || items.length === 0) continue;

      for (const v of items) {
        const d = v.Verificacao ? new Date(v.Verificacao) : null;
        await sql`
          INSERT INTO construpoint_verificacoes (
            codigo, modelo, verificacao, resultado, obra, local, inspetor,
            problema, solucao, data, nota_inspecao, nota_item, raw, synced_at
          ) VALUES (
            ${v.Codigo ?? null},
            ${v.Modelo ?? key},
            ${v.Verificacoes ?? null},
            ${v.Resultado ?? null},
            ${v.Obra ?? null},
            ${v.Local ?? null},
            ${v.Inspetor ?? null},
            ${v.ProblemaEncontrado ?? null},
            ${v.SolucaoIndicada ?? null},
            ${d},
            ${v.NotaDaInspecao ?? null},
            ${v.NotaDoItem ?? null},
            ${JSON.stringify(v)},
            NOW()
          )
        `;
        upsertedVerifications++;
      }
    }

    return NextResponse.json({
      ok: true,
      message: 'Sincronização concluída com sucesso',
      inspecoes: upsertedInspections,
      verificacoes: upsertedVerifications
    });

  } catch (error: any) {
    console.error('[cron/sync-construpoint] Erro:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
