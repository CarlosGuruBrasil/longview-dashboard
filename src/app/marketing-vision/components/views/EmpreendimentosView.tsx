'use client'

import { useMemo } from 'react'
import { Building2, Users } from 'lucide-react'
import { useData } from '../../context/DataContext'
import GlassCard from '../ui/GlassCard'

interface UnitCounts {
  total: number
  disponivel: number
  reservado: number
  vendido: number
}

function parseUnitCounts(raw: unknown): UnitCounts {
  // CV CRM estoque structure varies; try common shapes
  const counts: UnitCounts = { total: 0, disponivel: 0, reservado: 0, vendido: 0 }

  if (!raw || typeof raw !== 'object') return counts

  const obj = raw as Record<string, unknown>

  // Some APIs return summary fields directly
  for (const key of Object.keys(obj)) {
    const lower = key.toLowerCase()
    const val = Number(obj[key] ?? 0)
    if (!isNaN(val)) {
      if (lower.includes('disponiv')) counts.disponivel += val
      else if (lower.includes('reserv')) counts.reservado += val
      else if (lower.includes('vendid') || lower.includes('venda')) counts.vendido += val
      else if (lower === 'total' || lower === 'total_unidades') counts.total += val
    }
  }

  // If API returns array of units
  const unitsKey = ['unidades', 'units', 'imoveis'].find(k => Array.isArray(obj[k]))
  if (unitsKey) {
    const units = obj[unitsKey] as Array<Record<string, unknown>>
    counts.total = units.length
    counts.disponivel = 0
    counts.reservado = 0
    counts.vendido = 0
    for (const unit of units) {
      const status = String(unit.status ?? unit.situacao ?? unit.situacao_nome ?? '').toLowerCase()
      if (status.includes('disponiv')) counts.disponivel++
      else if (status.includes('reserv')) counts.reservado++
      else if (status.includes('vendid') || status.includes('venda')) counts.vendido++
    }
  }

  if (counts.total === 0) {
    counts.total = counts.disponivel + counts.reservado + counts.vendido
  }

  return counts
}

function AvailabilityBar({ counts }: { counts: UnitCounts }) {
  const total = counts.total || 1
  const dispPct = (counts.disponivel / total) * 100
  const resPct = (counts.reservado / total) * 100
  const vendPct = (counts.vendido / total) * 100

  return (
    <div className="flex h-2 w-full rounded-full overflow-hidden gap-0.5">
      <div
        className="rounded-l-full transition-all"
        style={{ width: `${dispPct}%`, backgroundColor: '#10b981', minWidth: dispPct > 0 ? 4 : 0 }}
      />
      <div
        className="transition-all"
        style={{ width: `${resPct}%`, backgroundColor: '#f59e0b', minWidth: resPct > 0 ? 4 : 0 }}
      />
      <div
        className="rounded-r-full transition-all"
        style={{ width: `${vendPct}%`, backgroundColor: '#0ea5e9', minWidth: vendPct > 0 ? 4 : 0 }}
      />
    </div>
  )
}

interface StatPillProps {
  label: string
  count: number
  color: string
}

function StatPill({ label, count, color }: StatPillProps) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-lg font-bold" style={{ color }}>{count}</span>
      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
    </div>
  )
}

export default function EmpreendimentosView() {
  const { estoque, filteredLeads } = useData()

  const projects = useMemo(() => Object.entries(estoque), [estoque])

  const leadCountByProject = useMemo(() => {
    const map = new Map<string, number>()
    for (const lead of filteredLeads) {
      for (const emp of lead.empreendimento ?? []) {
        if (emp.nome) {
          map.set(emp.nome, (map.get(emp.nome) ?? 0) + 1)
        }
      }
    }
    return map
  }, [filteredLeads])

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Building2 size={48} className="opacity-20" style={{ color: 'var(--text-secondary)' }} />
        <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          Nenhum empreendimento encontrado
        </p>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Os dados de estoque serão exibidos aqui quando disponíveis.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {projects.map(([projectId, rawData]) => {
          const counts = parseUnitCounts(rawData)

          // Try to get project name from the raw data
          let projectName = projectId
          if (rawData && typeof rawData === 'object') {
            const obj = rawData as Record<string, unknown>
            const nameKey = ['nome', 'name', 'empreendimento', 'titulo'].find(k => typeof obj[k] === 'string')
            if (nameKey) projectName = String(obj[nameKey])
          }

          const leadCount = leadCountByProject.get(projectName) ?? leadCountByProject.get(projectId) ?? 0

          return (
            <GlassCard key={projectId}>
              <div className="flex flex-col gap-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0"
                      style={{ backgroundColor: '#0ea5e922' }}
                    >
                      <Building2 size={18} style={{ color: '#0ea5e9' }} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
                        {projectName}
                      </h3>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        ID: {projectId}
                      </p>
                    </div>
                  </div>
                  {leadCount > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 flex-shrink-0">
                      <Users size={12} style={{ color: '#a855f7' }} />
                      <span className="text-xs font-medium" style={{ color: '#a855f7' }}>{leadCount}</span>
                    </div>
                  )}
                </div>

                {/* Unit counts */}
                <div className="grid grid-cols-4 gap-2 py-3 border-y border-white/10">
                  <StatPill label="Total" count={counts.total} color="var(--text-primary)" />
                  <StatPill label="Disponível" count={counts.disponivel} color="#10b981" />
                  <StatPill label="Reservado" count={counts.reservado} color="#f59e0b" />
                  <StatPill label="Vendido" count={counts.vendido} color="#0ea5e9" />
                </div>

                {/* Availability bar */}
                {counts.total > 0 && (
                  <div className="flex flex-col gap-2">
                    <AvailabilityBar counts={counts} />
                    <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#10b981' }} />
                        {counts.total > 0 ? ((counts.disponivel / counts.total) * 100).toFixed(0) : 0}% disp.
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#f59e0b' }} />
                        {counts.total > 0 ? ((counts.reservado / counts.total) * 100).toFixed(0) : 0}% res.
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#0ea5e9' }} />
                        {counts.total > 0 ? ((counts.vendido / counts.total) * 100).toFixed(0) : 0}% vend.
                      </span>
                    </div>
                  </div>
                )}

                {counts.total === 0 && (
                  <p className="text-xs text-center py-2 opacity-40" style={{ color: 'var(--text-secondary)' }}>
                    Dados de unidades não disponíveis
                  </p>
                )}
              </div>
            </GlassCard>
          )
        })}
      </div>
    </div>
  )
}
