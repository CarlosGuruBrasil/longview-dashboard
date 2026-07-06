'use client'

import { useMemo } from 'react'
import type { Lead } from '../../types'
import { formatNumber } from '../../utils/formatters'

interface Props {
  leads: Lead[]
}

const MACRO_STAGES = [
  { key: 'novo',        label: 'Novos Leads (Entrada)',       color: '#3b82f6' },
  { key: 'atendimento', label: 'Em Atendimento',              color: '#8b5cf6' },
  { key: 'agendado',    label: 'Visita Agendada',             color: '#f59e0b' },
  { key: 'realizado',   label: 'Visita Realizada',            color: '#06b6d4' },
  { key: 'reserva',     label: 'Simulação / Reserva',         color: '#10b981' },
  { key: 'venda',       label: 'Venda Realizada',             color: '#emerald-500' },
] as const

export default function FunnelVisualization({ leads }: Props) {
  const { stages, descartadosCount } = useMemo(() => {
    const stageCounts = {
      novo: 0,
      atendimento: 0,
      agendado: 0,
      realizado: 0,
      reserva: 0,
      venda: 0,
    }

    let descartados = 0

    for (const lead of leads) {
      const sit = lead.situacao?.nome || (lead as any).status || '';
      const s = sit.toLowerCase().trim();

      const isVenda = s.includes('venda realizada') || s.includes('ganho') || s.includes('contrato') || s.includes('fechad');
      if (isVenda) {
        stageCounts.venda++
      } else if (
        s.includes('com reserva') ||
        s.includes('reserva') ||
        s.includes('simula') ||
        s.includes('sul da ilha') ||
        s.includes('trindade')
      ) {
        stageCounts.reserva++
      } else if (s === 'visita realizada' || s.includes('visita realizado')) {
        stageCounts.realizado++
      } else if (s === 'visita agendada' || s.includes('visita agendado')) {
        stageCounts.agendado++
      } else if (
        s.includes('em atendimento') ||
        s.includes('atendimento sdr') ||
        s.includes('atendimento corretor') ||
        s.includes('aguardando atendimento corretor')
      ) {
        stageCounts.atendimento++
      } else if (s === 'aguardando atendimento' || s === 'inicio' || s === 'início' || s === 'novo') {
        stageCounts.novo++
      } else {
        descartados++
      }
    }

    // Cálculo cumulativo (funil real decrescente: quem avançou passou pelas etapas anteriores)
    const totalLeads = leads.length
    const cNovo = stageCounts.novo + stageCounts.atendimento + stageCounts.agendado + stageCounts.realizado + stageCounts.reserva + stageCounts.venda
    const cAtendimento = stageCounts.atendimento + stageCounts.agendado + stageCounts.realizado + stageCounts.reserva + stageCounts.venda
    const cAgendado = stageCounts.agendado + stageCounts.realizado + stageCounts.reserva + stageCounts.venda
    const cRealizado = stageCounts.realizado + stageCounts.reserva + stageCounts.venda
    const cReserva = stageCounts.reserva + stageCounts.venda
    const cVenda = stageCounts.venda

    const cumulativeCounts: Record<string, number> = {
      novo: cNovo,
      atendimento: cAtendimento,
      agendado: cAgendado,
      realizado: cRealizado,
      reserva: cReserva,
      venda: cVenda
    }

    const calculatedStages = MACRO_STAGES.map((s, i) => {
      const count = cumulativeCounts[s.key]
      const pctOfTotal = totalLeads > 0 ? ((count / totalLeads) * 100).toFixed(1) : '0.0'

      // Conversão a partir da etapa anterior
      let convFromPrev: string | null = null
      if (i > 0) {
        const prevKey = MACRO_STAGES[i - 1].key
        const prevCount = cumulativeCounts[prevKey]
        convFromPrev = prevCount > 0 ? ((count / prevCount) * 100).toFixed(1) : '0.0'
      }

      return {
        ...s,
        count,
        pctOfTotal,
        convFromPrev
      }
    })

    return { stages: calculatedStages, descartadosCount: descartados }
  }, [leads])

  const maxCount = Math.max(...stages.map(s => s.count), 1)

  return (
    <div className="flex flex-col gap-5 py-2">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Funil Comercial Acumulado</h3>
          <span className="bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded text-[11px] font-semibold">
            CRM Integrado
          </span>
        </div>
        <span className="text-xs text-zinc-400">
          Analisando <strong>{formatNumber(leads.length)}</strong> leads no período
        </span>
      </div>

      {/* Funil Visual Centralizado */}
      <div className="flex flex-col gap-3.5 my-2">
        {stages.map((stage, idx) => {
          // A largura da barra é proporcional ao volume da etapa
          const barW = maxCount > 0 ? (stage.count / maxCount) * 100 : 0
          
          // Efeito cascata: a opacidade diminui levemente conforme desce no funil
          const opacityVal = 0.85 - idx * 0.08
          const colorHex = stage.key === 'venda' ? '#10b981' : stage.color

          return (
            <div key={stage.key} className="flex flex-col gap-1 w-full">
              
              {/* Informações da Etapa */}
              <div className="flex justify-between items-center text-xs px-2">
                <span className="font-semibold text-zinc-300 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colorHex }} />
                  {stage.label}
                </span>
                <div className="flex items-center gap-3 text-zinc-400">
                  <span className="font-bold text-white text-[13px]">{formatNumber(stage.count)} leads</span>
                  <span className="text-zinc-500">({stage.pctOfTotal}%)</span>
                </div>
              </div>

              {/* Barra de Funil Centralizada */}
              <div className="flex items-center gap-4">
                {/* Indicador de conversão da etapa anterior */}
                <div className="w-16 shrink-0 text-right">
                  {stage.convFromPrev !== null ? (
                    <span 
                      className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-white/5 border border-white/10"
                      style={{
                        color: Number(stage.convFromPrev) >= 60 ? '#10b981'
                             : Number(stage.convFromPrev) >= 30 ? '#f59e0b'
                             : '#ef4444'
                      }}
                      title="Conversão em relação à etapa anterior"
                    >
                      {stage.convFromPrev}%
                    </span>
                  ) : (
                    <span className="text-[10px] text-zinc-600 font-medium">Topo</span>
                  )}
                </div>

                {/* Container da barra */}
                <div className="flex-1 h-8 rounded-lg overflow-hidden border border-white/5 relative flex justify-center bg-white/[0.01]">
                  <div
                    className="h-full rounded-md transition-all duration-500"
                    style={{
                      width: `${Math.max(barW, 4)}%`,
                      backgroundColor: colorHex,
                      opacity: stage.count > 0 ? opacityVal : 0.15,
                    }}
                  />
                  
                  {/* Seta interna ilustrativa de afunilamento */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-[10px] font-bold text-zinc-100 uppercase tracking-wider drop-shadow-md">
                      {stage.count > 0 ? `${stage.pctOfTotal}% do total` : 'Sem leads'}
                    </span>
                  </div>
                </div>

                {/* Seta direcional / link visual */}
                <div className="w-10 shrink-0 text-zinc-600 text-center font-bold">
                  {idx < stages.length - 1 ? '↓' : '🏆'}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Rodapé informativo: descartados e perdidos */}
      <div className="border-t border-white/5 pt-3.5 flex justify-between items-center text-xs text-zinc-500 px-1">
        <span>* O funil acima é <strong>cumulativo</strong>, representando a jornada de conversão.</span>
        <span>Leads descartados/sem conexão no período: <strong>{formatNumber(descartadosCount)}</strong></span>
      </div>
    </div>
  )
}
