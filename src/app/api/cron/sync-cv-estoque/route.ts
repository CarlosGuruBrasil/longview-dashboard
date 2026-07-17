import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { sql, ensureSchema } from '@/lib/pg';
import { isCronAuthorized, unauthorizedJson } from '@/lib/internal-auth';
import logger from '@/lib/logger'
import { isRealEmpreendimento } from '@/lib/cvcrm-projects';

export const maxDuration = 300;
export const runtime = 'nodejs';

type NamedValue = {
  nome?: string | null;
};

type CvProject = Record<string, unknown> & {
  idempreendimento?: string | number;
  nome?: string;
  empreendimento?: string;
  tipo_empreendimento?: NamedValue[];
  situacao_comercial?: NamedValue[];
};

type CvUnit = Record<string, unknown> & {
  idunidade?: string | number;
  situacao?: {
    situacao_para_venda?: string | number;
    reservada?: unknown;
    vendida?: unknown;
    vendida_idsituacao?: string | number;
    situacao_mapa_disponibilidade?: string | number;
  };
  valor?: string | number;
  metragem_real?: string | number;
  _bloco_nome?: string;
  nome?: string;
  andar?: string | number;
  coluna?: string | number;
  tipologia?: string;
  tipo?: string;
};

type CvBlock = {
  nome?: string;
  unidades?: CvUnit[];
};

type CvStage = {
  blocos?: CvBlock[];
};

type CvProjectDetails = {
  etapas?: CvStage[];
};

function errorMessage(error: unknown): string {
  return axios.isAxiosError(error) ? error.message : error instanceof Error ? error.message : String(error);
}

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) return unauthorizedJson();

  await ensureSchema();
  const CV_EMAIL = process.env.CV_CRM_EMAIL!;
  const CV_TOKEN = process.env.CV_CRM_TOKEN!;
  const headers = { email: CV_EMAIL, token: CV_TOKEN, Accept: 'application/json' };

  try {
    const projRes = await axios.get<CvProject[]>('https://longviewempreendimentos.cvcrm.com.br/api/v1/cadastros/empreendimentos', { headers, timeout: 20000 });
    const projects = Array.isArray(projRes.data) ? projRes.data : [];
    
    const validProjects = projects.filter((p) => isRealEmpreendimento(p));
    const validProjectIds = validProjects
      .map((p) => Number(p.idempreendimento ?? 0))
      .filter((id) => Number.isFinite(id) && id > 0);

    if (validProjectIds.length > 0) {
      await sql`DELETE FROM cv_unidades WHERE id_empreendimento NOT IN ${sql(validProjectIds)}`;
      await sql`DELETE FROM cv_empreendimentos WHERE id NOT IN ${sql(validProjectIds)}`;
    }

    let upsertedEmp = 0;
    let upsertedUnidades = 0;

    for (const p of validProjects) {
      const idEmp = p.idempreendimento;
      if (!idEmp) continue;

      const nome = p.nome || p.empreendimento || null;
      const situacao = p.situacao_comercial?.[0]?.nome || null;
      const tipo = p.tipo_empreendimento?.[0]?.nome || null;

      await sql`
        INSERT INTO cv_empreendimentos (id, nome, situacao, tipo, raw, synced_at)
        VALUES (${idEmp}, ${nome}, ${situacao}, ${tipo}, ${p as never}, NOW())
        ON CONFLICT (id) DO UPDATE SET
          nome = EXCLUDED.nome,
          situacao = EXCLUDED.situacao,
          tipo = EXCLUDED.tipo,
          raw = EXCLUDED.raw,
          synced_at = EXCLUDED.synced_at
      `;
      upsertedEmp++;

      // Buscar unidades detalhadas deste empreendimento
      try {
        const detRes = await axios.get<CvProjectDetails>(`https://longviewempreendimentos.cvcrm.com.br/api/v1/cadastros/empreendimentos/${idEmp}`, {
          params: { limite_dados_unidade: 1000 }, 
          headers, 
          timeout: 20000 
        });
        
        const rawData = detRes.data;
        const unidadesList: CvUnit[] = [];

        // Parsing similar to EmpreendimentosView logic
        if (Array.isArray(rawData?.etapas)) {
          for (const etapa of rawData.etapas) {
            if (Array.isArray(etapa.blocos)) {
              for (const bloco of etapa.blocos) {
                if (Array.isArray(bloco.unidades)) {
                  for (const uni of bloco.unidades) {
                    uni._bloco_nome = bloco.nome;
                    unidadesList.push(uni);
                  }
                }
              }
            }
          }
        }

        // Deletar unidades antigas deste empreendimento para evitar fantasmas
        await sql`DELETE FROM cv_unidades WHERE id_empreendimento = ${idEmp}`;

        for (const uni of unidadesList) {
          const idUni = uni.idunidade;
          if (!idUni) continue;

          const sitObj = uni.situacao || {};
          const statusVenda = Number(sitObj.situacao_para_venda ?? 0);
          const _situacao_mapa_disponibilidade = (sitObj.situacao_mapa_disponibilidade != null) ? Number(sitObj.situacao_mapa_disponibilidade) : null;
          
          let statusText = 'Desconhecido';
          if (statusVenda === 1) statusText = 'Disponivel';
          else if (statusVenda === 2 || statusVenda === 5 || sitObj.reservada != null) statusText = 'Reservado';
          else if (statusVenda === 3 || sitObj.vendida != null || sitObj.vendida_idsituacao === 3) statusText = 'Vendido';

          const valor = parseFloat(String(uni.valor)) || null;
          const metragem = parseFloat(String(uni.metragem_real)) || null;
          const blocoNome = uni._bloco_nome || null;
          const num = uni.nome || null;

          await sql`
            INSERT INTO cv_unidades (
              id, id_empreendimento, bloco, numero, status, status_venda,
              valor, metragem, raw, synced_at
            ) VALUES (
              ${idUni}, ${idEmp}, ${blocoNome}, ${num}, ${statusText}, ${statusVenda},
              ${valor}, ${metragem}, ${uni as never}, NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
              id_empreendimento = EXCLUDED.id_empreendimento,
              bloco = EXCLUDED.bloco,
              numero = EXCLUDED.numero,
              status = EXCLUDED.status,
              status_venda = EXCLUDED.status_venda,
              valor = EXCLUDED.valor,
              metragem = EXCLUDED.metragem,
              raw = EXCLUDED.raw,
              synced_at = EXCLUDED.synced_at
          `;
          upsertedUnidades++;
        }
      } catch (detErr: unknown) {
        logger.error({ err: errorMessage(detErr) }, '[cron/sync-cv-estoque] Erro ao buscar detalhes do emp $:');
      }
    }

    return NextResponse.json({ ok: true, empreendimentos: upsertedEmp, unidades: upsertedUnidades });
  } catch (error: unknown) {
    const message = errorMessage(error);
    logger.error({ message }, '[/cron/sync-cv-estoque] Erro:');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
