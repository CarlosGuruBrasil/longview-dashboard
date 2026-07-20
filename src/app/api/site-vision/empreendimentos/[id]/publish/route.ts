import { NextRequest, NextResponse } from 'next/server';
import { verifyPermission } from '@/lib/auth';
import { ensureSchema, sql } from '@/lib/pg';
import { triggerCvCrmSync, pushEmpreendimentoConfig, pushUnidades, type UnidadePush } from '@/lib/site-longview-client';
import logger from '@/lib/logger';
import { randomUUID } from 'crypto';

// CV CRM não manda um campo numérico de dormitórios — vem embutido no texto de
// tipologia (ex: "2 Dorm / 2 Suítes"), mesma extração usada no GET de detalhe.
function extractDormitorios(raw: Record<string, unknown> | undefined): number | null {
  if (raw?.dormitorios != null) return Number(raw.dormitorios);
  const tipologia = String(raw?.tipologia ?? raw?.tipo ?? '');
  const match = /(\d+)\s*dorm/i.exec(tipologia);
  return match ? Number(match[1]) : null;
}

// vagas_garagem vem como código de identificação da vaga (ex: "VG 44 / HB 44"), não
// como quantidade — HB é hobby box, não vaga. Conta só os tokens "VG" pra achar a
// quantidade real de vagas de garagem atreladas à unidade.
function extractVagas(raw: Record<string, unknown> | undefined): number | null {
  const vagasGaragem = raw?.vagas_garagem;
  if (typeof vagasGaragem !== 'string' || !vagasGaragem.trim()) return null;
  const count = vagasGaragem.split('/').filter((token) => token.trim().toUpperCase().startsWith('VG')).length;
  return count > 0 ? count : null;
}

// Cada unidade lista suas próprias plantas em raw.plantas (nome + idplanta), mas só o
// nível de empreendimento (crmRaw.plantas) tem a URL da imagem. Casa pelo idplanta e
// prioriza a planta cujo nome cita o número da unidade (mais específica).
function extractPlantaUrl(
  raw: Record<string, unknown> | undefined,
  numero: string,
  plantaUrlById: Map<string, string>
): string | null {
  const plantas = Array.isArray(raw?.plantas) ? (raw!.plantas as Array<Record<string, unknown>>) : [];
  if (plantas.length === 0) return null;
  const especifica = plantas.find((p) => String(p.nome ?? '').includes(numero));
  const escolhida = especifica ?? plantas[0];
  const url = plantaUrlById.get(String(escolhida.idplanta ?? ''));
  return url || null;
}

function mapUnidadeStatus(status: string | null): UnidadePush['status'] {
  const s = (status || '').toLowerCase();
  if (s.includes('vend')) return 'vendido';
  if (s.includes('res')) return 'reservado';
  if (s.includes('disp')) return 'disponivel';
  return 'indisponivel';
}

type Params = { params: Promise<{ id: string }> };

interface PublishPayload {
  status: 'draft' | 'published' | 'archived';
  exibirNaHome: boolean;
  destaque: boolean;
  heroImageId?: string | null;
  unidadesVisiveis: number[]; // IDs das unidades que aparecem
  headlinePublico?: string;
  descricaoCurta?: string;
  ctaLabel?: string;
  ctaTarget?: string;
  metadata?: Record<string, unknown>;
}


