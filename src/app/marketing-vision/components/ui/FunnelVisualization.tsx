'use client'

import { useMemo } from 'react'
import type { Lead } from '../../types'
import { getLeadStage } from '../../utils/metrics'
import { isComProposta } from '../../utils/metrics'
import { isSale } from '../../utils/leads'
import { isLoss } from '../../utils/leads'

interface Props {
  leads: Lead[]
}

interface StageData {
  key: string
  label: string
  count: number
  color: string
  pctOfTotal: string
  convFromPrev: string | null
}

const STAGES = [
  { key: 'new',        label: 'Novos Leads',        color: '#3b82f6' },
  { key: 'attended',   label: 'Em Atendimento',     color: '#f59e0b' },
  { key: 'scheduled',  label: 'Visita Agendada',    color: '#8b5cf6' },
  { key: 'visited',    label: 'Visita Realizada',   color: '#06b6d4' },
  { key: 'proposal',   label: 'Com Proposta',       color: '#ec4899' },
  { key: 'sale',       label: 'Venda Realizada',    color: '#10b981' },
] as const

export default function FunnelVisualization({ leads }: Props) {
  const stages = useMemo(() => {
    const active = leads.filter(l => !isLoss(l))

    const stageCounts: Record<string, number> = {
      new: 0, attended: 0, scheduled: 0, visited: 0, proposal: 0, sale: 0,
    }

    for (const lead of active) {
      if (isSale(lead)) { stageCounts.sale++; continue }
      if (isComProposta(lead)) { stageCounts.proposal++; continue }
      const stage = getLeadStage(lead)
      if (stage === 'none') { stageCounts.new++; continue }
      stageCounts[stage]++
    }

    const total = active.length

    return STAGES.map((s, i) => {
      const count = stageCounts[s.key]
      // Previous stage total for conversion calculation
      const prev = i > 0 ? stageCounts[STAGES[i - 1].key] : total
      const convFromPrev = prev > 0 ? ((count / prev) * 100).toFixed(1) : null
      const pctOfTotal = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0'

      return { ...s, count, pctOfTotal, convFromPrev }
    })
  }, [leads])

  const maxCount = Math.max(...stages.map(s => s.count), 1)

  return (
    <div className="flex flex-col gap-1">
      {/* Header */}
      <div className="flex items-center gap-2 px-0.5 mb-2">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Funil CV CRM</h3>
        <span className="text-xs text-zinc-600">
          {leads.filter(l => !isLoss(l)).length} leads ativos
        </span>
      </div>

      {/* Stages */}
      <div className="flex flex-col gap-1.5">
        {stages.map((stage, i) => {
          const barW = maxCount > 0 ? (stage.count / maxCount) * 100 : 0

          return (
            <div key={stage.key} className="flex items-center gap-3 min-w-0">
              {/* Stage label */}
              <span className="text-xs text-zinc-300 min-w-[120px] truncate shrink-0">
                {stage.label}
              </span>

              {/* Bar */}
              <div className="flex-1 min-w-0 relative h-7">
                <div
                  className="absolute inset-y-0 left-0 rounded-md transition-all"
                  style={{
                    width: `${Math.max(barW, 2)}%`,
                    backgroundColor: stage.color,
                    opacity: stage.count > 0 ? 0.7 : 0.15,
                  }}
                />
                {/* Count on top of bar */}
                <span className="absolute inset-0 flex items-center px-2 text-xs font-bold text-white mix-blend-difference">
                  {stage.count}
                </span>
              </div>

              {/* Conversion + Percentage */}
              <div className="flex items-center gap-2 shrink-0 min-w-[120px] justify-end">
                {stage.convFromPrev !== null && (
                  <span
                    className="text-[11px] font-semibold whitespace-nowrap"
                    style={{
                      color: Number(stage.convFromPrev) >= 50 ? '#10b981'
                           : Number(stage.convFromPrev) >= 25 ? '#f59e0b'
                           : '#ef4444',
                    }}
                  >
                    {stage.convFromPrev}%
                  </span>
                )}
                <span className="text-[11px] text-zinc-500 whitespace-nowrap min-w-[48px] text-right">
                  {stage.pctOfTotal}%
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
