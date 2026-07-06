import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/pg';
import { getInspections, getVerifications, parseConstrupointDate, cpField, cpName, MODEL_TYPES, type ModelTypeKey } from '@/lib/construpoint';
import { getBearerToken, isSecretAuthorized, unauthorizedJson } from '@/lib/internal-auth';

export const maxDuration = 300; // 5 minutes
export const runtime = 'nodejs';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

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

  // mode=incremental: só inspeções do mês corrente (roda a cada 15min via Coolify).
  // Verificações ficam de fora porque a tabela não tem chave natural (sync full diário faz TRUNCATE+reload).
  const incremental = url.searchParams.get('mode') === 'incremental';
  const now0 = new Date();
  const currentMonthStart = `${now0.getFullYear()}-${String(now0.getMonth() + 1).padStart(2, '0')}-01`;

  let upsertedInspections = 0;
  let upsertedVerifications = 0;

  const modelKeys = Object.keys(MODEL_TYPES) as ModelTypeKey[];

  try {
    // 1. Sync Inspecoes
    for (const key of modelKeys) {
      for (let y = incremental ? endYear : startYear; y <= endYear; y++) {
        const beginDate = incremental ? currentMonthStart : `${y}-01-01`;
        const endDate = `${y}-12-31`;

        const res = await getInspections({
          BeginDate: beginDate,
          EndDate: endDate,
          ModelTypeId: MODEL_TYPES[key],
          HistoricoCompleto: false,
          CamposPersonalizados: false,
        });

        if (!Array.isArray(res) || res.length === 0) continue;

      for (const insp of res) {
        const id = cpField<number>(insp, 'Id', 'id');
        if (!id) continue;
        const dCriacao = parseConstrupointDate(cpField(insp, 'Criacao', 'Criação'));
        const dAgend = parseConstrupointDate(cpField(insp, 'PrimeiraVistoria', 'PrimeiraInspecao', 'PrimeiraInspeção'));
        const dAtualiz = parseConstrupointDate(cpField(insp, 'DataReinspecao', 'DataReinspeção'));

        await sql`
          INSERT INTO construpoint_inspecoes (
            id, code, modelo, obra, local, inspetor, status, data_criacao,
            data_agendamento, data_atualizacao, nota, raw, synced_at
          ) VALUES (
            ${id},
            ${cpField<string>(insp, 'Codigo', 'Código') ?? null},
            ${cpName(cpField(insp, 'Modelo')) ?? key},
            ${cpName(cpField(insp, 'Obra')) ?? null},
            ${cpName(cpField(insp, 'Local')) ?? null},
            ${cpName(cpField(insp, 'Inspetor')) ?? null},
            ${cpName(cpField(insp, 'Status')) ?? null},
            ${dCriacao},
            ${dAgend},
            ${dAtualiz},
            null,
            ${sql.json(insp as never)},
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

    // 2. Sync Verificacoes (só no sync full — ver comentário do incremental acima)
    if (!incremental) {
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
        const d = parseConstrupointDate(cpField(v, 'Verificacao', 'Verificação'));
        await sql`
          INSERT INTO construpoint_verificacoes (
            codigo, modelo, verificacao, resultado, obra, local, inspetor,
            problema, solucao, data, nota_inspecao, nota_item, raw, synced_at
          ) VALUES (
            ${cpField<string>(v, 'Codigo', 'Código') ?? null},
            ${cpName(cpField(v, 'Modelo')) ?? key},
            ${cpField<string>(v, 'Verificacoes', 'Verificações') ?? null},
            ${cpField<string>(v, 'Resultado') ?? null},
            ${cpName(cpField(v, 'Obra')) ?? null},
            ${cpName(cpField(v, 'Local')) ?? null},
            ${cpName(cpField(v, 'Inspetor')) ?? null},
            ${cpField<string>(v, 'ProblemaEncontrado') ?? null},
            ${cpField<string>(v, 'SolucaoIndicada') ?? null},
            ${d},
            ${cpField<number>(v, 'NotaDaInspecao', 'NotaDaInspeção') ?? null},
            ${cpField<number>(v, 'NotaDoItem') ?? null},
            ${sql.json(v as never)},
            NOW()
          )
        `;
        upsertedVerifications++;
      }
    }
  }
  }

    return NextResponse.json({
      ok: true,
      message: 'Sincronização concluída com sucesso',
      inspecoes: upsertedInspections,
      verificacoes: upsertedVerifications
    });

  } catch (error: unknown) {
    const message = errorMessage(error);
    console.error('[cron/sync-construpoint] Erro:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
