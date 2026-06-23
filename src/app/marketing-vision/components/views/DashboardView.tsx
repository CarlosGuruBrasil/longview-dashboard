'use client'

import { useMemo, useState } from 'react'
import { Users, DollarSign, MapPin, Banknote } from 'lucide-react'
import { useData } from '../../context/DataContext'
import { isSale, getOrigin, getLeadValueNumber } from '../../utils/leads'
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

  // Conta por reserva (qtde_reservas_associadas), não por lead único
  const totalVendasCount = useMemo(
    () => salesLeads.reduce((acc, l) => acc + (l.qtde_reservas_associadas || 1), 0),
    [salesLeads]
  )

  const visitCount = useMemo(
    () => filteredLeads.filter(l => l.situacao?.nome?.toLowerCase().includes('visita')).length,
    [filteredLeads]
  )

  const totalSalesValue = useMemo(
    () => salesLeads.reduce((acc, l) => acc + getLeadValueNumber(l), 0),
    [salesLeads]
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
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-zinc-400">Carregando dados...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* KPI Row — gap menor no mobile para cards não ficarem espaçados demais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <KpiCard icon={Users} label="Total de Leads" value={filteredLeads.length}
          subtitle={`de ${crmTotal.toLocaleString('pt-BR')} na base`} color="#0ea5e9" />
        <KpiCard icon={DollarSign} label="Total de Vendas" value={totalVendasCount} color="#10b981" />
        <KpiCard icon={MapPin} label="Visitas Realizadas" value={visitCount} color="#f59e0b" />
        <KpiCard icon={Banknote} label="VGV Total" value={formatCurrency(totalSalesValue)} color="#a855f7" />
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
