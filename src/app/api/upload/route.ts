import { NextRequest, NextResponse } from 'next/server';

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as Blob | null;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'Arquivo muito grande. O limite é 5 MB.' },
        { status: 413 }
      );
    }

    const originalName = file instanceof File ? file.name : 'documento';
    const mimeType = file.type || 'application/octet-stream';

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64}`;

    return NextResponse.json({
      url: dataUrl,
      name: originalName,
      size: `${(file.size / 1024).toFixed(1)} KB`
    });
  } catch (error) {
    console.error('Erro no upload de documento:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}
