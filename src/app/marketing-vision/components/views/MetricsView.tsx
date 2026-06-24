'use client'

import { useData } from '../../context/DataContext'
import KpiGaugeHistoryCard from '../metrics/KpiGaugeHistoryCard'
import CostPerLeadCard from '../metrics/CostPerLeadCard'

export default function MetricsView() {
  const { filteredLeads, metaData, loading } = useData()

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

      {/* ── Funil de conversão: 4 KPIs ── */}
      <section>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3 px-0.5">
          Funil de Conversão
        </h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <KpiGaugeHistoryCard metric="novos_leads"  leads={filteredLeads} loading={loading} />
          <KpiGaugeHistoryCard metric="atendimento"  leads={filteredLeads} loading={loading} />
          <KpiGaugeHistoryCard metric="agendamento"  leads={filteredLeads} loading={loading} />
          <KpiGaugeHistoryCard metric="visitas"      leads={filteredLeads} loading={loading} />
        </div>
      </section>

      {/* ── Resultados comerciais ── */}
      <section>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3 px-0.5">
          Resultados Comerciais
        </h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <KpiGaugeHistoryCard metric="proposta" leads={filteredLeads} loading={loading} />
          <KpiGaugeHistoryCard metric="vendas"   leads={filteredLeads} loading={loading} />
        </div>
      </section>

      {/* ── Custo de lead (MKT) ── */}
      <section>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3 px-0.5">
          Marketing
        </h2>
        <CostPerLeadCard leads={filteredLeads} metaData={metaData} loading={loading} />
      </section>

    </div>
  )
}
