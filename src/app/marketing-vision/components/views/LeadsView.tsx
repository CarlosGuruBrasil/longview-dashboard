'use client'

import { useMemo, useState } from 'react'
import { useData } from '../../context/DataContext'
import GlassCard from '../ui/GlassCard'
import StageSummary from '../ui/StageSummary'
import LeadsTable from '../ui/LeadsTable'
import GrowthLineChart from '../charts/GrowthLineChart'
import PieDonutChart from '../charts/PieDonutChart'

type SubTab = 'crm' | 'score'

export default function LeadsView() {
  const { filteredLeads } = useData()
  const [activeTab, setActiveTab] = useState<SubTab>('crm')
  const [growthMode, setGrowthMode] = useState<'month' | 'year'>('month')

  // Chart: Gênero
  const generoData = useMemo(() => {
    const map = new Map<string, number>()
    for (const lead of filteredLeads) {
      const genero = lead.genero?.trim() || 'Não informado'
      map.set(genero, (map.get(genero) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [filteredLeads])

  // Chart: Top 5 Cidades
  const cidadesData = useMemo(() => {
    const map = new Map<string, number>()
    for (const lead of filteredLeads) {
      const cidade = lead.cidade?.trim() || 'Não informado'
      map.set(cidade, (map.get(cidade) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  }, [filteredLeads])

  // Chart: Estado Civil
  const estadoCivilData = useMemo(() => {
    const map = new Map<string, number>()
    for (const lead of filteredLeads) {
      const estadoCivil = lead.estado_civil?.trim() || 'Não informado'
      map.set(estadoCivil, (map.get(estadoCivil) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [filteredLeads])

  return (
    <div className="flex flex-col gap-6">
      {/* Sub-tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-0">
        {(['crm', 'score'] as SubTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-sky-500 text-sky-400 bg-sky-500/10'
                : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
            }`}
          >
            {tab === 'crm' ? 'Leads CRM' : 'Score'}
          </button>
        ))}
      </div>

      {activeTab === 'crm' && (
        <div className="flex flex-col gap-6">
          {/* Stage summary */}
          <StageSummary leads={filteredLeads} />

          {/* Growth line chart */}
          <GrowthLineChart
            leads={filteredLeads}
            mode={growthMode}
            onModeChange={setGrowthMode}
          />

          {/* Demographic pie charts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <PieDonutChart
              title="Gênero"
              data={generoData}
              height={260}
            />
            <PieDonutChart
              title="Top 5 Cidades"
              data={cidadesData}
              height={260}
            />
            <PieDonutChart
              title="Estado Civil"
              data={estadoCivilData}
              height={260}
            />
          </div>

          {/* Leads table */}
          <LeadsTable leads={filteredLeads} />
        </div>
      )}

      {activeTab === 'score' && (
        <GlassCard title="Score de Leads">
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <p
              className="text-lg font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              Em desenvolvimento
            </p>
            <p
              className="text-sm text-center max-w-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              O módulo de Score de Leads estará disponível em breve, com
              classificação automática baseada em comportamento e perfil.
            </p>
          </div>
        </GlassCard>
      )}
    </div>
  )
}
