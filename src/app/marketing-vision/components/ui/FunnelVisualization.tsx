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
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 w-full pt-2">
      {stages.map((step, idx) => {
        const { color, bg, border } = STAGES[idx]

        return (
          <div
            key={step.name}
            onClick={() => step.stageFilter ? setLeadFilters({ ...leadFilters, funnelStage: step.stageFilter, situacao: undefined }) : undefined}
            className={`group relative overflow-hidden rounded-xl border p-3 flex flex-col gap-2 transition-all duration-300 ${
              step.stageFilter 
                ? 'hover:bg-white/[0.06] cursor-pointer hover:border-orange-500/40 hover:-translate-y-1' 
                : 'cursor-default opacity-80'
            }`}
            style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)' }}
          >
            {/* Top border highlight based on stage color */}
            <div className="absolute top-0 left-0 right-0 h-1 transition-colors" style={{ backgroundColor: color, opacity: 0.7 }} />
            
            <span className="text-[11px] font-bold text-zinc-300 group-hover:text-white transition-colors mt-1 uppercase tracking-wider line-clamp-2" title={step.name}>
              {step.name.replace(/^\d+\.\s*/, '')}
            </span>
            <span className="text-3xl font-black text-white">{formatNumber(step.count)}</span>
            
            <div className="flex flex-col gap-1 mt-auto pt-2 border-t border-white/5">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-zinc-500">Conv. {idx === 0 ? 'Total' : 'da Etapa'}</span>
                <span className="font-bold text-zinc-300">{idx === 0 ? '—' : `${step.conv}%`}</span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-zinc-500">Representa</span>
                <span className="font-bold text-zinc-300">{step.pct}%</span>
              </div>
              {step.diag && idx > 0 && (
                <div 
                  className="text-center mt-1 text-[9px] font-bold px-1.5 py-1 rounded truncate border"
                  style={{ color: step.diag.text, background: step.diag.bg, borderColor: step.diag.border }}
                >
                  {step.diag.label}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
