import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { sql, ensureSchema } from '@/lib/pg';
import { randomUUID } from 'crypto';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  const { id } = await params;
  const empId = parseInt(id, 10);
  await ensureSchema();
  const rows = await sql<{ id: string; nome: string; tipo: string; content_type: string; size_bytes: number; uploaded_by: string; created_at: string }[]>`
    SELECT id, nome, tipo, content_type, size_bytes, uploaded_by, created_at::text
    FROM cv_materiais WHERE id_empreendimento = ${empId} ORDER BY created_at DESC
  `;
  return NextResponse.json({
    materiais: rows.map(m => ({ ...m, downloadUrl: `/api/empreendimentos/${empId}/materiais/${m.id}` })),
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id } = await params;
  const empId = parseInt(id, 10);

  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'Arquivo obrigatório' }, { status: 400 });
  if (file.size > 100 * 1024 * 1024) return NextResponse.json({ error: 'Máx 100 MB' }, { status: 413 });

  const tipo = (form.get('tipo') as string) || 'outro';
  const nome = (form.get('nome') as string) || file.name;
  const docId = randomUUID();
  const buf  = Buffer.from(await file.arrayBuffer());

  await ensureSchema();
  await sql`
    INSERT INTO cv_materiais (id, id_empreendimento, nome, tipo, content_type, size_bytes, data, uploaded_by)
    VALUES (${docId}, ${empId}, ${nome}, ${tipo}, ${file.type || 'application/octet-stream'},
            ${file.size}, ${buf}, ${user.name})
  `;

  return NextResponse.json({
    material: { id: docId, nome, tipo, contentType: file.type, sizeBytes: file.size,
      uploadedBy: user.name, downloadUrl: `/api/empreendimentos/${empId}/materiais/${docId}` },
  }, { status: 201 });
}
