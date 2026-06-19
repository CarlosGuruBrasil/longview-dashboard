'use client'

import { useMemo, useState } from 'react'
import { ShoppingBag, DollarSign, TrendingUp, MousePointerClick } from 'lucide-react'
import { useData } from '../../context/DataContext'
import { isSale, getLeadValueNumber, getLeadDate, getLeadTags } from '../../utils/leads'
import { formatCurrency, formatDate, CHART_PALETTE } from '../../utils/formatters'
import GlassCard from '../ui/GlassCard'
import KpiCard from '../ui/KpiCard'
import type { Lead } from '../../types'

// ── helpers ──────────────────────────────────────────────────────────────────

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  items.forEach(item => {
    const k = key(item)
    const arr = map.get(k)
    if (arr) arr.push(item)
    else map.set(k, [item])
  })
  return map
}

function topByVgv(map: Map<string, Lead[]>, limit = 5): Array<{ name: string; count: number; vgv: number }> {
  return Array.from(map.entries())
    .map(([name, leads]) => ({
      name,
      count: leads.length,
      vgv: leads.reduce((s, l) => s + getLeadValueNumber(l), 0),
    }))
    .sort((a, b) => b.vgv - a.vgv)
    .slice(0, limit)
}

function hasVisitaStage(lead: Lead): boolean {
  const s = (lead.situacao?.nome || '').toLowerCase()
  return s.includes('visita')
}

// ── ranking card ──────────────────────────────────────────────────────────────

interface RankingCardProps {
  title: string
  items: Array<{ name: string; count: number; vgv: number }>
}

