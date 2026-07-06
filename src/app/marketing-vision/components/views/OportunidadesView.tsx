'use client'

import { useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts'
import { Flame, TrendingUp, XCircle, DollarSign, Percent, UserX, Snowflake, Database } from 'lucide-react'
import { useData } from '../../context/DataContext'
import { isSale, isLoss, isOpportunity, getLeadValueNumber, getLeadDate } from '../../utils/leads'
import { formatCurrency, formatDate, CHART_PALETTE } from '../../utils/formatters'
import GlassCard from '../ui/GlassCard'
import KpiCard from '../ui/KpiCard'
import PieDonutChart from '../charts/PieDonutChart'
import FilterBar from '../ui/FilterBar'
import DataTable from '../ui/DataTable'


// ── funnel stage buckets ────────────────────────────────────────────────────
const FUNNEL_STAGES = [
  { label: 'Triagem', keywords: ['aguardando', 'sdr', 'sem conexão', 'sem conexao'] },
  { label: 'Atendimento', keywords: ['em atendimento'] },
  { label: 'Visita', keywords: ['visita'] },
  { label: 'Proposta/Sim', keywords: ['proposta', 'simula', 'negoci'] },
  { label: 'Reserva', keywords: ['reserva', 'com reserva'] },
  { label: 'Venda', keywords: ['venda realizada', 'negócio ganho', 'negocio ganho', 'vendid'] },
]

function stageIndex(situacaoNome: string | undefined): number {
  if (!situacaoNome) return 0
  const s = situacaoNome.toLowerCase()
  for (let i = FUNNEL_STAGES.length - 1; i >= 0; i--) {
    const stage = FUNNEL_STAGES[i]
    if (stage && stage.keywords.some(k => s.includes(k))) return i
  }
  return 0
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ value: number; name: string; payload: Record<string, unknown> }>
  label?: string
}

function BarTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-xs">
      <p className="text-zinc-300 font-medium mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-zinc-400">{p.name}: {p.value}</p>
      ))}
    </div>
  )
}

function VgvTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-xs">
      <p className="text-zinc-300 font-medium mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-zinc-400">{formatCurrency(p.value)}</p>
      ))}
    </div>
  )
}

