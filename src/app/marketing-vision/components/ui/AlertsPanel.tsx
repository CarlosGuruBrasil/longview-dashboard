'use client'

/**
 * AlertsPanel — Painel de alertas em tempo real
 *
 * Computa alertas a partir dos dados já disponíveis no DataContext (sem API call).
 * Mostra resumo colapsável com severidade, descrição e sugestão de ação.
 */

import { useMemo, useState } from 'react'
import { useData } from '../../context/DataContext'
import { evaluateAlerts, countAlerts } from '../../utils/alerts'
import type { DashboardAlert, AlertSeverity } from '../../utils/alerts'

// ─── Config visual ────────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<AlertSeverity, {
  bgBorder: string
  badgeBg: string
  icon: string
  label: string
  dot: string
}> = {
  critical: {
    bgBorder:  'border-red-500/40 bg-red-950/30',
    badgeBg:   'bg-red-600',
    icon:      '🔴',
    label:     'CRÍTICO',
    dot:       'bg-red-500',
  },
  warning: {
    bgBorder:  'border-amber-500/40 bg-amber-950/20',
    badgeBg:   'bg-amber-600',
    icon:      '🟡',
    label:     'ATENÇÃO',
    dot:       'bg-amber-400',
  },
  info: {
    bgBorder:  'border-sky-500/30 bg-sky-950/20',
    badgeBg:   'bg-sky-600',
    icon:      'ℹ️',
    label:     'INFO',
    dot:       'bg-sky-400',
  },
}

const CATEGORY_LABEL: Record<DashboardAlert['category'], string> = {
  crm:      'CRM',
  campaign: 'Campanha',
  funnel:   'Funil',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AlertCard({ alert }: { alert: DashboardAlert }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = SEVERITY_CONFIG[alert.severity]

  return (
    <div className={`rounded-xl border p-4 transition-colors ${cfg.bgBorder}`}>
      <div className="flex items-start gap-3">
        {/* Dot */}
        <span className={`mt-1.5 flex-shrink-0 w-2 h-2 rounded-full ${cfg.dot}`} />

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded text-white ${cfg.badgeBg}`}
            >
              {cfg.label}
            </span>
            <span className="text-[10px] text-zinc-500 uppercase tracking-wide">
              {CATEGORY_LABEL[alert.category]}
            </span>
            {alert.displayValue && (
              <span className="ml-auto text-xs font-semibold text-zinc-300 tabular-nums">
                {alert.displayValue}
              </span>
            )}
          </div>

          {/* Title */}
          <p className="text-sm font-semibold text-zinc-100 leading-snug">
            {alert.title}
          </p>

          {/* Description (collapsible) */}
          {expanded && (
            <p className="mt-1.5 text-xs text-zinc-400 leading-relaxed">
              {alert.description}
            </p>
          )}

          {/* Suggestion */}
          <div className={`mt-2 rounded-lg px-3 py-2 ${expanded ? 'bg-white/5' : 'hidden'}`}>
            <p className="text-[11px] font-medium text-zinc-300 mb-0.5">💡 Sugestão</p>
            <p className="text-xs text-zinc-400 leading-relaxed">{alert.suggestion}</p>
          </div>

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded(v => !v)}
            className="mt-2 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
          >
            {expanded ? (
              <><span>▲</span> Ocultar detalhes</>
            ) : (
              <><span>▼</span> Ver detalhes e sugestão</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Summary bar ──────────────────────────────────────────────────────────────

function SummaryBar({
  counts,
  open,
  onToggle,
}: {
  counts: ReturnType<typeof countAlerts>
  open: boolean
  onToggle: () => void
}) {
  const hasCritical = counts.critical > 0
  const hasWarning  = counts.warning > 0
  const hasAny      = hasCritical || hasWarning || counts.info > 0

  if (!hasAny) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-600/30 bg-emerald-950/20">
        <span className="text-emerald-400 text-sm">✓</span>
        <span className="text-xs text-emerald-400 font-medium">Tudo sob controle — nenhum alerta ativo</span>
      </div>
    )
  }

  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all text-left
        ${hasCritical
          ? 'border-red-500/40 bg-red-950/25 hover:bg-red-950/40'
          : 'border-amber-500/30 bg-amber-950/15 hover:bg-amber-950/30'
        }`}
    >
      {/* Pulse indicator for critical */}
      {hasCritical && (
        <span className="relative flex-shrink-0 w-2.5 h-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
        </span>
      )}

      {/* Counts */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {hasCritical && (
          <span className="flex items-center gap-1 text-xs font-semibold text-red-400">
            <span>🔴</span>
            {counts.critical} crítico{counts.critical > 1 ? 's' : ''}
          </span>
        )}
        {hasWarning && (
          <span className="flex items-center gap-1 text-xs font-semibold text-amber-400">
            <span>🟡</span>
            {counts.warning} aviso{counts.warning > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Expand hint */}
      <span className="text-[11px] text-zinc-500 flex-shrink-0">
        {open ? '▲ Ocultar' : '▼ Ver alertas'}
      </span>
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AlertsPanel() {
  const { allLeads, metaData } = useData()
  const [open, setOpen] = useState(true)

  // Computa alertas do DataContext (sem API call — dados já disponíveis)
  const alerts = useMemo(
    () => evaluateAlerts(allLeads, metaData),
    [allLeads, metaData]
  )

  const counts = useMemo(() => countAlerts(alerts), [alerts])

  // Auto-fecha se tudo estiver ok
  const hasAlerts = alerts.length > 0

  return (
    <div className="flex flex-col gap-2">
      <SummaryBar
        counts={counts}
        open={open}
        onToggle={() => setOpen(v => !v)}
      />

      {open && hasAlerts && (
        <div className="flex flex-col gap-2">
          {alerts.map(alert => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      )}
    </div>
  )
}
