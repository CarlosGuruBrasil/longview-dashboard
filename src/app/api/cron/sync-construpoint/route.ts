import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/pg';
import { getInspections, getVerifications, MODEL_TYPES, type ModelTypeKey } from '@/lib/construpoint';
import { getBearerToken, isSecretAuthorized, unauthorizedJson } from '@/lib/internal-auth';

export const maxDuration = 300; // 5 minutes
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const querySecret = url.searchParams.get('secret');
  const headerSecret = getBearerToken(request);
  
  if (
    !isSecretAuthorized(process.env.CRON_SECRET, querySecret) &&
    !isSecretAuthorized(process.env.CRON_SECRET, headerSecret)
  ) {
    return unauthorizedJson();
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
      for (let y = startYear; y <= endYear; y++) {
        const beginDate = `${y}-01-01`;
        const endDate = `${y}-12-31`;
        
        const res = await getInspections({
          BeginDate: beginDate,
          EndDate: endDate,
          ModelTypeId: MODEL_TYPES[key],
          HistoricoCompleto: false,
          CamposPersonalizados: false,
        });

        if (!Array.isArray(res) || res.length === 0) continue;

      if (!Array.isArray(res) || res.length === 0) continue;

      for (const insp of res) {
        if (!insp.Id) continue;
        const dCriacao = insp.Criacao ? new Date(insp.Criacao) : null;
        const dAgend = insp.PrimeiraVistoria ? new Date(insp.PrimeiraVistoria) : null;
        const dAtualiz = insp.DataReinspecao ? new Date(insp.DataReinspecao) : null;

        await sql`
          INSERT INTO construpoint_inspecoes (
            id, code, modelo, obra, local, inspetor, status, data_criacao,
            data_agendamento, data_atualizacao, nota, raw, synced_at
          ) VALUES (
            ${insp.Id},
            ${insp.Codigo ?? null},
            ${insp.Modelo?.Nome ?? key},
            ${insp.Obra?.Nome ?? null},
            ${insp.Local?.Nome ?? null},
            ${insp.Inspetor?.Nome ?? null},
            ${insp.Status?.Nome ?? null},
            ${dCriacao},
            ${dAgend},
            ${dAtualiz},
            null,
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
  }

    // 2. Sync Verificacoes
    await sql`TRUNCATE TABLE construpoint_verificacoes`;

    const today = new Date();
    
    for (const key of modelKeys) {
      for (let y = startYear; y <= endYear; y++) {
        const begin = `${y}-01-01`;
        let end = `${y}-12-31`;
        
        if (y === today.getFullYear()) {
          end = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
        }
        
        const items = await getVerifications({
          BeginDate: begin,
          EndDate: end,
          ModelTypeId: MODEL_TYPES[key],
          HistoricoCompleto: false,
          CamposPersonalizados: false,
        });

        if (!Array.isArray(items) || items.length === 0) continue;

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
