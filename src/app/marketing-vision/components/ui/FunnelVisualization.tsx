'use client'

import { useMemo } from 'react'
import type { Lead } from '../../types'
import { formatNumber } from '../../utils/formatters'

interface Props {
  leads: Lead[]
}

const STAGES = [
  { key: 'aguardando atendimento',          label: 'Aguardando Atendimento',          color: '#3b82f6' },
  { key: 'em atendimento sdr',              label: 'Em Atendimento SDR',              color: '#8b5cf6' },
  { key: 'aguardando atendimento corretor', label: 'Aguardando Atendimento Corretor', color: '#6366f1' },
  { key: 'em atendimento',                  label: 'Em Atendimento',                  color: '#a855f7' },
  { key: 'lançamento sul da ilha',          label: 'Lançamento Sul da Ilha',          color: '#ec4899' },
  { key: 'lançamento trindade',             label: 'Lançamento Trindade',             color: '#f43f5e' },
  { key: 'visita agendada',                 label: 'Visita Agendada',                 color: '#f97316' },
  { key: 'visita realizada',                label: 'Visita Realizada',                color: '#f59e0b' },
  { key: 'simulação',                       label: 'Simulação',                       color: '#eab308' },
  { key: 'com reserva',                     label: 'Com Reserva',                     color: '#06b6d4' },
  { key: 'venda realizada',                 label: 'Venda Realizada',                 color: '#10b981' },
  { key: 'sem conexão',                     label: 'Sem Conexão (Descartado)',        color: '#ef4444' },
  { key: 'perdido',                         label: 'Perdido (Descartado)',            color: '#6b7280' },
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
      const sit = lead.situacao?.nome || String((lead as Record<string, unknown>).status ?? '') || '';
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
      const mainPathKeys = [
        'aguardando atendimento', 
        'em atendimento sdr', 
        'aguardando atendimento corretor', 
        'em atendimento', 
        'visita agendada', 
        'visita realizada', 
        'simulação', 
        'com reserva', 
        'venda realizada'
      ]
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
    <div className="flex flex-col gap-4 py-2">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Etapas de Leads no Funil</h3>
          <span className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded text-[11px] font-semibold">
            Todas as Etapas CRM
          </span>
        </div>
        <span className="text-xs text-zinc-400">
          Total de <strong>{formatNumber(leads.length)}</strong> leads analisados
        </span>
      </div>

      {/* Funil Visual Centralizado com Todas as Etapas */}
      <div className="flex flex-col gap-2 my-1">
        {stages.map((stage, idx) => {
          const barW = maxCount > 0 ? (stage.count / maxCount) * 100 : 0
          const colorHex = stage.key === 'venda realizada' ? '#10b981' : stage.color

          return (
            <div key={stage.key} className="flex flex-col gap-1 w-full">
              {/* Informações da Etapa */}
              <div className="flex justify-between items-center text-xs px-2">
                <span className="font-semibold text-zinc-300 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorHex }} />
                  {stage.label}
                </span>
                <div className="flex items-center gap-3 text-zinc-400">
                  <span className="font-bold text-white text-[12px]">{formatNumber(stage.count)} leads</span>
                  <span className="text-[10px] text-zinc-500">({stage.pctOfTotal}%)</span>
                </div>
              </div>

              {/* Barra de Funil Centralizada */}
              <div className="flex items-center gap-4">
                {/* Indicador de conversão da etapa anterior */}
                <div className="w-16 shrink-0 text-right">
                  {stage.convFromPrev !== null ? (
                    <span 
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/5 border border-white/10"
                      style={{
                        color: Number(stage.convFromPrev) >= 50 ? '#10b981'
                             : Number(stage.convFromPrev) >= 20 ? '#f59e0b'
                             : '#ef4444'
                      }}
                      title="Conversão em relação à etapa anterior imediata"
                    >
                      {stage.convFromPrev}%
                    </span>
                  ) : (
                    <span className="text-[9px] text-zinc-600 font-medium">—</span>
                  )}
                </div>

                {/* Container da barra */}
                <div className="flex-1 h-7 rounded-lg overflow-hidden border border-white/5 relative flex justify-center bg-white/[0.01]">
                  <div
                    className="h-full rounded-md transition-all duration-500"
                    style={{
                      width: `${Math.max(barW, 3)}%`,
                      backgroundColor: colorHex,
                      opacity: stage.count > 0 ? 0.8 : 0.15,
                    }}
                  />
                  
                  {/* Seta interna ilustrativa de afunilamento */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-[9px] font-bold text-zinc-100 uppercase tracking-wider drop-shadow-md">
                      {stage.count > 0 ? `${stage.pctOfTotal}%` : ''}
                    </span>
                  </div>
                </div>

                {/* Indicador visual de sequência */}
                <div className="w-10 shrink-0 text-zinc-600 text-center font-bold text-xs">
                  {idx < stages.length - 1 ? '↓' : '🏆'}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
