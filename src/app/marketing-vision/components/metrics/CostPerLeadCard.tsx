'use client'

import { useMemo, useState } from 'react'
import GlassCard from '../ui/GlassCard'
import { calculateCostPerLead } from '../../utils/metrics'
import type { Lead, MetaData } from '../../types'

interface CostPerLeadCardProps {
  leads: Lead[]
  metaData: MetaData | null
  loading?: boolean
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export default function CostPerLeadCard({ leads, metaData, loading = false }: CostPerLeadCardProps) {
  const [showTable, setShowTable] = useState(true)

  // Calculate total Meta spend
  const totalMetaSpend = useMemo(() => {
    if (!metaData?.global?.spend) return 0
    return parseFloat(metaData.global.spend) || 0
  }, [metaData])

  // Calculate CPL metric
  const cplMetric = useMemo(() => {
    return calculateCostPerLead(leads, totalMetaSpend)
  }, [leads, totalMetaSpend])

  // Build campaign-level breakdown
  const campaignCPL = useMemo(() => {
    if (!metaData?.campaigns || metaData.campaigns.length === 0) return []

    return metaData.campaigns
      .map(camp => {
        const spend = parseFloat(camp.spend || '0') || 0
        // Leads reais da campanha via actions (action_type='lead')
        const leadAction = camp.actions?.find(
          a => a.action_type === 'lead' || a.action_type === 'omni_lead'
        )
        const leads = leadAction ? (parseInt(leadAction.value, 10) || 0) : 0
        return {
          name: camp.campaign_name || 'Sem nome',
          spend,
          leads,
          cpl: leads > 0 ? spend / leads : 0,
        }
      })
      .filter(c => c.spend > 0)
      .sort((a, b) => b.spend - a.spend)
  }, [metaData])

  return (
    <GlassCard title="Custo de LEAD - MKT">
      <div className="flex flex-col gap-4">
        {/* KPI Section */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-zinc-500 mb-1">Total de Leads</p>
              <p className="text-2xl font-bold text-zinc-100">{cplMetric.totalLeads}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Gasto Meta</p>
              <p className="text-2xl font-bold text-zinc-100">{formatCurrency(cplMetric.totalSpend)}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">CPL</p>
              <p className="text-2xl font-bold text-emerald-400">{formatCurrency(cplMetric.cpl)}</p>
            </div>
          </div>
        </div>

        {/* Display Mode Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowTable(true)}
            className={`text-xs px-3 py-1.5 rounded font-medium transition-colors ${
              showTable
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            Tabela
          </button>
          <button
            onClick={() => setShowTable(false)}
            className={`text-xs px-3 py-1.5 rounded font-medium transition-colors ${
              !showTable
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            Campanhas
          </button>
        </div>

        {/* Content */}
        {showTable ? (
          // Campaigns Table
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-3 font-semibold text-zinc-300">Campanha</th>
                  <th className="text-right py-2 px-3 font-semibold text-zinc-300">Leads</th>
                  <th className="text-right py-2 px-3 font-semibold text-zinc-300">Gasto</th>
                  <th className="text-right py-2 px-3 font-semibold text-zinc-300">CPL</th>
                </tr>
              </thead>
              <tbody>
                {campaignCPL.length > 0 ? (
                  campaignCPL.map((camp, i) => (
                    <tr key={i} className="border-b border-white/[0.05] hover:bg-white/5 transition">
                      <td className="py-3 px-3 text-zinc-200 truncate">{camp.name}</td>
                      <td className="py-3 px-3 text-right text-zinc-400">{camp.leads || '—'}</td>
                      <td className="py-3 px-3 text-right text-zinc-300">{formatCurrency(camp.spend)}</td>
                      <td className="py-3 px-3 text-right font-semibold text-emerald-400">
                        {camp.cpl > 0 ? formatCurrency(camp.cpl) : '—'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="py-4 px-3 text-center text-zinc-500 text-xs">
                      Sem dados de campanhas
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          // CPL by Campaign (sorted by spend)
          <div className="space-y-2">
            {campaignCPL.length > 0 ? (
              campaignCPL.map((camp, i) => {
                return (
                  <div key={i} className="flex items-center justify-between bg-white/5 border border-white/10 rounded p-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-zinc-200 truncate">{camp.name}</p>
                      <p className="text-xs text-zinc-500">Gasto: {formatCurrency(camp.spend)} · {camp.leads} leads</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-400">
                        {camp.cpl > 0 ? `R$ ${camp.cpl.toFixed(2).replace('.', ',')}` : '—'}
                      </p>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="text-center text-zinc-500 text-sm py-4">Sem dados de campanhas</div>
            )}
          </div>
        )}
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded backdrop-blur-sm">
          <div className="animate-spin">⟳</div>
        </div>
      )}
    </GlassCard>
  )
}
