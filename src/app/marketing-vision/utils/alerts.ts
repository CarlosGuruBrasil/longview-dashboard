/**
 * alerts.ts — Motor de alertas LongView
 *
 * Avalia condições de alerta com base nos dados do CV CRM e Meta Ads.
 * Client-safe: sem imports de Node.js.
 *
 * Thresholds ajustáveis por segmento:
 *   CPL_WARN_BRL       — custo por lead que aciona aviso (default R$200)
 *   CPL_CRITICAL_BRL   — custo por lead que aciona crítico (default R$400)
 *   ATTENDANCE_WARN    — taxa de atendimento mínima ideal (default 60%)
 *   ATTENDANCE_CRITICAL— taxa crítica de atendimento (default 30%)
 *   WAITING_HOURS_WARN — horas em "aguardando" antes de avisar (default 24h)
 */

import type { Lead, MetaData } from '../types';
import { toISODate, getLeadDate } from './leads';
import { getLeadStage } from './metrics';

// ─── Thresholds ───────────────────────────────────────────────────────────────
const CPL_WARN_BRL       = 200;
const CPL_CRITICAL_BRL   = 400;
const ATTENDANCE_WARN    = 0.60;
const ATTENDANCE_CRITICAL = 0.30;
const WAITING_HOURS_WARN = 24;
const WAITING_HOURS_CRITICAL = 48;
const DAYS_BACK_FUNNEL   = 30;  // janela para calcular taxas do funil
const DAYS_ZERO_LEADS    = 7;   // sem leads novos nesse período = alerta

// ─── Types ───────────────────────────────────────────────────────────────────
export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertCategory = 'crm' | 'campaign' | 'funnel';

