/**
 * /api/meta/audiences
 *
 * POST → cria Custom Audience + faz upload da base CRM + cria Lookalike
 *   body: { type: 'compradores' | 'todos' | 'ativos', create_lookalike: boolean }
 *
 * GET  → lista audiências existentes na conta
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import axios from 'axios';
import crypto from 'crypto';

const META_BASE = 'https://graph.facebook.com/v21.0';
const ACT_ID    = process.env.META_ACT_ID;

function metaAuth() {
  return { access_token: process.env.META_TOKEN };
}

// SHA-256 hash normalizado para upload Meta
function hashField(value: string): string {
  if (!value) return '';
  return crypto.createHash('sha256').update(value.toLowerCase().trim()).digest('hex');
}

function hashPhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  // Normaliza: adiciona +55 se não tiver código país
  const normalized = digits.length === 11 || digits.length === 10
    ? `+55${digits}`
    : `+${digits}`;
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

// Busca clientes do CV CRM
async function fetchCRMContacts(filter: string): Promise<any[]> {
  const email  = process.env.CV_CRM_EMAIL;
  const token  = process.env.CV_CRM_TOKEN;
  const base   = 'https://longviewempreendimentos.cvcrm.com.br/api/v1';
  const headers = { email, token, Accept: 'application/json' };

  // Busca via endpoint de clientes (compradores com contrato)
  if (filter === 'compradores') {
    try {
      const res = await axios.get(`${base}/comercial/contratos`, {
        headers,
        params: { limit: 1000, situacao: 'ativo' },
        timeout: 20000,
      });
      const contratos = res.data?.contratos || res.data?.data || res.data || [];
      return Array.isArray(contratos) ? contratos : [];
    } catch {
      // fallback: leads com situação "Vendido"
      const res = await axios.get(`${base}/comercial/leads`, {
        headers,
        params: { limit: 2000, situacao: 'Vendido' },
        timeout: 20000,
      });
      return res.data?.leads || [];
    }
  }

  // Todos os leads
  const initial = await axios.get(`${base}/comercial/leads`, {
    headers,
    params: { limit: 1 },
    timeout: 15000,
  });
  const total     = initial.data?.total || 500;
  const maxLeads  = Math.min(total, 5000);
  const pages     = Math.ceil(maxLeads / 500);
  const promises  = Array.from({ length: pages }, (_, i) =>
    axios.get(`${base}/comercial/leads`, {
      headers,
      params: { limit: 500, offset: i * 500, ...(filter === 'ativos' ? { situacao: 'Ativo' } : {}) },
      timeout: 20000,
    })
  );
  const results = await Promise.allSettled(promises);
  return results
    .filter(r => r.status === 'fulfilled')
    .flatMap((r: any) => r.value.data?.leads || []);
}

// Normaliza contato CRM para schema Meta
function normalizeContact(c: any): { fn: string; email: string; phone: string } {
  return {
    fn:    (c.nome || c.name || c.nome_completo || '').trim(),
    email: (c.email || c.email_principal || '').toLowerCase().trim(),
    phone: (c.telefone || c.celular || c.fone || c.phone || '').replace(/\D/g, ''),
  };
}

// ─── GET: lista audiências existentes ─────────────────────────────────────────
export async function GET(request: NextRequest) {
  const admin = await verifyAdminAuth();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const res = await axios.get(`${META_BASE}/${ACT_ID}/customaudiences`, {
      params: {
        fields: 'id,name,description,approximate_count_lower_bound,approximate_count_upper_bound,subtype,delivery_status,operation_status,time_created,time_updated',
        limit: 100,
        ...metaAuth(),
      },
      timeout: 15000,
    });
    return NextResponse.json({ audiences: res.data?.data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.response?.data || err.message }, { status: 500 });
  }
}

// ─── POST: pipeline completo CRM → Meta ───────────────────────────────────────
export async function POST(request: NextRequest) {
  const admin = await verifyAdminAuth();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const ip = getClientIp(request);
  const rl = await rateLimit(`audiences:${ip}`, 5, 300); // 5 por 5 min
  if (!rl.success) {
    return NextResponse.json({ error: 'Muitas requisições. Aguarde 5 minutos.' }, { status: 429 });
  }

  const body = await request.json();
  const filter          = body.type || 'compradores';
  const createLookalike = body.create_lookalike !== false;

  const log: string[] = [];
  const result: any   = { log, audiences: [], upload: null, lookalike: null };

  try {
    // 1. Buscar contatos do CRM
    log.push(`[CRM] Buscando contatos — filtro: ${filter}`);
    const rawContacts = await fetchCRMContacts(filter);
    log.push(`[CRM] ${rawContacts.length} contatos encontrados`);

    const contacts = rawContacts
      .map(normalizeContact)
      .filter(c => c.email || c.phone);

    log.push(`[CRM] ${contacts.length} contatos válidos (com email ou telefone)`);

    if (contacts.length === 0) {
      return NextResponse.json({ ...result, error: 'Nenhum contato válido encontrado no CRM' }, { status: 422 });
    }

    // 2. Criar Custom Audience
    const audienceName = filter === 'compradores'
      ? 'LV | Compradores CRM | HBM'
      : filter === 'ativos'
        ? 'LV | Leads Ativos CRM'
        : 'LV | Base CRM Completa';

    const audienceDesc = filter === 'compradores'
      ? `Clientes com contrato ativo — seed para Lookalike HBM (${new Date().toLocaleDateString('pt-BR')})`
      : `Base CRM ${filter} — ${new Date().toLocaleDateString('pt-BR')}`;

    log.push(`[META] Criando audiência: ${audienceName}`);

    const createRes = await axios.post(
      `${META_BASE}/${ACT_ID}/customaudiences`,
      {
        name:                 audienceName,
        description:          audienceDesc,
        subtype:              'CUSTOM',
        customer_file_source: 'USER_PROVIDED_ONLY',
        retention_days:       180,
        ...metaAuth(),
      },
      { timeout: 15000 }
    );

    const audienceId = createRes.data?.id;
    log.push(`[META] Audiência criada: ID ${audienceId}`);
    result.audiences.push({ id: audienceId, name: audienceName, type: 'custom' });

    // 3. Preparar e fazer upload dos usuários (SHA-256)
    log.push(`[META] Preparando upload de ${contacts.length} contatos (SHA-256)`);

    const BATCH_SIZE = 500;
    let totalReceived = 0;
    let totalInvalid  = 0;

    for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
      const batch = contacts.slice(i, i + BATCH_SIZE);

      // Schema: FIRST_NAME | EMAIL | PHONE
      const payload = batch.map(c => [
        hashField(c.fn.split(' ')[0] || ''),
        hashField(c.email),
        hashPhone(c.phone),
      ]);

      const uploadRes = await axios.post(
        `${META_BASE}/${audienceId}/users`,
        {
          payload: {
            schema: ['FN', 'EMAIL', 'PHONE'],
            data: payload,
            is_raw: false, // já está hashed
          },
          ...metaAuth(),
        },
        { timeout: 30000 }
      );

      totalReceived += uploadRes.data?.num_received   || batch.length;
      totalInvalid  += uploadRes.data?.num_invalid_entries || 0;
      log.push(`[META] Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} enviados`);
    }

    result.upload = { total: contacts.length, received: totalReceived, invalid: totalInvalid };
    log.push(`[META] Upload concluído: ${totalReceived} recebidos, ${totalInvalid} inválidos`);

    // 4. Criar Lookalike (somente para compradores)
    if (createLookalike && filter === 'compradores') {
      log.push(`[META] Criando Lookalike 1% a partir da audiência de compradores`);

      const llRes = await axios.post(
        `${META_BASE}/${ACT_ID}/customaudiences`,
        {
          name:            'LV | Lookalike 1% Compradores | HBM',
          description:     `Lookalike 1% gerado a partir de compradores reais — ${new Date().toLocaleDateString('pt-BR')}`,
          subtype:         'LOOKALIKE',
          origin_audience_id: audienceId,
          lookalike_spec: JSON.stringify({
            type: 'similarity',
            ratio: 0.01,       // 1%
            country: 'BR',
          }),
          ...metaAuth(),
        },
        { timeout: 20000 }
      );

      const llId = llRes.data?.id;
      log.push(`[META] Lookalike criado: ID ${llId}`);
      result.lookalike = { id: llId, name: 'LV | Lookalike 1% Compradores | HBM' };
      result.audiences.push({ id: llId, name: 'LV | Lookalike 1% Compradores | HBM', type: 'lookalike' });

      // Também cria audiência de exclusão com a base completa se for compradores
      log.push(`[META] Criando audiência de exclusão (base completa CRM)`);
      const exclRes = await axios.post(
        `${META_BASE}/${ACT_ID}/customaudiences`,
        {
          name:                 'LV | Base CRM Completa | Exclusão',
          description:          `Todos os contatos CRM — usar como exclusão em prospecção (${new Date().toLocaleDateString('pt-BR')})`,
          subtype:              'CUSTOM',
          customer_file_source: 'USER_PROVIDED_ONLY',
          retention_days:       180,
          ...metaAuth(),
        },
        { timeout: 15000 }
      );
      const exclId = exclRes.data?.id;
      result.audiences.push({ id: exclId, name: 'LV | Base CRM Completa | Exclusão', type: 'exclusao' });
      log.push(`[META] Audiência de exclusão criada: ID ${exclId}`);
    }

    log.push(`[✓] Pipeline concluído com sucesso`);
    return NextResponse.json(result);

  } catch (err: any) {
    const metaErr = err.response?.data?.error;
    log.push(`[ERRO] ${metaErr?.message || err.message}`);
    return NextResponse.json({ ...result, error: metaErr?.message || err.message }, { status: 500 });
  }
}