export default function OportunidadesView() {
  const { filteredLeads } = useData()
  const [lossPage] = useState(0)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'data'>('dashboard')

  // ── derived sets ──────────────────────────────────────────────────────────
  const opportunities = useMemo(() => filteredLeads.filter(isOpportunity), [filteredLeads])
  const losses = useMemo(() => filteredLeads.filter(isLoss), [filteredLeads])

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const vgvOpp = useMemo(() => opportunities.reduce((s, l) => s + getLeadValueNumber(l), 0), [opportunities])
  const vgvLoss = useMemo(() => losses.reduce((s, l) => s + getLeadValueNumber(l), 0), [losses])
  const total = filteredLeads.length
  const taxaDescarte = total > 0 ? ((losses.length / total) * 100).toFixed(1) : '0.0'

  const leadsNaoBatidos = useMemo(
    () => filteredLeads.filter(l => !isSale(l) && !isLoss(l) && !l.corretor?.nome).length,
    [filteredLeads],
  )

  const leadsEsfriando = useMemo(() => {
    const now = new Date()
    return filteredLeads.filter(l => {
      if (isSale(l) || isLoss(l)) return false
      const raw = l.ultima_data_conversao || getLeadDate(l)
      if (!raw) return false
      const d = new Date(String(raw).split(' ')[0].split('T')[0])
      if (isNaN(d.getTime())) return false
      const diffDays = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
      return diffDays > 10
    }).length
  }, [filteredLeads])

  // ── Funnel ────────────────────────────────────────────────────────────────
  const funnelData = useMemo(() => {
    const counts = Array(FUNNEL_STAGES.length).fill(0) as number[]
    filteredLeads.forEach(l => {
      const idx = stageIndex(l.situacao?.nome)
      for (let i = 0; i <= idx; i++) counts[i]++
    })
    return FUNNEL_STAGES.map((stage, i) => ({
      stage: stage.label,
      count: counts[i] ?? 0,
      conversion: i === 0
        ? 100
        : counts[0] ?? 0 > 0
          ? +((((counts[i] ?? 0) / (counts[0] ?? 1)) * 100).toFixed(1))
          : 0,
    }))
  }, [filteredLeads])

  // ── Pie: pipeline by situacao ─────────────────────────────────────────────
  const pipelineData = useMemo(() => {
    const map = new Map<string, number>()
    opportunities.forEach(l => {
      const k = l.situacao?.nome || 'Sem Situação'
      map.set(k, (map.get(k) ?? 0) + 1)
    })
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [opportunities])

  // ── Pie: loss reasons ─────────────────────────────────────────────────────
  const lossReasonData = useMemo(() => {
    const map = new Map<string, number>()
    losses.forEach(l => {
      const k = l.motivo_cancelamento?.nome || 'Não informado'
      map.set(k, (map.get(k) ?? 0) + 1)
    })
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [losses])

  // ── Bar: VGV by loss reason ───────────────────────────────────────────────
  const vgvByReason = useMemo(() => {
    const map = new Map<string, number>()
    losses.forEach(l => {
      const k = l.motivo_cancelamento?.nome || 'Não informado'
      map.set(k, (map.get(k) ?? 0) + getLeadValueNumber(l))
    })
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [losses])

  // ── Loss table (last 30) ──────────────────────────────────────────────────
  const recentLosses = useMemo(() => {
    return [...losses]
      .sort((a, b) => {
        const da = getLeadDate(a) || ''
        const db = getLeadDate(b) || ''
        return db.localeCompare(da)
      })
      .slice(lossPage * 30, lossPage * 30 + 30)
  }, [losses, lossPage])

  return (
    <div className="flex flex-col gap-6">
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
          Painel de Análise
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
          {/* KPI Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
            <KpiCard
              icon={Flame}
              label="Leads Quentes"
              value={opportunities.length}
              color="#f59e0b"
            />
            <KpiCard
              icon={TrendingUp}
              label="VGV Potencial"
              value={formatCurrency(vgvOpp)}
              color="#10b981"
            />
            <KpiCard
              icon={XCircle}
              label="Leads Perdidos"
              value={losses.length}
              color="#f43f5e"
            />
            <KpiCard
              icon={DollarSign}
              label="VGV Perdido"
              value={formatCurrency(vgvLoss)}
              color="#6b7280"
            />
            <KpiCard
              icon={Percent}
              label="Taxa de Descarte"
              value={`${taxaDescarte}%`}
              color="#a855f7"
            />
            <KpiCard
              icon={UserX}
              label="Sem Corretor"
              value={leadsNaoBatidos}
              color="#f59e0b"
            />
            <KpiCard
              icon={Snowflake}
              label="Leads Esfriando"
              value={leadsEsfriando}
              subtitle="+10 dias sem interação"
              color="#f97316"
            />
          </div>

          {/* Funnel */}
          <GlassCard title="Funil de Conversão">
            <div className="flex flex-col gap-2">
              {/* horizontal bar chart */}
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={funnelData}
                  layout="vertical"
                  margin={{ top: 4, right: 60, bottom: 4, left: 80 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="stage"
                    tick={{ fill: '#a1a1aa', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={78}
                  />
                  <Tooltip content={<BarTooltip />} />
                  <Bar dataKey="count" name="Leads" radius={[0, 4, 4, 0]} maxBarSize={28}>
                    {funnelData.map((_, i) => (
                      <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {/* conversion rate pills */}
              <div className="flex flex-wrap gap-2 mt-1">
                {funnelData.map((d, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-0.5 rounded-full border border-white/10"
                    style={{ color: '#a1a1aa', backgroundColor: 'rgba(255,255,255,0.03)' }}
                  >
                    {d.stage}: <strong style={{ color: CHART_PALETTE[i % CHART_PALETTE.length] }}>{d.conversion}%</strong>
                  </span>
                ))}
              </div>
            </div>
          </GlassCard>

          {/* Charts row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <PieDonutChart
              title="Pipeline de Oportunidades"
              data={pipelineData.length > 0 ? pipelineData : [{ name: 'Sem dados', value: 1 }]}
              height={260}
            />
            <PieDonutChart
              title="Motivos de Perda"
              data={lossReasonData.length > 0 ? lossReasonData : [{ name: 'Sem dados', value: 1 }]}
              colors={['#f43f5e', '#f97316', '#f59e0b', '#a855f7', '#6b7280', '#64748b', '#ef4444', '#dc2626']}
              height={260}
            />
            <GlassCard title="VGV por Motivo de Perda">
              {vgvByReason.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: '#71717a' }}>Sem dados</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={vgvByReason} margin={{ top: 4, right: 8, bottom: 48, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#71717a', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis hide />
                    <Tooltip content={<VgvTooltip />} />
                    <Bar dataKey="value" name="VGV" radius={[4, 4, 0, 0]} maxBarSize={32}>
                      {vgvByReason.map((_, i) => (
                        <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </GlassCard>
          </div>

          {/* Loss table */}
          <GlassCard title={`Últimos 30 Leads Perdidos (${losses.length} total)`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    {['Nome', 'Data', 'Empreendimento', 'Corretor', 'Motivo', 'Valor'].map(col => (
                      <th
                        key={col}
                        className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider"
                        style={{ color: '#71717a' }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentLosses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-sm" style={{ color: '#71717a' }}>
                        Nenhum lead perdido no período
                      </td>
                    </tr>
                  ) : (
                    recentLosses.map((l, i) => {
                      const v = getLeadValueNumber(l)
                      return (
                        <tr
                          key={l.idlead ?? l.id ?? i}
                          className="border-b border-white/5 hover:bg-white/5 transition-colors"
                        >
                          <td className="px-3 py-2 font-medium" style={{ color: '#e4e4e7' }}>
                            {l.nome || '-'}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap" style={{ color: '#a1a1aa' }}>
                            {formatDate(getLeadDate(l))}
                          </td>
                          <td className="px-3 py-2" style={{ color: '#a1a1aa' }}>
                            {l.empreendimento?.[0]?.nome || '-'}
                          </td>
                          <td className="px-3 py-2" style={{ color: '#a1a1aa' }}>
                            {l.corretor?.nome || '-'}
                          </td>
                          <td className="px-3 py-2" style={{ color: '#a1a1aa' }}>
                            {l.motivo_cancelamento?.nome || l.situacao?.nome || '-'}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap font-medium" style={{ color: v > 0 ? '#f43f5e' : '#71717a' }}>
                            {v > 0 ? formatCurrency(v) : '-'}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </>
      ) : (
        <GlassCard>
          <DataTable<any>
            title="Oportunidades Ativas no Funil"
            rows={opportunities}
            exportFileName="oportunidades_ativas"
            searchFields={['nome', 'email', 'telefone', 'celular']}
            searchPlaceholder="Buscar por nome, e-mail, telefone..."
            defaultSortField="data_cadastro"
            columns={[
              { label: 'Nome', field: 'nome', render: row => <span className="font-semibold text-zinc-100">{row.nome || 'Sem Nome'}</span> },
              { label: 'Contato', render: row => (
                  <div className="flex flex-col text-[11px] text-zinc-400">
                    <span>{row.email || '—'}</span>
                    <span>{row.celular || row.telefone || '—'}</span>
                  </div>
                ),
                csvValue: row => `${row.email || ''} / ${row.celular || row.telefone || ''}`
              },
              { label: 'Situação', field: 'situacao', render: row => (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                    {row.situacao?.nome || 'Sem Situação'}
                  </span>
                ),
                csvValue: row => row.situacao?.nome || ''
              },
              { label: 'Empreendimento', render: row => row.empreendimento?.[0]?.nome || 'Não informado', csvValue: row => row.empreendimento?.[0]?.nome || '' },
              { label: 'Corretor', render: row => row.corretor?.nome || 'Sem Corretor', csvValue: row => row.corretor?.nome || '' },
              { label: 'Gestor', render: row => row.gestor?.nome || '—', csvValue: row => row.gestor?.nome || '' },
              { label: 'Temperatura', field: 'temperatura', render: row => (
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    row.temperatura === 'Quente' ? 'bg-red-500/20 text-red-400' :
                    row.temperatura === 'Morno' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-blue-500/20 text-blue-400'
                  }`}>
                    {row.temperatura || '—'}
                  </span>
                )
              },
              { label: 'VGV Negócio', field: 'valor_negocio', align: 'right', render: row => {
                  const val = getLeadValueNumber(row);
                  return val > 0 ? formatCurrency(val) : '—';
                },
                csvValue: row => String(getLeadValueNumber(row))
              },
              { label: 'Cadastro', field: 'data_cadastro', render: row => formatDate(getLeadDate(row)) }
            ]}
          />
        </GlassCard>
      )}
    </div>
  )
}