export interface DashboardAlert {
  id: string;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  description: string;
  suggestion: string;
  value?: number;
  threshold?: number;
  /** Formatted value for display (e.g. "R$ 350" or "12 leads") */
  displayValue?: string;
  meta?: Record<string, unknown>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

function hoursAgo(n: number): Date {
  return new Date(Date.now() - n * 60 * 60 * 1000);
}

function getLeadISO(lead: Lead): string {
  return toISODate(getLeadDate(lead));
}

// ─── CRM Alerts ──────────────────────────────────────────────────────────────

/**
 * Leads em "aguardando atendimento" há mais de X horas
 */
function alertLeadsWaiting(leads: Lead[]): DashboardAlert[] {
  const warnCutoff     = hoursAgo(WAITING_HOURS_WARN);
  const criticalCutoff = hoursAgo(WAITING_HOURS_CRITICAL);

  const waiting = leads.filter(lead => {
    if (!lead.situacao?.nome) return false;
    const s = lead.situacao.nome.toLowerCase().trim();
    return s.includes('aguardando atendimento');
  });

  if (waiting.length === 0) return [];

  // Categoriza por tempo (usa data de cadastro como proxy)
  const longWaiting = waiting.filter(lead => {
    const iso = getLeadISO(lead);
    if (!iso) return false;
    // data_cad pode ter hora, senão assume início do dia
    const raw = lead.data_cad || lead.data_cadastro || lead.data_cadastramento || '';
    const d = raw ? new Date(raw.replace(' ', 'T')) : new Date(iso);
    return d < criticalCutoff;
  });

  const mediumWaiting = waiting.filter(lead => {
    const raw = lead.data_cad || lead.data_cadastro || lead.data_cadastramento || '';
    const d = raw ? new Date(raw.replace(' ', 'T')) : new Date(getLeadISO(lead) || Date.now());
    return d >= criticalCutoff && d < warnCutoff;
  });

  const alerts: DashboardAlert[] = [];

  if (longWaiting.length > 0) {
    alerts.push({
      id: 'crm-sem-atendimento-critical',
      severity: 'critical',
      category: 'crm',
      title: `${longWaiting.length} lead${longWaiting.length > 1 ? 's' : ''} sem atendimento há +${WAITING_HOURS_CRITICAL}h`,
      description: `${longWaiting.length} lead${longWaiting.length > 1 ? 's estão' : ' está'} aguardando atendimento por mais de ${WAITING_HOURS_CRITICAL} horas. Leads frios têm taxa de conversão drasticamente menor.`,
      suggestion: 'Redistribuir leads entre SDRs agora. Leads frios (>48h) têm chance de conversão até 80% menor. Priorize os mais antigos.',
      value: longWaiting.length,
      displayValue: `${longWaiting.length} leads`,
    });
  }

  if (mediumWaiting.length > 0) {
    alerts.push({
      id: 'crm-sem-atendimento-warning',
      severity: 'warning',
      category: 'crm',
      title: `${mediumWaiting.length} lead${mediumWaiting.length > 1 ? 's' : ''} aguardando atendimento > ${WAITING_HOURS_WARN}h`,
      description: `${mediumWaiting.length} lead${mediumWaiting.length > 1 ? 's' : ''} no estágio "Aguardando Atendimento" por mais de ${WAITING_HOURS_WARN} horas.`,
      suggestion: 'Acionar SDR para contato. Leads respondidos nas primeiras 5 minutos têm 9x mais chance de conversão.',
      value: mediumWaiting.length,
      displayValue: `${mediumWaiting.length} leads`,
    });
  }

  return alerts;
}

/**
 * Taxa de atendimento dos últimos 30 dias abaixo do ideal
 */
function alertAttendanceRate(leads: Lead[]): DashboardAlert[] {
  const cutoff = daysAgo(DAYS_BACK_FUNNEL);
  const recent = leads.filter(l => {
    const iso = getLeadISO(l);
    return iso >= cutoff;
  });

  if (recent.length < 5) return []; // Amostra insuficiente

  const attended = recent.filter(l =>
    ['attended', 'scheduled', 'visited'].includes(getLeadStage(l))
  );

  const rate = attended.length / recent.length;

  if (rate < ATTENDANCE_CRITICAL) {
    return [{
      id: 'funnel-taxa-atendimento-critica',
      severity: 'critical',
      category: 'funnel',
      title: `Taxa de atendimento crítica: ${(rate * 100).toFixed(0)}%`,
      description: `Apenas ${(rate * 100).toFixed(0)}% dos ${recent.length} leads dos últimos ${DAYS_BACK_FUNNEL} dias foram atendidos. Meta mínima: ${(ATTENDANCE_WARN * 100).toFixed(0)}%.`,
      suggestion: 'Verificar capacidade da equipe. Considerar automação de atendimento inicial (bot qualificador) e redistribuição de carga entre corretores.',
      value: rate,
      threshold: ATTENDANCE_WARN,
      displayValue: `${(rate * 100).toFixed(0)}%`,
    }];
  }

  if (rate < ATTENDANCE_WARN) {
    return [{
      id: 'funnel-taxa-atendimento-baixa',
      severity: 'warning',
      category: 'funnel',
      title: `Taxa de atendimento abaixo do ideal: ${(rate * 100).toFixed(0)}%`,
      description: `${(rate * 100).toFixed(0)}% dos leads atendidos nos últimos ${DAYS_BACK_FUNNEL} dias. Referência mínima: ${(ATTENDANCE_WARN * 100).toFixed(0)}%.`,
      suggestion: 'Verificar gargalos no processo de atendimento. Implementar follow-up automatizado para leads não respondidos.',
      value: rate,
      threshold: ATTENDANCE_WARN,
      displayValue: `${(rate * 100).toFixed(0)}%`,
    }];
  }

  return [];
}

/**
 * Nenhum lead novo nos últimos N dias
 */
function alertNoNewLeads(leads: Lead[]): DashboardAlert[] {
  const cutoff = daysAgo(DAYS_ZERO_LEADS);
  const recent = leads.filter(l => getLeadISO(l) >= cutoff);

  if (recent.length === 0 && leads.length > 0) {
    return [{
      id: 'crm-zero-leads-semana',
      severity: 'critical',
      category: 'crm',
      title: `Nenhum lead novo nos últimos ${DAYS_ZERO_LEADS} dias`,
      description: 'Não houve entrada de novos leads neste período. Possível problema de integração com CV CRM ou campanhas inativas.',
      suggestion: 'Verificar: (1) status das campanhas no Meta Ads, (2) sincronização com CV CRM, (3) formulários de captação ativos.',
    }];
  }

  return [];
}

// ─── Campaign Alerts ──────────────────────────────────────────────────────────

/**
 * Todas as campanhas estão pausadas
 */
function alertAllCampaignsPaused(meta: MetaData): DashboardAlert[] {
  const details = meta.campaignDetails ?? [];
  if (details.length === 0) return [];

  const allPaused = details.every(c => c.status !== 'ACTIVE');
  if (allPaused) {
    const statuses = [...new Set(details.map(c => c.status))].join(', ');
    return [{
      id: 'campaign-all-paused',
      severity: 'critical',
      category: 'campaign',
      title: 'Todas as campanhas estão pausadas',
      description: `Nenhuma campanha está ativa no Meta Ads (status: ${statuses}). Nenhum lead está sendo gerado agora.`,
      suggestion: 'Acesse o Gerenciador de Anúncios do Meta urgente. Verifique método de pagamento, aprovação de anúncios e possíveis violações de política.',
      meta: { campaignCount: details.length, statuses },
    }];
  }

  return [];
}

/**
 * Campanhas ativas com zero gasto (pode indicar problema de aprovação ou orçamento)
 */
function alertCampaignZeroSpend(meta: MetaData): DashboardAlert[] {
  const details  = meta.campaignDetails ?? [];
  const insights = meta.campaigns ?? [];
  const alerts: DashboardAlert[] = [];

  const activeCampaigns = details.filter(c => c.status === 'ACTIVE');
  for (const camp of activeCampaigns) {
    const insight = insights.find(ci => ci.campaign_id === camp.id);
    const spend = parseFloat(insight?.spend ?? '0');

    if (spend === 0) {
      alerts.push({
        id: `campaign-zero-spend-${camp.id}`,
        severity: 'warning',
        category: 'campaign',
        title: `Campanha ativa sem gasto: "${camp.name}"`,
        description: 'A campanha está marcada como ATIVA mas não registrou gasto algum. Pode estar aguardando aprovação ou com problema de orçamento.',
        suggestion: 'Verificar no Gerenciador de Anúncios: aprovação de criativos, método de pagamento, limite de gasto da campanha.',
        meta: { campaignId: camp.id, campaignName: camp.name },
      });
    }
  }

  return alerts;
}

/**
 * CPL (custo por lead) acima dos thresholds para a conta como um todo
 */
function alertHighCPL(meta: MetaData): DashboardAlert[] {
  const globalInsight = meta.global;
  if (!globalInsight) return [];

  const spend = parseFloat(globalInsight.spend ?? '0');
  if (spend === 0) return [];

  const actions = globalInsight.actions ?? [];
  const leadAction = actions.find((a: { action_type: string; value?: string }) =>
    a.action_type === 'lead' || a.action_type === 'onsite_conversion.lead_grouped'
  );
  const totalLeads = leadAction ? parseFloat(leadAction.value ?? '0') : 0;
  if (totalLeads === 0) return [];

  const cpl = spend / totalLeads;

  if (cpl > CPL_CRITICAL_BRL) {
    return [{
      id: 'campaign-cpl-critical',
      severity: 'critical',
      category: 'campaign',
      title: `CPL crítico: R$ ${cpl.toFixed(0)}/lead`,
      description: `Custo por lead de R$ ${cpl.toFixed(0)} está muito acima do ideal para imóveis (referência: R$ 80–${CPL_WARN_BRL}). Total gasto: R$ ${spend.toFixed(0)} para ${totalLeads.toFixed(0)} leads.`,
      suggestion: 'Ação imediata: pausar campanhas de baixo desempenho, revisar segmentação de público, testar novos criativos com CTA mais forte.',
      value: cpl,
      threshold: CPL_CRITICAL_BRL,
      displayValue: `R$ ${cpl.toFixed(0)}/lead`,
      meta: { spend, totalLeads, cpl },
    }];
  }

  if (cpl > CPL_WARN_BRL) {
    return [{
      id: 'campaign-cpl-warning',
      severity: 'warning',
      category: 'campaign',
      title: `CPL acima do ideal: R$ ${cpl.toFixed(0)}/lead`,
      description: `Custo por lead de R$ ${cpl.toFixed(0)} está acima da referência para imóveis (R$ 80–${CPL_WARN_BRL}). Total: ${totalLeads.toFixed(0)} leads com R$ ${spend.toFixed(0)} investidos.`,
      suggestion: 'Revisar segmentação de público, testar novos criativos, verificar relevância dos anúncios. Considerar lookalike audiences de clientes que converteram.',
      value: cpl,
      threshold: CPL_WARN_BRL,
      displayValue: `R$ ${cpl.toFixed(0)}/lead`,
      meta: { spend, totalLeads, cpl },
    }];
  }

  return [];
}

/**
 * Nenhum lead gerado pelo Meta nos últimos 7 dias de dados diários
 */
function alertNoMetaLeadsRecently(meta: MetaData): DashboardAlert[] {
  const daily = meta.daily ?? [];
  if (daily.length < 3) return []; // Sem dados suficientes

  // Últimos 7 dias
  const sorted = [...daily].sort((a, b) => b.date_start?.localeCompare(a.date_start ?? '') ?? 0);
  const last7 = sorted.slice(0, 7);

  const totalRecentLeads = last7.reduce((sum, day) => {
    const dayActions = (day.actions ?? []) as { action_type: string; value?: string }[];
    const leadAct = dayActions.find(a =>
      a.action_type === 'lead' || a.action_type === 'onsite_conversion.lead_grouped'
    );
    return sum + parseFloat(leadAct?.value ?? '0');
  }, 0);

  const totalRecentSpend = last7.reduce((sum, day) => sum + parseFloat(day.spend ?? '0'), 0);

  if (totalRecentLeads === 0 && totalRecentSpend > 50) {
    return [{
      id: 'campaign-zero-meta-leads',
      severity: 'critical',
      category: 'campaign',
      title: 'Zero leads do Meta nos últimos 7 dias',
      description: `R$ ${totalRecentSpend.toFixed(0)} gastos nos últimos 7 dias sem geração de leads. Possível problema no formulário de captação ou pixel.`,
      suggestion: 'Verificar: (1) formulários de lead ativos no Meta, (2) pixel de conversão, (3) se os anúncios estão direcionando para o formulário correto.',
      meta: { spend7d: totalRecentSpend },
    }];
  }

  return [];
}

// ─── Main evaluate function ───────────────────────────────────────────────────

/**
 * Avalia todas as condições de alerta e retorna lista ordenada por severidade.
 * Seguro para uso client-side (sem Node imports).
 */
export function evaluateAlerts(leads: Lead[], meta: MetaData | null): DashboardAlert[] {
  const all: DashboardAlert[] = [];

  // CRM / Funil
  all.push(...alertLeadsWaiting(leads));
  all.push(...alertAttendanceRate(leads));
  all.push(...alertNoNewLeads(leads));

  // Campanhas
  if (meta) {
    all.push(...alertAllCampaignsPaused(meta));
    all.push(...alertCampaignZeroSpend(meta));
    all.push(...alertHighCPL(meta));
    all.push(...alertNoMetaLeadsRecently(meta));
  }

  // Ordena: critical → warning → info
  const order: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return all.sort((a, b) => order[a.severity] - order[b.severity]);
}

/** Conta alertas por severidade */
export function countAlerts(alerts: DashboardAlert[]): { critical: number; warning: number; info: number } {
  return {
    critical: alerts.filter(a => a.severity === 'critical').length,
    warning:  alerts.filter(a => a.severity === 'warning').length,
    info:     alerts.filter(a => a.severity === 'info').length,
  };
}
