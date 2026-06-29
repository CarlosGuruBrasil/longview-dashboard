/**
 * GET /api/empreendimentos/[id]
 * Retorna dados completos do empreendimento: unidades, vendas e metadados.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { sql, ensureSchema } from '@/lib/pg';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id } = await params;
  const empId = parseInt(id, 10);
  if (isNaN(empId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  try {
    await ensureSchema();

    const [empRows, unidadesRows, vendasRows, materiaisRows] = await Promise.all([
      sql<{ id: number; nome: string; situacao: string; tipo: string; raw: Record<string, unknown> }[]>`
        SELECT id, nome, situacao, tipo, raw FROM cv_empreendimentos WHERE id = ${empId} LIMIT 1
      `,
      sql<{ id: number; bloco: string; numero: string; status: string; status_venda: number; valor: number; metragem: number; andar: number | null; coluna: number | null; tipologia: string | null; raw: Record<string, unknown> }[]>`
        SELECT id, bloco, numero, status, status_venda, valor, metragem, andar, coluna, tipologia, raw
        FROM cv_unidades WHERE id_empreendimento = ${empId}
        ORDER BY andar ASC NULLS LAST, coluna ASC NULLS LAST, numero ASC NULLS LAST
      `,
      sql<{ id: number; id_unidade: number; valor: number; data_venda: string; status: string; raw: Record<string, unknown> }[]>`
        SELECT id, id_unidade, valor, data_venda::text, status, raw
        FROM cv_vendas WHERE id_empreendimento = ${empId}
        ORDER BY data_venda DESC NULLS LAST
      `,
      sql<{ id: string; nome: string; tipo: string; content_type: string; size_bytes: number; uploaded_by: string; created_at: string }[]>`
        SELECT id, nome, tipo, content_type, size_bytes, uploaded_by, created_at::text
        FROM cv_materiais WHERE id_empreendimento = ${empId}
        ORDER BY created_at DESC
      `,
    ]);

    if (!empRows[0]) return NextResponse.json({ error: 'Empreendimento não encontrado' }, { status: 404 });

    const emp = empRows[0];
    const raw = emp.raw as Record<string, unknown>;

    // Foto de capa: imagem manual (override) > foto do CV CRM
    const hasManualImage = await sql<{ exists: boolean }[]>`
      SELECT EXISTS(SELECT 1 FROM cv_empreendimento_images WHERE id_empreendimento = ${empId}) AS exists
    `;
    const imageUrl = hasManualImage[0]?.exists
      ? `/api/empreendimentos/${empId}/image`
      : (raw.foto as string | null) ?? null;

    // Materiais do CV CRM (materiais_campanha + plantas)
    const cvMateriais = [
      ...((raw.materiais_campanha as { idarquivo: number; nome: string; titulo: string; tipo: string; tamanho: number; arquivo: string }[]) ?? []).map(m => ({
        id: `cv-mat-${m.idarquivo}`,
        nome: m.titulo || m.nome,
        tipo: 'campanha',
        sizeBytes: m.tamanho,
        downloadUrl: m.arquivo,
        fonte: 'cvcrm',
      })),
      ...((raw.plantas as { idplanta: number; nome: string; img_planta_servidor: string }[]) ?? []).map(p => ({
        id: `cv-planta-${p.idplanta}`,
        nome: p.nome,
        tipo: 'planta',
        sizeBytes: null,
        downloadUrl: p.img_planta_servidor,
        fonte: 'cvcrm',
      })),
    ];

    return NextResponse.json({
      empreendimento: {
        ...emp,
        imageUrl,
        tabela: raw.tabela ?? null,
        linkDisponibilidade: raw.link_disponibilidade ?? null,
        andamento: raw.andamento ?? null,
        dataEntrega: raw.data_entrega ?? null,
        segmento: (raw.segmento as { nome: string }[])?.[0]?.nome ?? null,
        situacaoObra: (raw.situacao_obra as { nome: string }[])?.[0]?.nome ?? null,
        foto: raw.foto ?? null,
        logo: raw.logo ?? null,
        endereco: raw.endereco ?? raw.logradouro ?? null,
        bairro: raw.bairro ?? null,
        cidade: raw.cidade ?? null,
        estado: raw.estado ?? null,
        latitude: raw.latitude ?? null,
        longitude: raw.longitude ?? null,
      },
      unidades: unidadesRows,
      vendas: vendasRows,
      cvMateriais,
      materiais: materiaisRows.map(m => ({
        ...m,
        downloadUrl: `/api/empreendimentos/${empId}/materiais/${m.id}`,
        fonte: 'manual',
      })),
    });
  } catch (e: unknown) {
    console.error('[GET /api/empreendimentos/[id]]', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
