import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/pg';
import { getInspections, getVerifications, parseConstrupointDate, cpField, cpName, MODEL_TYPES, type ModelTypeKey } from '@/lib/construpoint';
import { getBearerToken, isSecretAuthorized, unauthorizedJson } from '@/lib/internal-auth';
import { refreshAutomaticQualityScopes } from '@/lib/quality-scopes';
import logger from '@/lib/logger'

export const maxDuration = 300; // 5 minutes
export const runtime = 'nodejs';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function numericValue(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

type VerificationRow = {
  codigo: string | null;
  modelo: string;
  verificacao: string | null;
  resultado: string | null;
  obra: string | null;
  local: string | null;
  inspetor: string | null;
  problema: string | null;
  solucao: string | null;
  data: Date | null;
  notaInspecao: number | null;
  notaItem: number | null;
  raw: Record<string, unknown>;
};

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
  const startYear = 2024;
  const endYear = new Date().getFullYear();

  // mode=incremental: inspeções do mês corrente em diante (inclui agenda futura do ano).
  // Verificações ficam de fora porque a tabela não tem chave natural (sync full diário faz TRUNCATE+reload).
  const incremental = url.searchParams.get('mode') === 'incremental';
  const now0 = new Date();
  const currentMonthStart = `${now0.getFullYear()}-${String(now0.getMonth() + 1).padStart(2, '0')}-01`;

  let upsertedInspections = 0;
  let upsertedVerifications = 0;
  const verificationRows: VerificationRow[] = [];

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
        const dAtualiz = parseConstrupointDate(cpField(insp, 'Atualizacao', 'Atualização', 'UpdateDate'));
        const nota = numericValue(cpField(insp, 'NotaDaInspecao', 'NotaDaInspeção', 'WeightedGrade'));

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
            ${nota},
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
            data_atualizacao = COALESCE(EXCLUDED.data_atualizacao, construpoint_inspecoes.data_atualizacao),
            nota = COALESCE(EXCLUDED.nota, construpoint_inspecoes.nota),
            raw = EXCLUDED.raw,
            synced_at = EXCLUDED.synced_at
        `;
        upsertedInspections++;
      }
    }
  }

    // 2. Busca todas as verificações antes de tocar na versão válida do banco.
    if (!incremental) {
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
        verificationRows.push({
          codigo: cpField<string>(v, 'Codigo', 'Código') ?? null,
          modelo: cpName(cpField(v, 'Modelo')) ?? key,
          verificacao: cpField<string>(v, 'Verificacoes', 'Verificações') ?? null,
          resultado: cpField<string>(v, 'Resultado') ?? null,
          obra: cpName(cpField(v, 'Obra')) ?? null,
          local: cpName(cpField(v, 'Local')) ?? null,
          inspetor: cpName(cpField(v, 'Inspetor')) ?? null,
          problema: cpField<string>(v, 'ProblemaEncontrado') ?? null,
          solucao: cpField<string>(v, 'SolucaoIndicada') ?? null,
          data: d,
          notaInspecao: numericValue(cpField(v, 'NotaDaInspecao', 'NotaDaInspeção')),
          notaItem: numericValue(cpField(v, 'NotaDoItem')),
          raw: v,
        });
      }
    }
  }

    // A troca é atômica: qualquer erro restaura automaticamente a versão anterior.
    await sql.begin(async transaction => {
      await transaction`TRUNCATE TABLE construpoint_verificacoes`;
      for (const row of verificationRows) {
        await transaction`
          INSERT INTO construpoint_verificacoes (
            codigo, modelo, verificacao, resultado, obra, local, inspetor,
            problema, solucao, data, nota_inspecao, nota_item, raw, synced_at
          ) VALUES (
            ${row.codigo}, ${row.modelo}, ${row.verificacao}, ${row.resultado},
            ${row.obra}, ${row.local}, ${row.inspetor}, ${row.problema},
            ${row.solucao}, ${row.data}, ${row.notaInspecao}, ${row.notaItem},
            ${transaction.json(row.raw as never)}, NOW()
          )
        `;
      }
    });
    upsertedVerifications = verificationRows.length;
  }

    await refreshAutomaticQualityScopes();

    return NextResponse.json({
      ok: true,
      message: 'Sincronização concluída com sucesso',
      inspecoes: upsertedInspections,
      verificacoes: upsertedVerifications
    });

  } catch (error: unknown) {
    const message = errorMessage(error);
    logger.error({ message }, '[cron/sync-construpoint] Erro:');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
