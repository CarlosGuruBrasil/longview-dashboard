'use client'

import { useMemo } from 'react'
import type { Lead } from '../../types'
import { formatNumber } from '../../utils/formatters'
import { useData } from '../../context/DataContext'

interface Props {
  leads: Lead[]
}

const EXACT_STAGES = [
  'Aguardando Atendimento',
  'Sem conexão',
  'Em Atendimento',
  'Carteira Corretor',
  'Visita Agendada',
  'Visita Realizada',
  'Com Reserva',
  'Venda Realizada',
  'Lançamento Trindade',
  'Lançamento Sul da Ilha',
  'Perdido'
]

const PALETTE = [
  { color: '#64748b' }, // Slate
  { color: '#ef4444' }, // Red (Sem conexao)
  { color: '#3b82f6' }, // Blue
  { color: '#8b5cf6' }, // Violet
  { color: '#ec4899' }, // Pink
  { color: '#d946ef' }, // Fuchsia
  { color: '#f59e0b' }, // Amber
  { color: '#10b981' }, // Emerald
  { color: '#06b6d4' }, // Cyan
  { color: '#0ea5e9' }, // Sky
  { color: '#71717a' }, // Zinc (Perdido)
]

export default function FunnelVisualization({ leads }: Props) {
  const { leadFilters, setLeadFilters } = useData()

  const stages = useMemo(() => {
    const totalLeads = leads.length

    return EXACT_STAGES.map((stageName) => {
      const count = leads.filter(l => l.status === stageName).length
      const pct = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0
      
      return {
        name: stageName,
        count,
        pct
      }
    })
  }, [leads])

  if (leads.length === 0) {
    return <p className="text-zinc-500 text-center text-xs py-12">Nenhum lead encontrado para os filtros selecionados.</p>
  }

  return (
    <div className="flex flex-nowrap overflow-x-auto gap-3 w-full pt-2 pb-4 custom-scrollbar">
      {stages.map((step, idx) => {
        const { color } = PALETTE[idx % PALETTE.length]

        return (
          <div
            key={step.name}
            onClick={() => setLeadFilters({ ...leadFilters, situacao: step.name, funnelStage: undefined })}
            className="group relative overflow-hidden rounded-xl border p-3 flex flex-col gap-2 transition-all duration-300 hover:bg-white/[0.06] cursor-pointer hover:border-orange-500/40 hover:-translate-y-1 min-w-[140px] flex-1"
            style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)' }}
          >
            {/* Top border highlight based on stage color */}
            <div className="absolute top-0 left-0 right-0 h-1 transition-colors" style={{ backgroundColor: color, opacity: 0.7 }} />
            
            <span className="text-[11px] font-bold text-zinc-300 group-hover:text-white transition-colors mt-1 uppercase tracking-wider line-clamp-2" title={step.name}>
              {step.name}
            </span>
            <span className="text-2xl font-black text-white">{formatNumber(step.count)}</span>
            
            <div className="flex flex-col gap-1 mt-auto pt-2 border-t border-white/5">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-zinc-500">Volume</span>
                <span className="font-bold text-zinc-300">{step.pct}%</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
