'use client'

import { useMemo, useState } from 'react'
import { Users, DollarSign, MapPin, Banknote } from 'lucide-react'
import { useData } from '../../context/DataContext'
import { isSale, getOrigin, getLeadValueNumber, getReservaValueNumber } from '../../utils/leads'
import { formatCurrency } from '../../utils/formatters'
import KpiCard from '../ui/KpiCard'
import SalesGrowthChart from '../charts/SalesGrowthChart'
import StatusBarChart from '../charts/StatusBarChart'
import OriginsBarChart from '../charts/OriginsBarChart'
import TrendsChart from '../charts/TrendsChart'

export default function DashboardView() {
  const { filteredLeads, allLeads, crmTotal, loading } = useData()

  const [salesChartMode, setSalesChartMode] = useState<'month' | 'year'>('month')

  const salesLeads = useMemo(() => filteredLeads.filter(isSale), [filteredLeads])

  // Leads com reserva ativa (ainda não confirmada como venda)
  const reservaLeads = useMemo(
    () => filteredLeads.filter(l => l.situacao?.nome?.toLowerCase() === 'com reserva'),
    [filteredLeads]
  )

  // Contagem correta: número de leads em "Venda Realizada" (1 lead = 1 negócio fechado)
  // Não usar qtde_reservas_associadas — reservas ≠ vendas no CV CRM
  const totalVendasCount = salesLeads.length

  const visitCount = useMemo(
    () => filteredLeads.filter(l => l.situacao?.nome?.toLowerCase().includes('visita')).length,
    [filteredLeads]
  )

  // VGV de vendas confirmadas (usa valor_venda, formato americano da API)
  const totalSalesValue = useMemo(
    () => salesLeads.reduce((acc, l) => acc + getLeadValueNumber(l), 0),
    [salesLeads]
  )

  // VGV em pipeline (reservas ainda não convertidas)
  const totalReservaValue = useMemo(
    () => reservaLeads.reduce((acc, l) => acc + getReservaValueNumber(l), 0),
    [reservaLeads]
  )

  // Vendas por Origem — mostra quantidade e VGV das vendas realizadas
  const salesByOriginData = useMemo(() => {
    const map = new Map<string, { quantidade: number; vgv: number }>()
    for (const lead of salesLeads) {
      const origin = getOrigin(lead)
      const existing = map.get(origin) ?? { quantidade: 0, vgv: 0 }
      existing.quantidade++
      existing.vgv += getLeadValueNumber(lead)
      map.set(origin, existing)
    }
    const sorted = Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.quantidade - a.quantidade)

    if (sorted.length <= 6) return sorted

    const top = sorted.slice(0, 5)
    const rest = sorted.slice(5)
    const otherQtd = rest.reduce((s, i) => s + i.quantidade, 0)
    const otherVgv = rest.reduce((s, i) => s + i.vgv, 0)
    top.push({ name: 'Outros', quantidade: otherQtd, vgv: otherVgv })
    return top
  }, [salesLeads])

  // Leads por Status — gráfico de barras
  const leadsByStatus = useMemo(() => {
    const map = new Map<string, number>()
    for (const lead of filteredLeads) {
      const status = lead.situacao?.nome || 'Sem etapa'
      map.set(status, (map.get(status) ?? 0) + 1)
    }
    const sorted = Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    if (sorted.length <= 8) return sorted

    const top = sorted.slice(0, 7)
    const restSum = sorted.slice(7).reduce((s, i) => s + i.value, 0)
    top.push({ name: 'Outros', value: restSum })
    return top
  }, [filteredLeads])

  if (loading && allLeads.length === 0) {
    // HIG: loading state com spinner + contexto (>1s de espera)
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: '60vh' }}>
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-2 border-white/10" />
          <div className="absolute inset-0 rounded-full border-2 border-t-sky-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
        </div>
        <div className="text-center">
          <p className="text-[15px] font-medium text-zinc-300">Carregando dados</p>
          <p className="text-[13px] text-zinc-500 mt-1">Buscando leads e vendas do CRM…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <KpiCard icon={Users} label="Total de Leads" value={filteredLeads.length}
          subtitle={`de ${crmTotal.toLocaleString('pt-BR')} na base`} color="#0ea5e9" />
        <KpiCard icon={DollarSign} label="Vendas Realizadas" value={totalVendasCount}
          subtitle={`VGV ${formatCurrency(totalSalesValue)}`} color="#10b981" />
        <KpiCard icon={MapPin} label="Visitas Realizadas" value={visitCount} color="#f59e0b" />
        <KpiCard icon={Banknote} label="VGV em Reserva"
          value={formatCurrency(totalReservaValue)}
          subtitle={`${reservaLeads.length} reserva${reservaLeads.length !== 1 ? 's' : ''} ativas`}
          color="#a855f7" />
      </div>

      {/* Gráfico de Vendas Realizadas — largura total */}
      <div className="w-full">
        <SalesGrowthChart allLeads={filteredLeads} mode={salesChartMode} onModeChange={setSalesChartMode} />
      </div>

      {/* Tendência — Leads / Vendas / CPL por período com média móvel */}
      <div className="w-full">
        <TrendsChart />
      </div>

      {/* Vendas por Origem (quantidade + VGV) e Leads por Status (barras) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OriginsBarChart
          title="Vendas por Origem — Quantidade e VGV"
          data={salesByOriginData}
        />
        <StatusBarChart
          title="Leads por Status"
          data={leadsByStatus}
        />
      </div>
    </div>
  )
}
