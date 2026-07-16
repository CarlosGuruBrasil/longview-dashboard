/**
 * /api/webhooks/rdstation-reengagement
 *
 * Recebe o gatilho de uma Automação de Marketing do RD Station quando um
 * lead JÁ CADASTRADO abre um e-mail ou clica num link — e reativa o lead
 * correspondente no CV CRM (volta pra "Aguardando Atendimento").
 *
 * Não é o mesmo endpoint de "novo lead" (/api/webhooks/rdstation) — aquele
 * sempre trata o payload como cadastro novo. Reengajamento de e-mail precisa
 * de uma automação separada dentro do RD Station, com ação "Enviar para a
 * URL (integração)" apontando pra cá.
 *
 * Como o formato exato do payload da ação de webhook do RD varia por conta/
 * plano, e não temos como validar isso sem configurar a automação de
 * verdade, o evento (abriu e-mail vs. clicou link) vem pela query string —
 * é o jeito confiável de saber qual foi, independente do corpo enviado:
 *
 *   Automação "Abriu e-mail" → URL: .../api/webhooks/rdstation-reengagement?evento=abriu_email
 *   Automação "Clicou link"  → URL: .../api/webhooks/rdstation-reengagement?evento=clicou_link
 *
 * IMPORTANTE: a ação de webhook em fluxos do RD Station Marketing só existe
 * no plano Pro/Advanced — confirmar isso na conta antes de configurar.
 */
import { NextRequest, NextResponse } from 'next/server';
import { recordIntegrationEvent } from '@/lib/integration-events';
import logger from '@/lib/logger';

type RdLeadPayload = Record<string, unknown> & {
  email?: string;
  name?: string;
  contact?: { email?: string };
  leads?: RdLeadPayload[];
  lead?: RdLeadPayload;
};

const MOTIVO_POR_EVENTO: Record<string, string> = {
  abriu_email: "Reengajamento: abriu e-mail marketing (RD Station)",
  clicou_link: "Reengajamento: clicou em link de e-mail marketing (RD Station)",
};

function extrairEmail(body: RdLeadPayload): string {
  const leadObj = Array.isArray(body?.leads) ? body.leads[0] : (body?.lead ?? body);
  return (leadObj?.email ?? leadObj?.contact?.email ?? '').toString().trim();
}

export async function POST(request: NextRequest) {
  const evento = request.nextUrl.searchParams.get('evento') ?? 'interacao_desconhecida';

  let body: RdLeadPayload;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const email = extrairEmail(body);
  if (!email) {
    logger.warn({ body }, '[webhook/rdstation-reengagement] payload sem e-mail — não dá pra identificar o lead');
    return NextResponse.json({ ok: false, error: 'e-mail ausente no payload' }, { status: 400 });
  }

  const motivo = MOTIVO_POR_EVENTO[evento] ?? `Reengajamento: interação RD Station (${evento})`;
  await recordIntegrationEvent({
    systemSource: 'rdstation',
    systemTarget: 'longview',
    entityType: 'lead',
    entityId: email,
    externalId: email,
    status: 'received',
    summary: 'Webhook de reengajamento recebido do RD Station',
    detail: evento,
  });

  try {
    const { reengajarLeadPorContato } = await import('@/lib/leadReativacao');
    const result = await reengajarLeadPorContato({ email, motivo });
    logger.info(`[webhook/rdstation-reengagement] ${email} (${evento}) -> ${result.reason}`);
    await recordIntegrationEvent({
      systemSource: 'longview',
      systemTarget: 'cvcrm',
      entityType: 'lead',
      entityId: email,
      externalId: email,
      status: result.ok ? 'processed' : 'warning',
      summary: result.ok ? 'Lead reengajado no CV CRM a partir do RD Station' : 'Reengajamento sem efeito no CV CRM',
      detail: result.reason,
    });
    return NextResponse.json({ ok: result.ok, reason: result.reason });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error({ msg }, '[webhook/rdstation-reengagement]');
    await recordIntegrationEvent({
      systemSource: 'longview',
      systemTarget: 'cvcrm',
      entityType: 'lead',
      entityId: email,
      externalId: email,
      status: 'error',
      summary: 'Erro ao reengajar lead do RD Station no CV CRM',
      detail: msg,
    });
    // Não retorna 500 pra RD Station não entrar em loop de retry
    return NextResponse.json({ ok: true, warning: 'processed with errors' });
  }
}
