'use client'

import { useMemo } from 'react'
import { ArrowDown } from 'lucide-react'
import type { Lead } from '../../types'
import { formatNumber } from '../../utils/formatters'
import { funnelCounts, type FunnelStage } from '../../utils/funnel'
import { useData } from '../../context/DataContext'

interface Props {
  leads: Lead[]
}

const STAGES = [
  { color: '#0ea5e9', bg: 'rgba(14,165,233,0.10)', border: 'rgba(14,165,233,0.25)' },
  { color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)', border: 'rgba(139,92,246,0.25)' },
  { color: '#ec4899', bg: 'rgba(236,72,153,0.10)', border: 'rgba(236,72,153,0.25)' },
  { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)' },
  { color: '#10b981', bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.25)' },
]

const DIAG_COLORS = {
  excelente: { text: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' },
  bom:       { text: '#0ea5e9', bg: 'rgba(14,165,233,0.12)', border: 'rgba(14,165,233,0.3)' },
  regular:   { text: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
  abaixo:    { text: '#f43f5e', bg: 'rgba(244,63,94,0.12)', border: 'rgba(244,63,94,0.3)' },
}

function getDiag(val: number, meta: number) {
  if (val >= meta)         return { label: 'Meta batida', ...DIAG_COLORS.excelente }
  if (val >= meta * 0.7)  return { label: 'Bom', ...DIAG_COLORS.bom }
  if (val >= meta * 0.45) return { label: 'Regular', ...DIAG_COLORS.regular }
  return                          { label: 'Abaixo da meta', ...DIAG_COLORS.abaixo }
}

export default function FunnelVisualization({ leads }: Props) {
  const { leadFilters, setLeadFilters } = useData()

  const stages = useMemo(() => {
    // Etapas e contagens vêm de utils/funnel.ts — mesma fonte do DashboardView
    const c = funnelCounts(leads)

    const pct = (n: number) => c.ativos > 0 ? Math.round((n / c.ativos) * 100) : 0
    const conv = (n: number, d: number) => d > 0 ? Math.round((n / d) * 100) : 0

    return [
      {
        name: 'Captação (Ativos)',
        count: c.ativos,
        pct: 100,
        conv: 100,
        diag: null,
        stageFilter: null as FunnelStage | null,
      },
      {
        name: 'Em Atendimento',
        count: c.atendimento,
        pct: pct(c.atendimento),
        conv: conv(c.atendimento, c.ativos),
        diag: getDiag(conv(c.atendimento, c.ativos), 75),
        stageFilter: 'atendimento' as FunnelStage,
      },
      {
        name: 'Visita',
        count: c.visita,
        pct: pct(c.visita),
        conv: conv(c.visita, c.atendimento),
        diag: getDiag(conv(c.visita, c.atendimento), 30),
        stageFilter: 'visita' as FunnelStage,
      },
      {
        name: 'Reserva',
        count: c.reserva,
        pct: pct(c.reserva),
        conv: conv(c.reserva, c.visita),
        diag: getDiag(conv(c.reserva, c.visita), 25),
        stageFilter: 'reserva' as FunnelStage,
      },
      {
        name: 'Venda (Leads Convertidos)',
        count: c.venda,
        pct: pct(c.venda),
        conv: conv(c.venda, c.reserva),
        diag: getDiag(conv(c.venda, c.reserva), 70),
        stageFilter: null, // dado analítico — pipeline de vendas está no Sales Vision
      },
    ]
  }, [leads])

  if (leads.length === 0) {
    return <p className="text-zinc-500 text-center text-xs py-12">Nenhum lead encontrado para os filtros selecionados.</p>
  }

  return (
    <div className="flex flex-col items-center gap-0.5 py-2 w-full">
      {stages.map((step, idx) => {
        const widthPct = Math.max(28, step.pct)
        const nextStep = stages[idx + 1]
        const dropped  = nextStep ? step.count - nextStep.count : 0
        const dropPct  = step.count > 0 ? Math.round((dropped / step.count) * 100) : 0
        const { color, bg, border } = STAGES[idx]

        return (
          <div key={step.name} className="flex flex-col items-center w-full">
            <div
              style={{ width: `${widthPct}%`, background: bg, borderColor: border }}
              onClick={() => step.stageFilter ? setLeadFilters({ ...leadFilters, funnelStage: step.stageFilter, situacao: undefined }) : undefined}
              className={`border rounded-xl px-4 py-3 transition-all duration-300 ${step.stageFilter ? 'cursor-pointer hover:scale-[1.02] hover:brightness-125' : 'cursor-default'} group`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <div className="min-w-0">
                    <p className="text-[11px] text-zinc-400 font-medium leading-tight truncate">{step.name}</p>
                    <p className="text-xl font-black text-white leading-tight">{formatNumber(step.count)}</p>
                  </div>
                </div>

                <div className="flex flex-col items-end shrink-0 gap-1">
                  <span className="text-lg font-black leading-tight" style={{ color }}>{step.pct}%</span>
                  {step.diag && (
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border leading-none"
                      style={{ color: step.diag.text, background: step.diag.bg, borderColor: step.diag.border }}
                    >
                      {step.diag.label}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-2.5 h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${step.pct}%`, backgroundColor: color }}
                />
              </div>
            </div>

            {nextStep && (
              <div className="flex items-center gap-1.5 py-1 text-[10px]">
                <ArrowDown size={9} className="text-zinc-600" />
                <span className="text-zinc-600">
                  {dropped > 0 && <span className="text-red-400/70">-{formatNumber(dropped)} ({dropPct}%)</span>}
                </span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
