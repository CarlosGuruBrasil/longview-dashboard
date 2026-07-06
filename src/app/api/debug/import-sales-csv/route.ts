import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { sql, ensureSchema } from '@/lib/pg';

const JWT_SECRET = process.env.JWT_SECRET || 'secret-longview-key';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type AuthUser = {
  role?: string;
  permissions?: {
    isAdmin?: boolean;
  };
};

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
  // 1. Validar autenticação (apenas Desenvolvedor ou Admin podem importar dados legados)
  const user = await verifyAuth();
  const isAuthSecret = request.headers.get('Authorization') === `Bearer ${process.env.CRON_SECRET}`;
  
  if (!user && !isAuthSecret) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  if (user) {
    const canImport = user.role === 'Desenvolvedor' || user.permissions?.isAdmin === true;
    if (!canImport) {
      return NextResponse.json({ error: 'Sem permissão para importar dados.' }, { status: 403 });
    }
  }

  try {
    const body = await request.json();
    const records = Array.isArray(body?.vendas) ? body.vendas : [];

    if (records.length === 0) {
      return NextResponse.json({ error: 'Envie um array de vendas no campo "vendas".' }, { status: 400 });
    }

    await ensureSchema();
    console.log(`[import-sales] Iniciando importação manual de ${records.length} vendas...`);

    let imported = 0;
    
    // Batch upsert individual para garantir tratamento de datas e valores
    for (const v of records) {
      const vendaId = v.idvenda ?? v.idreserva ?? v.id ?? null;
      if (!vendaId) continue;

      const dVenda = v.data_venda ? new Date(v.data_venda) : null;
      const valor = v.valor_venda ?? v.valor_contrato ?? v.valor ?? null;
      const valorNum = valor ? parseFloat(String(valor)) : null;

      // Garantir formato mínimo exigido pelo front-end no campo raw
      const rawPayload = {
        idvenda: vendaId,
        idreserva: vendaId,
        idempreendimento: v.idempreendimento || null,
        idunidade: v.idunidade || null,
        valor_venda: valorNum,
        valor_contrato: valorNum,
        data_venda: v.data_venda || null,
        data_reserva: v.data_reserva || v.data_venda || null,
        situacao: v.situacao || v.status || 'Vendida',
        cliente: v.cliente || null,
        corretor: v.corretor || null,
        imobiliaria: v.imobiliaria || null,
        empreendimento: v.empreendimento || null,
        bloco: v.bloco || null,
        unidade: v.unidade || null,
        tipovenda: v.tipovenda || null,
        planta: v.planta || null,
        associados: v.associados || []
      };

      await sql`
        INSERT INTO cv_vendas (
          id, id_empreendimento, id_unidade, valor, data_venda, status, raw, synced_at
        ) VALUES (
          ${vendaId},
          ${v.idempreendimento ?? null},
          ${v.idunidade ?? null},
          ${valorNum},
          ${dVenda},
          ${rawPayload.situacao},
          ${JSON.stringify(rawPayload)}::jsonb,
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          id_empreendimento = EXCLUDED.id_empreendimento,
          id_unidade = EXCLUDED.id_unidade,
          valor = EXCLUDED.valor,
          data_venda = EXCLUDED.data_venda,
          status = EXCLUDED.status,
          raw = EXCLUDED.raw,
          synced_at = NOW()
      `;

      imported++;
    }

    // Opcional: Acionar recálculo do BI
    try {
      const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
      await fetch(`${baseUrl}/api/cron/sync-bi`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` }
      });
      console.log('[import-sales] BI recalculado com sucesso.');
    } catch (biErr) {
      console.warn('[import-sales] Falha ao disparar sync-bi:', biErr);
    }

    console.log(`[import-sales] Importação concluída. ${imported} vendas inseridas/atualizadas.`);
    return NextResponse.json({ ok: true, message: 'Vendas importadas com sucesso', importadas: imported });

  } catch (err: any) {
    console.error('[import-sales] Erro na importação:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
