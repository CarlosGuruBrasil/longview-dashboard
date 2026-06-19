'use client'

import { useMemo } from 'react'
import { Flame, Thermometer, Snowflake, Zap } from 'lucide-react'
import { useData } from '../../context/DataContext'
import KpiCard from '../ui/KpiCard'
import GlassCard from '../ui/GlassCard'
import PieDonutChart from '../charts/PieDonutChart'

interface ScoreBucket {
  key: string
  label: string
  range: [number, number]
  color: string
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
}

const BUCKETS: ScoreBucket[] = [
  { key: 'frio',    label: 'Frio',    range: [0, 25],   color: '#0ea5e9', icon: Snowflake },
  { key: 'morno',   label: 'Morno',   range: [26, 50],  color: '#f59e0b', icon: Thermometer },
  { key: 'quente',  label: 'Quente',  range: [51, 75],  color: '#f97316', icon: Flame },
  { key: 'hot',     label: 'Hot',     range: [76, 100], color: '#f43f5e', icon: Zap },
]

function getBucket(score: number): ScoreBucket {
  return BUCKETS.find(b => score >= b.range[0] && score <= b.range[1]) ?? BUCKETS[0]
}

export default function ScoreView() {
  const { filteredLeads } = useData()

  const leadsWithScore = useMemo(
    () => filteredLeads.filter(l => typeof l.score === 'number'),
    [filteredLeads]
  )

  const bucketCounts = useMemo(() => {
    const map: Record<string, number> = { frio: 0, morno: 0, quente: 0, hot: 0 }
    for (const lead of leadsWithScore) {
      const bucket = getBucket(lead.score!)
      map[bucket.key]++
    }
    return map
  }, [leadsWithScore])

  const pieData = useMemo(
    () => BUCKETS.map(b => ({ name: b.label, value: bucketCounts[b.key] })).filter(d => d.value > 0),
    [bucketCounts]
  )

  const pieColors = useMemo(
    () => BUCKETS.filter(b => bucketCounts[b.key] > 0).map(b => b.color),
    [bucketCounts]
  )

  const top20 = useMemo(
    () =>
      leadsWithScore
        .slice()
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, 20),
    [leadsWithScore]
  )

  if (leadsWithScore.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Zap size={48} className="opacity-20" style={{ color: 'var(--text-secondary)' }} />
        <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          Score não disponível
        </p>
        <p className="text-sm text-center max-w-xs" style={{ color: 'var(--text-secondary)' }}>
          Nenhum lead possui pontuação de score. O score deve ser configurado no CV CRM.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {BUCKETS.map(b => (
          <KpiCard
            key={b.key}
            icon={b.icon}
            label={`${b.label} (${b.range[0]}–${b.range[1]})`}
            value={bucketCounts[b.key].toLocaleString('pt-BR')}
            subtitle={
              leadsWithScore.length > 0
                ? `${((bucketCounts[b.key] / leadsWithScore.length) * 100).toFixed(1)}% dos leads`
                : undefined
            }
            color={b.color}
          />
        ))}
      </div>

      {/* Chart */}
      {pieData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PieDonutChart
            title="Distribuição de Score"
            data={pieData}
            colors={pieColors}
          />

          {/* Score legend / summary */}
          <GlassCard title="Resumo por Faixa">
            <div className="flex flex-col gap-3">
              {BUCKETS.map(b => {
                const count = bucketCounts[b.key]
                const pct = leadsWithScore.length > 0 ? (count / leadsWithScore.length) * 100 : 0
                return (
                  <div key={b.key} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium" style={{ color: b.color }}>
                        {b.label}
                      </span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {count.toLocaleString('pt-BR')} leads — {pct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: b.color }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </GlassCard>
        </div>
      )}

      {/* Top 20 table */}
      {top20.length > 0 && (
        <GlassCard title="Top 20 Leads por Score">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ color: 'var(--text-secondary)' }}>
                  <th className="text-left py-2 px-3 font-medium">#</th>
                  <th className="text-left py-2 px-3 font-medium">Nome</th>
                  <th className="text-left py-2 px-3 font-medium">Score</th>
                  <th className="text-left py-2 px-3 font-medium">Situação</th>
                  <th className="text-left py-2 px-3 font-medium">Empreendimento</th>
                </tr>
              </thead>
              <tbody>
                {top20.map((lead, i) => {
                  const score = lead.score ?? 0
                  const bucket = getBucket(score)
                  return (
                    <tr
                      key={lead.idlead ?? lead.id ?? i}
                      className="border-t border-white/5 hover:bg-white/5 transition-colors"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <td className="py-2.5 px-3 opacity-40 font-mono">{i + 1}</td>
                      <td className="py-2.5 px-3 font-medium">{lead.nome || '—'}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-bold"
                          style={{ backgroundColor: `${bucket.color}20`, color: bucket.color }}
                        >
                          {score}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        {lead.situacao?.nome ? (
                          <span className="opacity-80">{lead.situacao.nome}</span>
                        ) : (
                          <span className="opacity-30">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 opacity-70">
                        {lead.empreendimento?.[0]?.nome ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  )
}