function RankingCard({ title, items }: RankingCardProps) {
  return (
    <GlassCard title={title}>
      <ol className="flex flex-col gap-2">
        {items.length === 0 && (
          <li className="text-sm text-center py-4" style={{ color: '#71717a' }}>Sem dados</li>
        )}
        {items.map((item, i) => (
          <li key={item.name} className="flex items-center gap-3">
            <span
              className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold"
              style={{
                backgroundColor: i < 3 ? `${CHART_PALETTE[i]}33` : 'rgba(255,255,255,0.05)',
                color: i < 3 ? CHART_PALETTE[i] : '#71717a',
              }}
            >
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: '#e4e4e7' }}>
                {item.name}
              </p>
              <p className="text-xs" style={{ color: '#71717a' }}>
                {item.count} venda{item.count !== 1 ? 's' : ''} · {formatCurrency(item.vgv)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </GlassCard>
  )
}

// ── table filters ─────────────────────────────────────────────────────────────

interface SalesTableProps {
  sales: Lead[]
}

function SalesTable({ sales }: SalesTableProps) {
  const [search, setSearch] = useState('')
  const [corretor, setCorretor] = useState('')
  const [imobiliaria, setImobiliaria] = useState('')
  const [gestor, setGestor] = useState('')
  const [empreendimento, setEmpreendimento] = useState('')

  const corretores = useMemo(() => {
    const set = new Set(sales.map(l => l.corretor?.nome).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [sales])

  const imobiliarias = useMemo(() => {
    const set = new Set(sales.map(l => l.imobiliaria?.nome).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [sales])

  const gestores = useMemo(() => {
    const set = new Set(sales.map(l => l.gestor?.nome).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [sales])

  const empreendimentos = useMemo(() => {
    const set = new Set(
      sales.flatMap(l => l.empreendimento?.map(e => e.nome).filter(Boolean) ?? []) as string[],
    )
    return Array.from(set).sort()
  }, [sales])

  const filtered = useMemo(() => {
    return sales
      .filter(l => {
        if (search && !l.nome?.toLowerCase().includes(search.toLowerCase())) return false
        if (corretor && l.corretor?.nome !== corretor) return false
        if (imobiliaria && l.imobiliaria?.nome !== imobiliaria) return false
        if (gestor && l.gestor?.nome !== gestor) return false
        if (empreendimento && !l.empreendimento?.some(e => e.nome === empreendimento)) return false
        return true
      })
      .slice(0, 200)
  }, [sales, search, corretor, imobiliaria, gestor, empreendimento])

  const selectClass =
    'bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-zinc-300 outline-none focus:border-sky-500/50 transition-colors'

  return (
    <div className="flex flex-col gap-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Buscar nome..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 outline-none focus:border-sky-500/50 transition-colors min-w-[140px]"
        />
        {([
          ['Corretor', corretores, corretor, setCorretor],
          ['Imobiliária', imobiliarias, imobiliaria, setImobiliaria],
          ['Gestor', gestores, gestor, setGestor],
          ['Empreendimento', empreendimentos, empreendimento, setEmpreendimento],
        ] as const).map(([label, opts, val, setter]) => (
          <select
            key={label}
            value={val}
            onChange={e => setter(e.target.value)}
            className={selectClass}
          >
            <option value="">{label}</option>
            {opts.map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        ))}
        {(search || corretor || imobiliaria || gestor || empreendimento) && (
          <button
            onClick={() => {
              setSearch('')
              setCorretor('')
              setImobiliaria('')
              setGestor('')
              setEmpreendimento('')
            }}
            className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-zinc-400 hover:text-zinc-200 hover:border-white/20 transition-colors"
          >
            Limpar
          </button>
        )}
        <span className="ml-auto text-xs self-center" style={{ color: '#71717a' }}>
          {filtered.length} resultados
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              {['Nome', 'Cadastro', 'Empreendimento', 'Corretor', 'Imobiliária', 'Gestor', 'Valor', 'Tags'].map(col => (
                <th
                  key={col}
                  className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                  style={{ color: '#71717a' }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-sm" style={{ color: '#71717a' }}>
                  Nenhuma venda encontrada
                </td>
              </tr>
            ) : (
              filtered.map((l, i) => {
                const v = getLeadValueNumber(l)
                const tags = getLeadTags(l)
                return (
                  <tr
                    key={l.idlead ?? l.id ?? i}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="px-3 py-2 font-medium whitespace-nowrap" style={{ color: '#e4e4e7' }}>
                      {l.nome || '-'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: '#a1a1aa' }}>
                      {formatDate(getLeadDate(l))}
                    </td>
                    <td className="px-3 py-2 max-w-[160px] truncate" style={{ color: '#a1a1aa' }}>
                      {l.empreendimento?.map(e => e.nome).join(', ') || '-'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: '#a1a1aa' }}>
                      {l.corretor?.nome || '-'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: '#a1a1aa' }}>
                      {l.imobiliaria?.nome || '-'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: '#a1a1aa' }}>
                      {l.gestor?.nome || '-'}
                    </td>
                    <td
                      className="px-3 py-2 whitespace-nowrap font-semibold"
                      style={{ color: v > 0 ? '#10b981' : '#71717a' }}
                    >
                      {v > 0 ? formatCurrency(v) : '-'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {tags.slice(0, 3).map(tag => (
                          <span
                            key={tag}
                            className="text-xs px-1.5 py-0.5 rounded-full"
                            style={{ backgroundColor: 'rgba(14,165,233,0.15)', color: '#38bdf8' }}
                          >
                            {tag}
                          </span>
                        ))}
                        {tags.length > 3 && (
                          <span className="text-xs" style={{ color: '#71717a' }}>+{tags.length - 3}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function VendasView() {
  const { filteredLeads } = useData()

  const sales = useMemo(() => filteredLeads.filter(isSale), [filteredLeads])

  // KPIs
  const qtd = sales.length
  const vgvTotal = useMemo(() => sales.reduce((s, l) => s + getLeadValueNumber(l), 0), [sales])
  const ticketMedio = qtd > 0 ? vgvTotal / qtd : 0

  // Visitas que viraram venda — use allLeads for full picture but filter by date via filteredLeads
  const visitasTotal = useMemo(() => filteredLeads.filter(hasVisitaStage).length, [filteredLeads])
  const visitaConvRate = visitasTotal > 0 ? ((qtd / visitasTotal) * 100).toFixed(1) : '0.0'

  // Rankings (from filteredLeads isSale)
  const topCorretores = useMemo(() => topByVgv(groupBy(sales, l => l.corretor?.nome || 'Sem Corretor')), [sales])
  const topImobiliarias = useMemo(
    () => topByVgv(groupBy(sales, l => l.imobiliaria?.nome || 'Sem Imobiliária')),
    [sales],
  )
  const topEmpreendimentos = useMemo(
    () =>
      topByVgv(
        groupBy(
          sales.flatMap(l =>
            (l.empreendimento?.length ?? 0) > 0
              ? (l.empreendimento ?? []).map(e => ({ ...l, _emp: e.nome }))
              : [{ ...l, _emp: 'Não Informado' }],
          ) as (Lead & { _emp: string })[],
          l => (l as Lead & { _emp: string })._emp,
        ) as unknown as Map<string, Lead[]>,
      ),
    [sales],
  )
  const topGestores = useMemo(() => topByVgv(groupBy(sales, l => l.gestor?.nome || 'Sem Gestor')), [sales])
  const topTipologias = useMemo(() => {
    // tipologia is not a direct field — use empreendimento nome as proxy grouped differently
    // since Lead has no tipologia field, use "empreendimento + score bucket" or just empreendimento
    return topByVgv(
      groupBy(sales, l => {
        const emp = l.empreendimento?.[0]?.nome
        return emp ? `${emp}` : 'Não Informada'
      }),
    )
  }, [sales])

  return (
    <div className="flex flex-col gap-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          icon={ShoppingBag}
          label="Qtd. de Vendas"
          value={qtd}
          color="#10b981"
        />
        <KpiCard
          icon={DollarSign}
          label="VGV Total"
          value={formatCurrency(vgvTotal)}
          color="#0ea5e9"
        />
        <KpiCard
          icon={TrendingUp}
          label="Ticket Médio"
          value={formatCurrency(ticketMedio)}
          color="#a855f7"
        />
        <KpiCard
          icon={MousePointerClick}
          label="Visitas → Venda"
          value={`${visitaConvRate}%`}
          subtitle={`${qtd} vendas / ${visitasTotal} visitas`}
          color="#f59e0b"
        />
      </div>

      {/* Top 5 Rankings */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <RankingCard title="Top Corretores" items={topCorretores} />
        <RankingCard title="Top Imobiliárias" items={topImobiliarias} />
        <RankingCard title="Top Empreendimentos" items={topEmpreendimentos} />
        <RankingCard title="Top Gestores" items={topGestores} />
        <RankingCard title="Top Tipologias" items={topTipologias} />
      </div>

      {/* Sales table */}
      <GlassCard title={`Tabela de Vendas (${sales.length} total)`}>
        <SalesTable sales={sales} />
      </GlassCard>
    </div>
  )
}
