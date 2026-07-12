import { NextRequest, NextResponse } from 'next/server';
import { createCrmLead } from '@/lib/cvcrm';
import logger from '@/lib/logger';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function empFromCampaign(text: string): string {
  const s = (text || '').toLowerCase();
  if (s.includes('nautic'))                        return 'Nautic';
  if (s.includes('hub') || s.includes('beira mar') || s.includes('hbm')) return 'HUB Beira Mar';
  if (s.includes('infiniti'))                      return 'Infiniti';
  if (s.includes('sunclub') || s.includes('sun club')) return 'SunClub';
  if (s.includes('gran reserva'))                  return 'Gran Reserva';
  if (s.includes('le grand'))                      return 'Le Grand View';
  if (s.includes('porto da lagoa'))                return 'Porto da Lagoa';
  if (s.includes('south beach'))                   return 'South Beach';
  if (s.includes('trindade'))                      return 'Trindade';
  if (s.includes('exupery') || s.includes('exupéry')) return 'Exupéry';
  return '';
}

async function saveToPostgres(
  lead: any,
  parsed: {
    nome: string; email: string; telefone: string;
    empreendimento: string; origem: string; midia: string;
  },
  cvId?: string | number,
): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    const { sql, ensureSchema } = await import('@/lib/pg');
    await ensureSchema();

    const id = cvId ? String(cvId) : `rd_${lead.id || lead.uuid || parsed.email}`;
    const rdRaw = { ...lead, _source: 'rdstation_webhook', _parsed: parsed };

    const rawVal = cvId
      ? { _rd: rdRaw, origem: parsed.origem, midia_principal: parsed.midia }
      : rdRaw;

    await sql`
      INSERT INTO leads (
        id, nome, email, telefone, origem, status,
        empreendimento, score, temperatura,
        data_cadastro, data_atualizacao, raw, synced_at
      ) VALUES (
        ${id},
        ${parsed.nome     || null},
        ${parsed.email    || null},
        ${parsed.telefone || null},
        ${parsed.origem},
        ${'Novo'},
        ${parsed.empreendimento || null},
        ${null}, ${null},
        ${new Date().toISOString()},
        ${new Date().toISOString()},
        ${rawVal as never},
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        nome             = EXCLUDED.nome,
        email            = EXCLUDED.email,
        telefone         = EXCLUDED.telefone,
        origem           = COALESCE(leads.origem, EXCLUDED.origem),
        empreendimento   = COALESCE(leads.empreendimento, EXCLUDED.empreendimento),
        data_atualizacao = EXCLUDED.data_atualizacao,
        raw              = leads.raw || jsonb_build_object('_rd', ${rdRaw as never}),
        synced_at        = NOW()
    `;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    logger.warn({ msg }, '[rdstation/webhook] saveToPostgres falhou:');
  }
}

function sendFCMPush(nome: string, empreendimento: string, campanha: string): void {
  const baseUrl = process.env.NEXTAUTH_URL ?? 'https://app.guru.dev.br';
  const body = [empreendimento, campanha].filter(Boolean).join(' • ');

  fetch(`${baseUrl}/api/notifications/send`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      Authorization:   `Bearer ${process.env.CRON_SECRET}`,
    },
    body: JSON.stringify({
      title: '🎯 Novo Lead RD Station',
      body: `Nome: ${nome}\n${body}`,
      data: { url: '/marketing-vision' }
    })
  }).catch(err => {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, '[rdstation/webhook] Push FCM falhou');
  });
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    if (!data || !data.leads || !Array.isArray(data.leads)) {
      return NextResponse.json({ success: true, message: 'No leads found in payload' });
    }

    const processedCount = { cv: 0, db: 0 };

    for (const lead of data.leads) {
      // O RD Station envia custom_fields ou fields dependendo da versão
      const customFields = lead.custom_fields || {};
      
      const nome = lead.name || 'Sem nome';
      const email = lead.email || '';
      const telefone = lead.personal_phone || lead.mobile_phone || '';
      
      const cfEmpreendimento = customFields.cf_empreendimento || customFields.empreendimento || '';
      const cfMidia = customFields.cf_campanha_meta || customFields.cf_campanha || '';
      
      // Tentar extrair campanha da última conversão
      let conversionCampaign = '';
      if (lead.last_conversion && lead.last_conversion.conversion_origin) {
        conversionCampaign = lead.last_conversion.conversion_origin.source || lead.last_conversion.conversion_origin.campaign || '';
      }
      
      const midia = cfMidia || conversionCampaign || 'RD Station';
      const origem = 'RD Station';
      const empreendimento = cfEmpreendimento || empFromCampaign(midia) || empFromCampaign(lead.last_conversion?.content || '');

      // Extrai campos customizados informativos para a mensagem do CV CRM
      const extraInfo: string[] = [];
      const ignoredKeys = ['cf_empreendimento', 'empreendimento', 'cf_campanha_meta', 'cf_campanha'];
      
      for (const [key, val] of Object.entries(customFields)) {
        if (!ignoredKeys.includes(key) && val !== null && val !== undefined && val !== '') {
          // Formata a chave para ficar mais legível: 'voce_procura_imovel' -> 'Voce Procura Imovel'
          const readableKey = key.replace(/^cf_/, '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          extraInfo.push(`${readableKey}: ${val}`);
        }
      }
      
      const mensagem = extraInfo.length > 0 ? extraInfo.join(' | ') : undefined;

      const parsed = {
        nome,
        email,
        telefone,
        empreendimento,
        origem,
        midia,
        mensagem
      };

      // Tenta criar no CV CRM
      let cvId: string | number | undefined;
      try {
        const createParams = {
          nome,
          email,
          telefone,
          idempreendimento: undefined, // ID numérico, se aplicável
          origem,
          midia: midia,
          mensagem
        };
        const cvRes = await createCrmLead(createParams);
        cvId = cvRes?.id;
        if (cvId) processedCount.cv++;
      } catch (cvErr: unknown) {
        logger.warn({ cvErr: cvErr instanceof Error ? cvErr.message : String(cvErr) }, '[rdstation/webhook] CV CRM failed');
      }

      // Salva no Postgres
      await saveToPostgres(lead, parsed, cvId);
      processedCount.db++;

      // Envia notificação Push
      sendFCMPush(nome, empreendimento, midia);
    }

    return NextResponse.json({ success: true, processedCount });

  } catch (error) {
    logger.error({ error }, '[rdstation/webhook] Erro no processamento do webhook');
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
