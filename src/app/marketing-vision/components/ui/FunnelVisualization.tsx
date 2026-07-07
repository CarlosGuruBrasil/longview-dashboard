'use client'

import { useMemo } from 'react'
import { ArrowRight, ArrowDown, Activity } from 'lucide-react'
import type { Lead } from '../../types'
import { formatNumber } from '../../utils/formatters'
import { useData } from '../../context/DataContext'

interface Props {
  leads: Lead[]
}

export default function FunnelVisualization({ leads }: Props) {
  const { leadFilters, setLeadFilters } = useData()

  const funnelConsolidated = useMemo(() => {
    let novos = 0
    let atendimento = 0
    let visita = 0
    let proposta = 0
    let venda = 0

    leads.forEach(l => {
      const s = (l.situacao?.nome ?? '').toLowerCase()
      
      if (s === 'venda realizada' || s.includes('negócio ganho') || s.includes('negocio ganho') || s.includes('vendid') || s.includes('venda real')) {
        venda++
      } else if (s.includes('com proposta') || s === 'proposta' || s.includes('com reserva') || s.includes('reserva') || s.includes('simula')) {
        proposta++
      } else if (s.includes('visita') || s.includes('apresenta')) {
        visita++
      } else if (s.includes('atend') || s.includes('sdr') || s.includes('conex')) {
        atendimento++
      } else {
        novos++
      }
    })

    const cVenda = venda
    const cProposta = proposta + cVenda
    const cVisita = visita + cProposta
    const cAtend = atendimento + cVisita
    const cNovos = novos + cAtend

    const tAtend = cNovos > 0 ? (cAtend / cNovos) * 100 : 0
    const tVisita = cAtend > 0 ? (cVisita / cAtend) * 100 : 0
    const tProposta = cVisita > 0 ? (cProposta / cVisita) * 100 : 0
    const tVenda = cProposta > 0 ? (cVenda / cProposta) * 100 : 0

    const getStatus = (val: number, meta: number) => {
      if (val >= meta) return { label: 'Excelente', color: 'text-green-400 border-green-500/20 bg-green-500/10' }
      if (val >= meta * 0.7) return { label: 'Bom', color: 'text-sky-400 border-sky-500/20 bg-sky-500/10' }
      if (val >= meta * 0.45) return { label: 'Regular', color: 'text-amber-400 border-amber-500/20 bg-amber-500/10' }
      return { label: 'Abaixo da Meta', color: 'text-red-400 border-red-500/20 bg-red-500/10' }
    }

    return [
      { name: '1. Captação (Novos)', count: cNovos, pctOfTotal: 100, convRate: 100, diag: { label: 'Início', color: 'text-zinc-400 border-zinc-700 bg-zinc-800/40' } },
      { name: '2. Em Atendimento', count: cAtend, pctOfTotal: cNovos > 0 ? Math.round((cAtend / cNovos) * 100) : 0, convRate: Math.round(tAtend), diag: getStatus(tAtend, 85) },
      { name: '3. Visita Realizada/Agendada', count: cVisita, pctOfTotal: cNovos > 0 ? Math.round((cVisita / cNovos) * 100) : 0, convRate: Math.round(tVisita), diag: getStatus(tVisita, 45) },
      { name: '4. Com Proposta/Reserva', count: cProposta, pctOfTotal: cNovos > 0 ? Math.round((cProposta / cNovos) * 100) : 0, convRate: Math.round(tProposta), diag: getStatus(tProposta, 20) },
      { name: '5. Venda Fechada', count: cVenda, pctOfTotal: cNovos > 0 ? Math.round((cVenda / cNovos) * 100) : 0, convRate: Math.round(tVenda), diag: getStatus(tVenda, 35) },
    ]
  }, [leads])

  return (
    <div className="flex flex-col gap-5 py-2">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Activity size={15} className="text-orange-500" /> Funil Comercial Consolidado
          </h3>
          <span className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
            Pipeline
          </span>
        </div>
        <span className="text-xs text-zinc-400">
          Total de <strong>{formatNumber(leads.length)}</strong> leads no período
        </span>
      </div>

      {/* Funil Visual Progressivo */}
      <div className="flex flex-col gap-3 pr-1 w-full max-w-xl mx-auto py-2">
        {funnelConsolidated.length === 0 || leads.length === 0 ? (
          <p className="text-zinc-500 text-center text-xs py-12">Nenhum lead encontrado para os filtros selecionados.</p>
        ) : (
          funnelConsolidated.map((step, idx) => {
            const blockWidth = `${Math.max(35, step.pctOfTotal)}%`

            return (
              <div key={step.name} className="flex flex-col items-center w-full">
                {/* Bloco do Funil */}
                <div
                  onClick={() => {
                    const baseFilters = { ...leadFilters }
                    if (step.name.includes('Atendimento')) baseFilters.situacao = 'Em Atendimento'
                    else if (step.name.includes('Visita')) baseFilters.situacao = 'Visita Realizada'
                    else if (step.name.includes('Proposta')) baseFilters.situacao = 'Com Proposta'
                    else if (step.name.includes('Venda')) baseFilters.situacao = 'Venda Realizada'
                    else delete baseFilters.situacao
                    setLeadFilters(baseFilters)
                  }}
                  style={{ width: blockWidth }}
                  className="group relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-r from-white/[0.03] to-white/[0.01] hover:from-white/[0.08] hover:to-white/[0.04] p-3 flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01] duration-300 shadow-lg"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500/50 group-hover:bg-orange-500 transition-colors" />
                  
                  <div className="flex flex-col gap-0.5 pl-1.5">
                    <span className="text-[11px] font-bold text-zinc-300 group-hover:text-white transition-colors">
                      {step.name}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      Volume: <strong className="text-zinc-300 font-semibold">{formatNumber(step.count)}</strong> ({step.pctOfTotal}%)
                    </span>
                  </div>

                  <div className="text-right flex items-center gap-3">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-zinc-100">
                        {idx === 0 ? 'Conversão' : `Conv: ${step.convRate}%`}
                      </span>
                      {idx > 0 && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-0.5 border ${step.diag.color}`}>
                          {step.diag.label}
                        </span>
                      )}
                    </div>
                    <ArrowRight size={12} className="text-zinc-500 group-hover:text-white transition-colors translate-x-0 group-hover:translate-x-1 duration-300" />
                  </div>
                </div>

                {/* Seta de Conversão */}
                {idx < funnelConsolidated.length - 1 && (
                  <div className="flex flex-col items-center justify-center my-1.5">
                    <ArrowDown size={14} className="text-zinc-700 animate-pulse" />
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
