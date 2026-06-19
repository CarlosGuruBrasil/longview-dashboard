'use client'

import { useMemo, useState } from 'react'
import { Users, DollarSign, MapPin, Banknote } from 'lucide-react'
import { useData } from '../../context/DataContext'
import { isSale, getOrigin, getLeadValueNumber } from '../../utils/leads'
import { formatCurrency } from '../../utils/formatters'
import KpiCard from '../ui/KpiCard'
import SalesGrowthChart from '../charts/SalesGrowthChart'
import PieDonutChart from '../charts/PieDonutChart'

export default function DashboardView() {
  const { filteredLeads, allLeads, crmTotal, loading } = useData()

  // ALL hooks must be declared before any early return
  const [salesChartMode, setSalesChartMode] = useState<'month' | 'year'>('month')

  const salesLeads = useMemo(() => filteredLeads.filter(isSale), [filteredLeads])

  const visitCount = useMemo(
    () => filteredLeads.filter(l => l.situacao?.nome?.toLowerCase().includes('visita')).length,
    [filteredLeads]
  )

  const totalSalesValue = useMemo(
    () => salesLeads.reduce((acc, l) => acc + getLeadValueNumber(l), 0),
    [salesLeads]
  )

  const salesByOrigin = useMemo(() => {
    const map = new Map<string, number>()
    for (const lead of salesLeads) {
      const origin = getOrigin(lead)
      map.set(origin, (map.get(origin) ?? 0) + 1)
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [salesLeads])

  const leadsByOrigin = useMemo(() => {
    const map = new Map<string, number>()
    for (const lead of filteredLeads) {
      const origin = getOrigin(lead)
      map.set(origin, (map.get(origin) ?? 0) + 1)
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [filteredLeads])

  const leadsByStatus = useMemo(() => {
    const map = new Map<string, number>()
    for (const lead of filteredLeads) {
      const status = lead.situacao?.nome || 'Sem etapa'
      map.set(status, (map.get(status) ?? 0) + 1)
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [filteredLeads])

  // Early return AFTER all hooks
  if (loading && allLeads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-zinc-400">Carregando dados...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Users} label="Total de Leads" value={filteredLeads.length}
          subtitle={`de ${crmTotal.toLocaleString('pt-BR')} na base`} color="#0ea5e9" />
        <KpiCard icon={DollarSign} label="Total de Vendas" value={salesLeads.length} color="#10b981" />
        <KpiCard icon={MapPin} label="Visitas Realizadas" value={visitCount} color="#f59e0b" />
        <KpiCard icon={Banknote} label="Valor Total (Vendas)" value={formatCurrency(totalSalesValue)} color="#a855f7" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SalesGrowthChart allLeads={allLeads} mode={salesChartMode} onModeChange={setSalesChartMode} />
        <PieDonutChart title="Vendas por Origem" data={salesByOrigin} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PieDonutChart title="Leads por Origem" data={leadsByOrigin} />
        <PieDonutChart title="Leads por Status" data={leadsByStatus} />
      </div>
    </div>
  )
}