export async function POST(request: NextRequest, { params }: Params) {
  const user = await verifyPermission('viewSiteVision');
  if (!user) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  try {
    await ensureSchema();
    const { id } = await params;
    const empId = Number(id);
    if (!Number.isFinite(empId)) {
      return NextResponse.json({ error: 'ID inválido.' }, { status: 400 });
    }

    const body = (await request.json()) as PublishPayload;

    // Buscar empreendimento do CRM pra pegar dados base
    const [crmRows] = await Promise.all([
      sql<{ id: number; nome: string; raw: unknown }[]>`
        SELECT id, nome, raw FROM cv_empreendimentos WHERE id = ${empId} LIMIT 1
      `,
    ]);

    if (!crmRows[0]) {
      return NextResponse.json({ error: 'Empreendimento não encontrado no CRM.' }, { status: 404 });
    }

    const crm = crmRows[0];
    const crmRaw = typeof crm.raw === 'string' ? JSON.parse(crm.raw) : crm.raw;

    // Garante que o empreendimento existe no site real (Site LongView), puxando do CV CRM.
    if (body.status === 'published') {
      try {
        await triggerCvCrmSync();
      } catch (syncError) {
        logger.error({ syncError, empId }, '[site-vision/publish] falha ao sincronizar com Site LongView');
        return NextResponse.json(
          { error: `Não foi possível sincronizar com o site real: ${syncError instanceof Error ? syncError.message : syncError}` },
          { status: 502 }
        );
      }
    }

    // Aplicado depois do sync pra ser a última escrita — o sync não conhece a coluna `ativo`
    // do jeito que o dashboard controla (draft/published/archived), então essa chamada é quem
    // decide a visibilidade real no site.
    try {
      await pushEmpreendimentoConfig(empId, { ativo: body.status === 'published' });
    } catch (statusError) {
      logger.error({ statusError, empId }, '[site-vision/publish] falha ao atualizar status no site real');
      return NextResponse.json(
        { error: `Não foi possível atualizar o status no site real: ${statusError instanceof Error ? statusError.message : statusError}` },
        { status: 502 }
      );
    }

    // Slug: converter nome pra slug seguro
    const slug = (body.ctaTarget || crm.nome)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Verificar se já existe site_public_empreendimentos pra este CRM project
    const [existingRows] = await Promise.all([
      sql<{ id: string }[]>`
        SELECT id FROM site_public_empreendimentos 
        WHERE crm_empreendimento_id = ${empId}
        LIMIT 1
      `,
    ]);

    let siteProjectId: string;

    if (existingRows[0]) {
      // Atualizar existing
      siteProjectId = existingRows[0].id;
      await sql`
        UPDATE site_public_empreendimentos
        SET
          status_publicacao = ${body.status},
          exibir_na_home = ${body.exibirNaHome},
          destaque = ${body.destaque},
          headline = ${body.headlinePublico || crmRaw.headline || crm.nome},
          resumo = ${body.descricaoCurta || crmRaw.resumo || ''},
          descricao = ${body.descricaoCurta || crmRaw.resumo || ''},
          cta_label = ${body.ctaLabel || 'Ver detalhes'},
          cta_target = ${body.ctaTarget || slug},
          metadata = ${JSON.stringify(body.metadata || {})},
          updated_at = NOW()
        WHERE id = ${siteProjectId}
      `;
    } else {
      // Criar novo
      siteProjectId = randomUUID();
      await sql`
        INSERT INTO site_public_empreendimentos (
          id, crm_empreendimento_id, slug, nome, status_publicacao,
          exibir_na_home, destaque, cidade, bairro,
          headline, resumo, descricao, cta_label, cta_target,
          metadata, created_at, updated_at
        ) VALUES (
          ${siteProjectId},
          ${empId},
          ${slug},
          ${crm.nome},
          ${body.status},
          ${body.exibirNaHome},
          ${body.destaque},
          ${crmRaw.cidade || 'São Paulo'},
          ${crmRaw.bairro || ''},
          ${body.headlinePublico || crmRaw.headline || crm.nome},
          ${body.descricaoCurta || crmRaw.resumo || ''},
          ${body.descricaoCurta || crmRaw.resumo || ''},
          ${body.ctaLabel || 'Ver detalhes'},
          ${body.ctaTarget || slug},
          ${JSON.stringify(body.metadata || {})},
          NOW(),
          NOW()
        )
      `;
    }

    // Empurrar as unidades selecionadas pro site real
    let unidadesEnviadas = 0;
    if (body.unidadesVisiveis && body.unidadesVisiveis.length > 0) {
      const unidadeRows = await sql<{
        id: number;
        bloco: string | null;
        numero: string | null;
        status: string | null;
        valor: string | number | null;
        metragem: string | number | null;
        raw: Record<string, unknown>;
      }[]>`
        SELECT id, bloco, numero, status, valor, metragem, raw
        FROM cv_unidades
        WHERE id_empreendimento = ${empId} AND id = ANY(${body.unidadesVisiveis})
      `;

      const crmPlantas = Array.isArray(crmRaw?.plantas) ? (crmRaw.plantas as Array<Record<string, unknown>>) : [];
      const plantaUrlById = new Map<string, string>(
        crmPlantas
          .filter((p) => p.idplanta != null && p.img_planta_servidor)
          .map((p) => [String(p.idplanta), String(p.img_planta_servidor)])
      );

      const unidadesPush: UnidadePush[] = unidadeRows
        .filter((u) => u.numero)
        .map((u) => ({
          numero: String(u.numero),
          tipo: String(u.raw?.tipologia ?? u.raw?.tipo ?? 'apartamento'),
          dormitorios: extractDormitorios(u.raw),
          vagas: extractVagas(u.raw),
          planta_url: extractPlantaUrl(u.raw, String(u.numero), plantaUrlById),
          area_privativa: u.metragem != null ? Number(u.metragem) : null,
          preco: u.valor != null ? Number(u.valor) : null,
          status: mapUnidadeStatus(u.status),
          bloco: u.bloco,
        }));

      if (unidadesPush.length > 0) {
        try {
          const result = await pushUnidades(empId, unidadesPush);
          unidadesEnviadas = result.upserted;
        } catch (pushError) {
          logger.error({ pushError, empId }, '[site-vision/publish] falha ao enviar unidades pro site real');
        }
      }
    }

    // Se tiver heroImageId, marcar como primary
    if (body.heroImageId) {
      await sql`
        UPDATE site_public_media_assets
        SET is_primary = false
        WHERE empreendimento_id = ${siteProjectId}
      `;

      await sql`
        UPDATE site_public_media_assets
        SET is_primary = true
        WHERE id = ${body.heroImageId} AND empreendimento_id = ${siteProjectId}
      `;
    }

    logger.info(
      { empId, siteProjectId, status: body.status, unidadesEnviadas },
      '[site-vision/publish] success'
    );

    return NextResponse.json({
      success: true,
      siteProjectId,
      slug,
      status: body.status,
      unidadesEnviadas,
      message: `Empreendimento ${body.status === 'published' ? 'publicado no site real' : 'atualizado'} com sucesso!`,
    });
  } catch (error) {
    logger.error({ error }, '[site-vision/publish] error');
    return NextResponse.json({ error: 'Erro ao publicar empreendimento.' }, { status: 500 });
  }
}
