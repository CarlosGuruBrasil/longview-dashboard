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
  { key: 'aguardando atendimento',          label: 'Aguardando Atendimento',          color: '#FF0F47' },
  { key: 'em atendimento sdr',              label: 'Em Atendimento SDR',              color: '#00E676' },
  { key: 'aguardando atendimento corretor', label: 'Aguardando Atendimento Corretor', color: '#FFEA00' },
  { key: 'em atendimento',                  label: 'Em Atendimento',                  color: '#FF8A00' },
  { key: 'lançamento sul da ilha',          label: 'Lançamento Sul da Ilha',          color: '#8B5CF6' },
  { key: 'lançamento trindade',             label: 'Lançamento Trindade',             color: '#8B5CF6' },
  { key: 'visita agendada',                 label: 'Visita Agendada',                 color: '#00B0FF' },
  { key: 'visita realizada',                label: 'Visita Realizada',                color: '#00897B' },
  { key: 'simulação',                       label: 'Simulação',                       color: '#FF5252' },
  { key: 'com reserva',                     label: 'Com Reserva',                     color: '#2979FF' },
  { key: 'venda realizada',                 label: 'Venda Realizada',                 color: '#FFFFFF' },
  { key: 'sem conexão',                     label: 'Sem Conexão',                     color: '#EF4444' },
  { key: 'perdido',                         label: 'Perdido',                         color: '#6B7280' },
] as const

export default function FunnelVisualization({ leads }: Props) {
  const stages = useMemo(() => {
    const stageCounts: Record<string, number> = {
      'aguardando atendimento': 0,
      'em atendimento sdr': 0,
      'aguardando atendimento corretor': 0,
      'em atendimento': 0,
      'lançamento sul da ilha': 0,
      'lançamento trindade': 0,
      'visita agendada': 0,
      'visita realizada': 0,
      'simulação': 0,
      'com reserva': 0,
      'venda realizada': 0,
      'sem conexão': 0,
      'perdido': 0,
    }

    for (const lead of leads) {
      const sit = lead.situacao?.nome || (lead as any).status || '';
      const s = sit.toLowerCase().trim();

      if (s === 'aguardando atendimento' || s === 'inicio' || s === 'início') {
        stageCounts['aguardando atendimento']++
      } else if (s === 'em atendimento sdr') {
        stageCounts['em atendimento sdr']++
      } else if (s === 'aguardando atendimento corretor') {
        stageCounts['aguardando atendimento corretor']++
      } else if (s === 'em atendimento') {
        stageCounts['em atendimento']++
      } else if (s.includes('sul da ilha')) {
        stageCounts['lançamento sul da ilha']++
      } else if (s.includes('trindade')) {
        stageCounts['lançamento trindade']++
      } else if (s === 'visita agendada') {
        stageCounts['visita agendada']++
      } else if (s === 'visita realizada') {
        stageCounts['visita realizada']++
      } else if (s === 'simulação' || s === 'simulacao') {
        stageCounts['simulação']++
      } else if (s === 'com reserva' || s === 'reserva') {
        stageCounts['com reserva']++
      } else if (s === 'venda realizada' || s.includes('ganho') || s.includes('vendid')) {
        stageCounts['venda realizada']++
      } else if (s === 'sem conexão' || s === 'sem conexao') {
        stageCounts['sem conexão']++
      } else if (s === 'perdido' || s.includes('descart') || s.includes('cancel')) {
        stageCounts['perdido']++
      }
    }

    const total = leads.length

    return STAGES.map((s, i) => {
      const count = stageCounts[s.key]
      const pctOfTotal = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0'

      // Conversão a partir da etapa anterior apenas para a trilha principal (sequencial física)
      const mainPathKeys = ['aguardando atendimento', 'em atendimento sdr', 'aguardando atendimento corretor', 'em atendimento', 'visita agendada', 'visita realizada', 'simulação', 'com reserva', 'venda realizada']
      let convFromPrev: string | null = null

      if (mainPathKeys.includes(s.key)) {
        const pathIdx = mainPathKeys.indexOf(s.key)
        if (pathIdx > 0) {
          const prevKey = mainPathKeys[pathIdx - 1]
          const prevCount = stageCounts[prevKey]
          convFromPrev = prevCount > 0 ? ((count / prevCount) * 100).toFixed(1) : '0.0'
        }
      }

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
          {leads.length} leads totais no período
        </span>
      </div>

      {/* Stages */}
      <div className="flex flex-col gap-1.5">
        {stages.map((stage) => {
          const barW = maxCount > 0 ? (stage.count / maxCount) * 100 : 0

          return (
            <div key={stage.key} className="flex items-center gap-3 min-w-0">
              {/* Stage label */}
              <span className="text-xs text-zinc-300 min-w-[190px] truncate shrink-0">
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
                    title="Conversão da etapa anterior imediata da trilha"
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
