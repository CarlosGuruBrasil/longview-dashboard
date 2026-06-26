import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { sql, ensureSchema } from '@/lib/pg';
import { isCronAuthorized, unauthorizedJson } from '@/lib/internal-auth';

export const maxDuration = 300;
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) return unauthorizedJson();

  await ensureSchema();
  const CV_EMAIL = process.env.CV_CRM_EMAIL!;
  const CV_TOKEN = process.env.CV_CRM_TOKEN!;
  const headers = { email: CV_EMAIL, token: CV_TOKEN, Accept: 'application/json' };

  try {
    const projRes = await axios.get('https://longviewempreendimentos.cvcrm.com.br/api/v1/cadastros/empreendimentos', { headers, timeout: 20000 });
    const projects = Array.isArray(projRes.data) ? projRes.data : [];
    
    // Filtra projetos válidos
    const validProjects = projects.filter((p: any) => 
      p.tipo_empreendimento?.[0]?.nome !== null && 
      p.situacao_comercial?.[0]?.nome !== null
    );

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
        VALUES (${idEmp}, ${nome}, ${situacao}, ${tipo}, ${JSON.stringify(p)}, NOW())
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
        const detRes = await axios.get(`https://longviewempreendimentos.cvcrm.com.br/api/v1/cadastros/empreendimentos/${idEmp}`, { 
          params: { limite_dados_unidade: 1000 }, 
          headers, 
          timeout: 20000 
        });
        
        const rawData = detRes.data;
        const unidadesList: any[] = [];

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
          
          let statusText = 'Desconhecido';
          if (statusVenda === 1) statusText = 'Disponivel';
          else if (statusVenda === 2 || statusVenda === 5 || sitObj.reservada != null) statusText = 'Reservado';
          else if (statusVenda === 3 || sitObj.vendida != null || sitObj.vendida_idsituacao === 3) statusText = 'Vendido';

          const valor = parseFloat(uni.valor) || null;
          const metragem = parseFloat(uni.metragem_real) || null;
          const blocoNome = uni._bloco_nome || null;
          const num = uni.nome || null;

          await sql`
            INSERT INTO cv_unidades (
              id, id_empreendimento, bloco, numero, status, status_venda, valor, metragem, raw, synced_at
            ) VALUES (
              ${idUni}, ${idEmp}, ${blocoNome}, ${num}, ${statusText}, ${statusVenda}, ${valor}, ${metragem}, ${JSON.stringify(uni)}, NOW()
            )
          `;
          upsertedUnidades++;
        }
      } catch (detErr: any) {
        console.error(`[cron/sync-cv-estoque] Erro ao buscar detalhes do emp ${idEmp}:`, detErr.message);
      }
    }

    return NextResponse.json({ ok: true, empreendimentos: upsertedEmp, unidades: upsertedUnidades });
  } catch (error: any) {
    console.error('[/cron/sync-cv-estoque] Erro:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
