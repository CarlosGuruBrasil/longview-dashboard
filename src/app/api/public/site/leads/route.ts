import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createCrmLead } from '@/lib/cvcrm';
import { ensureSchema, sql } from '@/lib/pg';
import { recordIntegrationEvent } from '@/lib/integration-events';
import logger from '@/lib/logger';

type LeadRequestBody = {
  empreendimentoId?: string;
  nome?: string;
  email?: string;
  telefone?: string;
  mensagem?: string;
  origem?: string;
  utm?: Record<string, unknown>;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LeadRequestBody;
    const empreendimentoId = typeof body.empreendimentoId === 'string' ? body.empreendimentoId.trim() : '';
    const nome = typeof body.nome === 'string' ? body.nome.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const telefone = typeof body.telefone === 'string' ? body.telefone.trim() : '';
    const mensagem = typeof body.mensagem === 'string' ? body.mensagem.trim() : '';
    const origem = typeof body.origem === 'string' && body.origem.trim() ? body.origem.trim() : 'site_publico';

    if (!nome || (!email && !telefone)) {
      return NextResponse.json({ error: 'Nome e ao menos um contato são obrigatórios.' }, { status: 400 });
    }

    await ensureSchema();

    const [project] = empreendimentoId
      ? await sql<{ id: string; nome: string; cta_label: string }[]>`
          SELECT id, nome, cta_label
          FROM site_public_empreendimentos
          WHERE id = ${empreendimentoId} AND status_publicacao = 'published'
          LIMIT 1
        `
      : [];

    const submissionId = randomUUID();

    const crmResult = await createCrmLead({
      nome,
      email: email || undefined,
      telefone: telefone || undefined,
      origem: 'Site Público LongView',
      empreendimento: project?.nome,
      mensagem: mensagem || undefined,
      midia: origem,
    });

    const status = crmResult.ok ? 'sent' : 'error';
    const cvcrmLeadId = crmResult.ok && crmResult.id != null ? Number(crmResult.id) : null;
    const errorMessage = crmResult.ok ? '' : crmResult.error ?? 'erro_desconhecido';

    await sql`
      INSERT INTO site_public_lead_submissions (
        id,
        empreendimento_id,
        lead_nome,
        lead_email,
        lead_phone,
        source,
        status,
        cvcrm_lead_id,
        message,
        utm,
        payload,
        error_message,
        sent_to_cvcrm_at,
        created_at,
        updated_at
      ) VALUES (
        ${submissionId},
        ${project?.id ?? null},
        ${nome},
        ${email},
        ${telefone},
        ${origem},
        ${status},
        ${cvcrmLeadId},
        ${mensagem},
        ${sql.json((body.utm ?? {}) as never)},
        ${sql.json(body as never)},
        ${errorMessage},
        ${crmResult.ok ? new Date().toISOString() : null},
        NOW(),
        NOW()
      )
    `;

    await sql`
      INSERT INTO site_public_analytics_events (
        session_id,
        anonymous_id,
        event_name,
        page_url,
        page_path,
        site_empreendimento_id,
        button_name,
        source,
        utm,
        properties,
        consent_scope,
        created_at
      ) VALUES (
        ${request.headers.get('x-forwarded-for') ?? submissionId},
        ${submissionId},
        'lead_submit',
        '',
        empreendimentoId ? ${`/site/empreendimentos/${empreendimentoId}`} : '/site',
        ${project?.id ?? null},
        ${project?.cta_label ?? 'lead_form'},
        ${origem},
        ${sql.json((body.utm ?? {}) as never)},
        ${sql.json(({ nome, email, telefone, crmAction: crmResult.action ?? null }) as never)},
        ${sql.json({ necessary: true, analytics: false, marketing: false } as never)},
        NOW()
      )
    `;

    await recordIntegrationEvent({
      systemSource: 'site_public',
      systemTarget: 'cvcrm',
      entityType: 'lead',
      entityId: crmResult.id ?? submissionId,
      externalId: submissionId,
      status: crmResult.ok ? 'sent' : 'error',
      summary: crmResult.ok ? 'Lead do site enviado ao CV CRM' : 'Falha ao enviar lead do site ao CV CRM',
      detail: crmResult.ok ? crmResult.action ?? 'created' : errorMessage,
      payload: { empreendimentoId: project?.id ?? null, origem, email, telefone },
    });

    return NextResponse.json({
      ok: crmResult.ok,
      submissionId,
      crmLeadId: crmResult.id ?? null,
      action: crmResult.action ?? null,
      error: crmResult.ok ? null : errorMessage,
    }, { status: crmResult.ok ? 200 : 502 });
  } catch (error) {
    logger.error({ error }, '[public/site/leads] erro ao criar lead publico:');
    return NextResponse.json({ error: 'Erro ao enviar lead do site.' }, { status: 500 });
  }
}
