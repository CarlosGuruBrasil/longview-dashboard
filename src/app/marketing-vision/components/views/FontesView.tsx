'use client'

import { useMemo } from 'react'
import { useData } from '../../context/DataContext'
import GlassCard from '../ui/GlassCard'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar
} from 'recharts'

const CANAL_COLORS: Record<string, string> = {
  'Meta / Paid':        '#3b82f6',
  'Portais (Zap/OLX)': '#10b981',
  'Manual (CRM)':       '#f59e0b',
  'Google Orgânico':    '#8b5cf6',
  'Outros Digitais':    '#06b6d4',
  'Não Definido':       '#6b7280',
}

function diasLabel(dias: number | null): string {
  if (dias === null) return 'nunca'
  if (dias === 0) return 'hoje'
  if (dias === 1) return 'ontem'
  return `${dias}d atrás`
}

function semanaLabel(s: string): string {
  const d = new Date(s + 'T12:00:00Z')
  return `${d.getUTCDate().toString().padStart(2,'0')}/${(d.getUTCMonth()+1).toString().padStart(2,'0')}`
}

export default function FontesView() {
  const { leadSummary } = useData()

  const weekly = useMemo(() => (leadSummary?.weekly ?? []).map(w => ({
    ...w,
    label: semanaLabel(w.semana),
  })), [leadSummary])

  const sourceStatus = leadSummary?.sourceStatus ?? []
  const byOrigem = leadSummary?.byOrigem ?? []

  const origemTop = useMemo(() =>
    [...byOrigem].sort((a, b) => b.total - a.total).slice(0, 10),
    [byOrigem]
  )

  if (!leadSummary) {
    return <div className="text-zinc-500 text-sm p-4">Carregando dados de fontes…</div>
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Cards de status por canal */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {sourceStatus.map(s => (
          <div
            key={s.canal}
            className={`rounded-xl border p-3 flex flex-col gap-1 ${
              s.ativo
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'border-red-500/30 bg-red-500/5'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-semibold text-zinc-400 leading-tight">{s.canal}</span>
              <span className={`w-2 h-2 rounded-full shrink-0 ${s.ativo ? 'bg-emerald-400' : 'bg-red-400'}`} />
            </div>
            <span className="text-xl font-bold text-white">{s.total.toLocaleString('pt-BR')}</span>
            <span className={`text-[11px] ${s.ativo ? 'text-emerald-400' : 'text-red-400'}`}>
              {diasLabel(s.diasSemLead)}
            </span>
          </div>
        ))}
      </div>

      {/* Evolução semanal por canal */}
      <GlassCard title="Evolução Semanal por Canal (16 semanas)">
        {weekly.length === 0 ? (
          <div className="text-zinc-500 text-sm py-8 text-center">Sem dados</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={weekly} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#71717a' }} />
              <YAxis tick={{ fontSize: 11, fill: '#71717a' }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#a1a1aa' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="meta"    name="Meta / Paid"        stroke="#3b82f6" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="portais" name="Portais (Zap/OLX)"  stroke="#10b981" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="manual"  name="Manual (CRM)"       stroke="#f59e0b" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="outros"  name="Outros"             stroke="#6b7280" dot={false} strokeWidth={1} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </GlassCard>

      {/* Volume total por semana (bar) */}
      <GlassCard title="Total de Leads por Semana">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={weekly} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#71717a' }} />
            <YAxis tick={{ fontSize: 11, fill: '#71717a' }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#a1a1aa' }}
            />
            <Bar dataKey="total" name="Leads" fill="#3b82f6" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </GlassCard>

      {/* Top origens (granular) */}
      <GlassCard title="Origem Detalhada (todos os leads)">
        <div className="flex flex-col gap-2">
          {origemTop.map(o => {
            const total = byOrigem.reduce((s, x) => s + x.total, 0)
            const pct = total ? Math.round((o.total / total) * 100) : 0
            const color = CANAL_COLORS[o.origem] ?? '#6b7280'
            return (
              <div key={o.origem} className="flex items-center gap-3">
                <span className="text-xs text-zinc-400 w-40 truncate shrink-0">{o.origem}</span>
                <div className="flex-1 bg-zinc-800 rounded-full h-2 overflow-hidden">
                  <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                </div>
                <span className="text-xs text-zinc-300 w-16 text-right shrink-0">
                  {o.total.toLocaleString('pt-BR')} <span className="text-zinc-500">({pct}%)</span>
                </span>
              </div>
            )
          })}
        </div>
      </GlassCard>

    </div>
  )
}
