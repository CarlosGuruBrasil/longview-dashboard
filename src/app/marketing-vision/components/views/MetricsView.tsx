'use client'

import { useState, useMemo } from 'react'
import { Database } from 'lucide-react'
import { useData } from '../../context/DataContext'
import FilterBar from '../ui/FilterBar'
import KpiGaugeHistoryCard from '../metrics/KpiGaugeHistoryCard'
import CostPerLeadCard from '../metrics/CostPerLeadCard'
import AlertsPanel from '../ui/AlertsPanel'
import DataTable from '../ui/DataTable'
import { formatNumber } from '../../utils/formatters'

type MediaStatRow = {
  name: string;
  leads: number;
  atend: number;
  visita: number;
  proposta: number;
  vendas: number;
  [key: string]: unknown;
}


export default function MetricsView() {
  const { allLeads, filteredLeads, metaData, loading } = useData()
  const [activeTab, setActiveTab] = useState<'dashboard' | 'data' | 'equipe'>('dashboard')

  // Agrupa os leads filtrados por mídia e calcula a conversão de cada estágio
  const mediaStats = useMemo<MediaStatRow[]>(() => {
    const map = new Map<string, MediaStatRow>()
    for (const l of filteredLeads) {
      const o = typeof l.origem === 'string' ? l.origem : l.origem?.nome || 'Desconhecida'
      const key = o.toLowerCase().trim()
      const stats = map.get(key) ?? { name: o, leads: 0, atend: 0, visita: 0, proposta: 0, vendas: 0 }
      stats.leads++
      
      const s = (l.situacao?.nome ?? '').toLowerCase()
      if (s.includes('atend')) stats.atend++
      if (s.includes('visita')) stats.visita++
      if (s.includes('proposta') || s.includes('reserva') || s.includes('simula')) stats.proposta++
      if (s.includes('venda') || s.includes('contrat') || s.includes('ganho')) stats.vendas++
      
      map.set(key, stats)
    }
    return Array.from(map.values()).sort((a, b) => b.leads - a.leads)
  }, [filteredLeads])

  // Agrupa leads por Corretor e calcula volumetria do funil
  const corretorStats = useMemo<MediaStatRow[]>(() => {
    const map = new Map<string, MediaStatRow>()
    for (const l of filteredLeads) {
      const c = l.corretor
      const cName = String((typeof c === 'object' && c ? c.nome : c) || 'Sem Corretor')
      const key = cName.toLowerCase().trim()
      const stats = map.get(key) ?? { name: cName, leads: 0, atend: 0, visita: 0, proposta: 0, vendas: 0 }
      stats.leads++
      
      const s = (l.situacao?.nome ?? '').toLowerCase()
      if (s.includes('atend')) stats.atend++
      if (s.includes('visita')) stats.visita++
      if (s.includes('proposta') || s.includes('reserva') || s.includes('simula')) stats.proposta++
      if (s.includes('venda') || s.includes('contrat') || s.includes('ganho')) stats.vendas++
      
      map.set(key, stats)
    }
    return Array.from(map.values()).sort((a, b) => b.leads - a.leads)
  }, [filteredLeads])

  // Agrupa leads por Imobiliária e calcula volumetria do funil
  const imobiliariaStats = useMemo<MediaStatRow[]>(() => {
    const map = new Map<string, MediaStatRow>()
    for (const l of filteredLeads) {
      const imob = l.imobiliaria
      const iName = String((typeof imob === 'object' && imob ? imob.nome : imob) || 'Sem Imobiliária')
      const key = iName.toLowerCase().trim()
      const stats = map.get(key) ?? { name: iName, leads: 0, atend: 0, visita: 0, proposta: 0, vendas: 0 }
      stats.leads++
      
      const s = (l.situacao?.nome ?? '').toLowerCase()
      if (s.includes('atend')) stats.atend++
      if (s.includes('visita')) stats.visita++
      if (s.includes('proposta') || s.includes('reserva') || s.includes('simula')) stats.proposta++
      if (s.includes('venda') || s.includes('contrat') || s.includes('ganho')) stats.vendas++
      
      map.set(key, stats)
    }
    return Array.from(map.values()).sort((a, b) => b.leads - a.leads)
  }, [filteredLeads])

  if (loading && filteredLeads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: '60vh' }}>
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-2 border-white/10" />
          <div className="absolute inset-0 rounded-full border-2 border-t-sky-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
        </div>
        <div className="text-center">
          <p className="text-[15px] font-medium text-zinc-300">Carregando métricas</p>
          <p className="text-[13px] text-zinc-500 mt-1">Analisando dados do funil de vendas…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Filters */}
      <FilterBar />

      {/* Abas Superiores - Estilo Adidas */}
      <div className="flex border-b border-white/10 -mb-px">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
            activeTab === 'dashboard'
              ? 'border-sky-500 text-sky-400 bg-sky-500/10'
              : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
          }`}
        >
          Painel de Métricas
        </button>
        <button
          onClick={() => setActiveTab('equipe')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
            activeTab === 'equipe'
              ? 'border-sky-500 text-sky-400 bg-sky-500/10'
              : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
          }`}
        >
          Desempenho da Equipe
        </button>
        <button
          onClick={() => setActiveTab('data')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
            activeTab === 'data'
              ? 'border-sky-500 text-sky-400 bg-sky-500/10'
              : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
          }`}
        >
          <Database size={14} /> Tabela de Dados
        </button>
      </div>

      {activeTab === 'dashboard' ? (
        <>
          {/* ── Alertas e sugestões ── */}
          <section>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3 px-0.5">
              Alertas &amp; Sugestões
            </h2>
            <AlertsPanel />
          </section>

          {/* ── Funil de conversão: 4 KPIs ── */}
          <section>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3 px-0.5">
              Funil de Conversão
            </h2>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <KpiGaugeHistoryCard metric="novos_leads"  leads={allLeads} loading={loading} />
              <KpiGaugeHistoryCard metric="atendimento"  leads={allLeads} loading={loading} />
              <KpiGaugeHistoryCard metric="agendamento"  leads={allLeads} loading={loading} />
              <KpiGaugeHistoryCard metric="visitas"      leads={allLeads} loading={loading} />
            </div>
          </section>

          {/* ── Resultados comerciais ── */}
          <section>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3 px-0.5">
              Resultados Comerciais
            </h2>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <KpiGaugeHistoryCard metric="proposta" leads={allLeads} loading={loading} />
              <KpiGaugeHistoryCard metric="vendas"   leads={allLeads} loading={loading} />
            </div>
          </section>

          {/* ── Custo de lead (MKT) ── */}
          <section>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3 px-0.5">
              Marketing
            </h2>
            <CostPerLeadCard leads={filteredLeads} metaData={metaData} loading={loading} />
          </section>
        </>
      ) : activeTab === 'equipe' ? (
        <div className="flex flex-col gap-6">
          <DataTable<MediaStatRow>
            title="Desempenho por Corretor"
            rows={corretorStats}
            exportFileName="desempenho_corretores"
            searchFields={['name']}
            searchPlaceholder="Buscar corretor..."
            defaultSortField="leads"
            columns={[
              { label: 'Corretor', field: 'name', render: row => <span className="font-semibold text-zinc-100">{row.name}</span> },
              { label: 'Leads Atribuídos', field: 'leads', align: 'right', render: row => formatNumber(row.leads) },
              { label: 'Em Atendimento', field: 'atend', align: 'right', render: row => formatNumber(row.atend) },
              { label: 'Com Visita', field: 'visita', align: 'right', render: row => formatNumber(row.visita) },
              { label: 'Proposta / Reserva', field: 'proposta', align: 'right', render: row => formatNumber(row.proposta) },
              { label: 'Vendas Realizadas', field: 'vendas', align: 'right', render: row => formatNumber(row.vendas) },
              {
                label: 'Taxa Conversão',
                align: 'right',
                render: row => {
                  const pct = row.leads > 0 ? ((row.vendas / row.leads) * 100).toFixed(1) : '0.0'
                  return (
                    <span className={`font-bold ${Number(pct) > 5 ? 'text-emerald-400' : Number(pct) > 1.5 ? 'text-amber-400' : 'text-zinc-500'}`}>
                      {pct}%
                    </span>
                  )
                },
                csvValue: row => `${row.leads > 0 ? ((row.vendas / row.leads) * 100).toFixed(1) : '0.0'}%`
              }
            ]}
          />

          <DataTable<MediaStatRow>
            title="Desempenho por Imobiliária"
            rows={imobiliariaStats}
            exportFileName="desempenho_imobiliarias"
            searchFields={['name']}
            searchPlaceholder="Buscar imobiliária..."
            defaultSortField="leads"
            columns={[
              { label: 'Imobiliária', field: 'name', render: row => <span className="font-semibold text-zinc-100">{row.name}</span> },
              { label: 'Leads Atribuídos', field: 'leads', align: 'right', render: row => formatNumber(row.leads) },
              { label: 'Em Atendimento', field: 'atend', align: 'right', render: row => formatNumber(row.atend) },
              { label: 'Com Visita', field: 'visita', align: 'right', render: row => formatNumber(row.visita) },
              { label: 'Proposta / Reserva', field: 'proposta', align: 'right', render: row => formatNumber(row.proposta) },
              { label: 'Vendas Realizadas', field: 'vendas', align: 'right', render: row => formatNumber(row.vendas) },
              {
                label: 'Taxa Conversão',
                align: 'right',
                render: row => {
                  const pct = row.leads > 0 ? ((row.vendas / row.leads) * 100).toFixed(1) : '0.0'
                  return (
                    <span className={`font-bold ${Number(pct) > 5 ? 'text-emerald-400' : Number(pct) > 1.5 ? 'text-amber-400' : 'text-zinc-500'}`}>
                      {pct}%
                    </span>
                  )
                },
                csvValue: row => `${row.leads > 0 ? ((row.vendas / row.leads) * 100).toFixed(1) : '0.0'}%`
              }
            ]}
          />
        </div>
      ) : (
        <DataTable<MediaStatRow>
          title="Métricas de Conversão por Canal / Origem"
          rows={mediaStats}
          exportFileName="conversao_por_origem"
          searchFields={['name']}
          searchPlaceholder="Buscar origem de mídia..."
          defaultSortField="leads"
          columns={[
            { label: 'Origem de Mídia', field: 'name', render: row => <span className="font-semibold text-zinc-100">{row.name}</span> },
            { label: 'Total Leads', field: 'leads', align: 'right', render: row => formatNumber(row.leads) },
            { label: 'Em Atendimento', field: 'atend', align: 'right', render: row => formatNumber(row.atend) },
            { label: 'Com Visita', field: 'visita', align: 'right', render: row => formatNumber(row.visita) },
            { label: 'Proposta / Reserva', field: 'proposta', align: 'right', render: row => formatNumber(row.proposta) },
            { label: 'Vendas Aprovadas', field: 'vendas', align: 'right', render: row => formatNumber(row.vendas) },
            {
              label: 'Taxa Conversão',
              align: 'right',
              render: row => {
                const pct = row.leads > 0 ? ((row.vendas / row.leads) * 100).toFixed(1) : '0.0'
                return (
                  <span className={`font-bold ${Number(pct) > 5 ? 'text-emerald-400' : Number(pct) > 1.5 ? 'text-amber-400' : 'text-zinc-500'}`}>
                    {pct}%
                  </span>
                )
              },
              csvValue: row => `${row.leads > 0 ? ((row.vendas / row.leads) * 100).toFixed(1) : '0.0'}%`
            }
          ]}
        />
      )}
    </div>
  )
}
