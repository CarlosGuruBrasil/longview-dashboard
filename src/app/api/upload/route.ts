import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

const JWT_SECRET    = process.env.JWT_SECRET ?? (() => { throw new Error('[LongView] JWT_SECRET nao configurado. Defina no .env.local') })();
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

type AuthUser = {
  userId?: string;
};

// MIME types permitidos para upload
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

async function verifyAuth(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return null;
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  // Autenticação obrigatória
  const authUser = await verifyAuth();
  if (!authUser) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  // Rate limiting: 20 uploads por minuto por usuário
  const ip = getClientIp(request);
  const rl = await rateLimit(`upload:${authUser.userId ?? ip}`, 20, 60);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Limite de uploads atingido. Aguarde um minuto.' },
      { status: 429 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as Blob | null;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: `Arquivo muito grande. O limite é ${MAX_SIZE_BYTES / 1024 / 1024} MB.` },
        { status: 413 }
      );
    }

    const mimeType     = file.type || 'application/octet-stream';
    const originalName = file instanceof File ? file.name : 'documento';

    // Validar MIME type
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        { error: `Tipo de arquivo não permitido: ${mimeType}` },
        { status: 415 }
      );
    }

    // Usar base64 data URL (funciona em qualquer ambiente)
    const buffer  = Buffer.from(await file.arrayBuffer());
    const base64  = buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64}`;

    return NextResponse.json({
      url:  dataUrl,
      name: originalName,
      size: `${(file.size / 1024).toFixed(1)} KB`,
      via:  'base64',
    });
  } catch (error) {
    console.error('[/api/upload] Erro:', error);
    return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 });
  }
}
