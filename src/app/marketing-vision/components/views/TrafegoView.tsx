'use client'

import { useMemo, useState } from 'react'
import { DollarSign, Users, Target, Eye, TrendingUp, TrendingDown, Database } from 'lucide-react'
import { useData } from '../../context/DataContext'
import { isSale, getLeadValueNumber, getOrigin } from '../../utils/leads'
import { formatCurrency, formatNumber } from '../../utils/formatters'
import KpiCard from '../ui/KpiCard'
import DataTable from '../ui/DataTable'
import type { Lead } from '../../types'


// ── helpers ───────────────────────────────────────────────────────────────────
const num = (v: unknown) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'))
  return isNaN(n) ? 0 : n
}
const leadsFromActions = (actions?: { action_type: string; value?: string }[]) =>
  num(actions?.find(a => a.action_type === 'lead' || a.action_type === 'onsite_conversion.lead_grouped')?.value)

const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

/** Classifica o produto pelo nome da campanha */
function produtoFromCampaign(name: string): string {
  const s = (name || '').toLowerCase()
  if (s.includes('hub') || s.includes('beira') || s.includes('hbm')) return 'Hub Beira Mar'
  if (s.includes('nautic')) return 'Nautic'
  if (!s.trim()) return 'Sem campanha'
  return 'Outros'
}

/** Lead veio de mídia paga? (origem/mídia de anúncio) */
function isAdLead(lead: Lead): boolean {
  const s = `${getOrigin(lead)} ${String(lead.origem ?? '')}`.toLowerCase()
  return /facebook|instagram|meta|\bads?\b|paid|tr[áa]fego/.test(s)
}

// ── delta badge ────────────────────────────────────────────────────────────────
function Delta({ curr, prev, invert = false }: { curr: number; prev: number; invert?: boolean }) {
  if (!prev) return <span className="text-[11px] text-zinc-500">—</span>
  const pct = ((curr - prev) / prev) * 100
  const up = pct >= 0
  // invert=true → subir é ruim (ex: CPL)
  const good = invert ? !up : up
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${good ? 'text-emerald-400' : 'text-red-400'}`}>
      <Icon size={11} /> {Math.abs(pct).toFixed(0)}%
    </span>
  )
}

export default function TrafegoView() {
  const { metaData, allLeads } = useData()
  const [activeTab, setActiveTab] = useState<'dashboard' | 'data'>('dashboard')
  const [dataSubTab, setDataSubTab] = useState<'daily' | 'campaigns' | 'platforms'>('daily')

  const monthly = metaData?.monthly ?? []
  const daily   = metaData?.daily ?? []
  const campaigns = useMemo(() => metaData?.campaigns ?? [], [metaData])
  const platforms = useMemo(() => metaData?.platforms ?? [], [metaData])

  const now = new Date()
  const curYM  = ym(now)
  const lastYM = ym(new Date(now.getFullYear(), now.getMonth() - 1, 1))
  const yoyYM  = ym(new Date(now.getFullYear() - 1, now.getMonth(), 1))
  const todayISO = `${curYM}-${String(now.getDate()).padStart(2, '0')}`

  const m = (yyyymm: string) => monthly.find(x => (x.date_start || '').startsWith(yyyymm))
  const cur = m(curYM), last = m(lastYM), yoy = m(yoyYM)

  const spendCur  = num(cur?.spend),  spendLast = num(last?.spend),  spendYoy = num(yoy?.spend)
  const leadsCur  = leadsFromActions(cur?.actions)
  const leadsLast = leadsFromActions(last?.actions)
  const leadsYoy  = leadsFromActions(yoy?.actions)
  const reachCur  = num(cur?.reach), reachLast = num(last?.reach)
  const cplCur    = leadsCur  ? spendCur  / leadsCur  : 0
  const cplLast   = leadsLast ? spendLast / leadsLast : 0
  const leadsToday = leadsFromActions(daily.find(d => d.date_start === todayISO)?.actions)

  // CPA / ROAS estimado (atribuição aproximada por origem de mídia)
  const { roas, cpa, adSalesCount } = useMemo(() => {
    const adSales = allLeads.filter(l => isSale(l) && isAdLead(l))
    const adSalesValue = adSales.reduce((s, l) => s + getLeadValueNumber(l), 0)
    const totalSpend = num(metaData?.global?.spend)
    return {
      adSalesCount: adSales.length,
      roas: totalSpend ? adSalesValue / totalSpend : 0,
      cpa:  adSales.length ? totalSpend / adSales.length : 0,
    }
  }, [allLeads, metaData])

  // Ranking de campanhas por CPL
  const ranking = useMemo(() => {
    return campaigns
      .map(c => {
        const spend = num(c.spend)
        const leads = leadsFromActions(c.actions)
        return { name: c.campaign_name, spend, leads, cpl: leads ? spend / leads : Infinity }
      })
      .filter(c => c.spend > 0)
      .sort((a, b) => a.cpl - b.cpl)
  }, [campaigns])
  const escalar = ranking.filter(c => c.leads > 0).slice(0, 3)
  const cortar  = ranking.filter(c => c.cpl === Infinity || c.cpl > 0).sort((a, b) => b.cpl - a.cpl).slice(0, 3)

  // Leads por produto (das campanhas)
  const porProduto = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of campaigns) {
      const p = produtoFromCampaign(c.campaign_name)
      map.set(p, (map.get(p) ?? 0) + leadsFromActions(c.actions))
    }
    return Array.from(map.entries()).map(([name, leads]) => ({ name, leads })).filter(x => x.leads > 0).sort((a, b) => b.leads - a.leads)
  }, [campaigns])

  // Leads por plataforma
  const porPlataforma = useMemo(() => {
    return platforms
      .map(p => ({ name: p.publisher_platform || '—', leads: leadsFromActions(p.actions), spend: num(p.spend) }))
      .filter(x => x.leads > 0 || x.spend > 0)
      .sort((a, b) => b.leads - a.leads)
  }, [platforms])

  const hasData = monthly.length > 0 || campaigns.length > 0

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            Tráfego — Mídia Paga
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })} · dados do Meta (atualizado pelo sync a cada 2h)
          </p>
        </div>
      </div>

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
          Painel de Mídia
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
          {!hasData && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-300">
              Sem dados de mídia em cache ainda. Rode o sync-dashboard ou aguarde o próximo ciclo.
            </div>
          )}

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <KpiCard icon={DollarSign} label="Gasto no mês" value={formatCurrency(spendCur)} color="#0ea5e9"
              subtitleNode={<>MoM <Delta curr={spendCur} prev={spendLast} /> <span className="text-zinc-600">·</span> YoY <Delta curr={spendCur} prev={spendYoy} /></>} />
            <KpiCard icon={Users} label="Leads de mídia" value={leadsCur} color="#10b981"
              subtitleNode={<>hoje: {leadsToday} <span className="text-zinc-600">·</span> <Delta curr={leadsCur} prev={leadsLast} /> <span className="text-zinc-600">·</span> YoY <Delta curr={leadsCur} prev={leadsYoy} /></>} />
            <KpiCard icon={Target} label="CPL" value={formatCurrency(cplCur)} color="#f59e0b"
              subtitleNode={<>vs mês passado <Delta curr={cplCur} prev={cplLast} invert /></>} />
            <KpiCard icon={Eye} label="Alcance" value={formatNumber(reachCur)} color="#a855f7"
              subtitleNode={<><Delta curr={reachCur} prev={reachLast} /> vs mês passado</>} />
          </div>

          {/* CPA / ROAS estimado */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
            <KpiCard icon={Target} label="CPA (estimado)" value={cpa ? formatCurrency(cpa) : '—'} color="#ec4899"
              subtitle={`${adSalesCount} vendas atribuídas a mídia`} />
            <KpiCard icon={TrendingUp} label="ROAS (estimado)" value={roas ? `${roas.toFixed(1)}x` : '—'} color="#22c55e"
              subtitle="valor vendido ÷ gasto total" />
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 flex items-center text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              ⚠️ CPA/ROAS são estimativas: atribuição lead→venda por origem de mídia. Precisão melhora quando a origem das campanhas estiver limpa no CV CRM.
            </div>
          </div>

          {/* Ranking de campanhas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>🟢 Escalar (menor CPL)</h3>
              {escalar.length === 0 ? <p className="text-xs text-zinc-500">Sem campanhas com leads.</p> :
                escalar.map(c => (
                  <div key={c.name} className="flex justify-between items-center py-1.5 border-b border-white/5 text-xs">
                    <span className="truncate max-w-[60%]" style={{ color: 'var(--text-primary)' }}>{c.name}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{c.leads} leads · <strong className="text-emerald-400">{formatCurrency(c.cpl)}</strong>/lead</span>
                  </div>
                ))}
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>🔴 Cortar / revisar (maior CPL ou sem lead)</h3>
              {cortar.length === 0 ? <p className="text-xs text-zinc-500">Nenhuma campanha problemática.</p> :
                cortar.map(c => (
                  <div key={c.name} className="flex justify-between items-center py-1.5 border-b border-white/5 text-xs">
                    <span className="truncate max-w-[60%]" style={{ color: 'var(--text-primary)' }}>{c.name}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{formatCurrency(c.spend)} · <strong className="text-red-400">{c.cpl === Infinity ? '0 leads' : `${formatCurrency(c.cpl)}/lead`}</strong></span>
                  </div>
                ))}
            </div>
          </div>

          {/* Por produto e por plataforma */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Leads por produto</h3>
              {porProduto.length === 0 ? <p className="text-xs text-zinc-500">Sem dados.</p> :
                porProduto.map(p => (
                  <div key={p.name} className="flex justify-between py-1.5 border-b border-white/5 text-xs">
                    <span style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                    <strong style={{ color: 'var(--text-secondary)' }}>{p.leads}</strong>
                  </div>
                ))}
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Leads por plataforma</h3>
              {porPlataforma.length === 0 ? <p className="text-xs text-zinc-500">Sem dados.</p> :
                porPlataforma.map(p => (
                  <div key={p.name} className="flex justify-between py-1.5 border-b border-white/5 text-xs">
                    <span className="capitalize" style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{p.leads} leads · {formatCurrency(p.spend)}</span>
                  </div>
                ))}
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Sub-abas de dados */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {[
              { key: 'daily', label: 'Desempenho Diário' },
              { key: 'campaigns', label: 'Estatísticas de Campanhas' },
              { key: 'platforms', label: 'Plataformas de Anúncio' },
            ].map(sub => (
              <button
                key={sub.key}
                onClick={() => setDataSubTab(sub.key as any)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all whitespace-nowrap ${
                  dataSubTab === sub.key
                    ? 'bg-white text-zinc-900 border-transparent'
                    : 'bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10'
                }`}
              >
                {sub.label}
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            {dataSubTab === 'daily' && (
              <DataTable<any>
                title="Histórico Diário de Tráfego e CPL"
                rows={daily}
                exportFileName="trafego_diario_meta"
                searchFields={['date_start']}
                searchPlaceholder="Buscar data (YYYY-MM-DD)..."
                defaultSortField="date_start"
                columns={[
                  { label: 'Data', field: 'date_start' },
                  { label: 'Gasto', field: 'spend', align: 'right', render: row => formatCurrency(Number(row.spend ?? 0)), csvValue: row => String(row.spend ?? 0) },
                  { label: 'Leads Mídia', field: 'leads', align: 'right', render: row => formatNumber(leadsFromActions(row.actions)) },
                  {
                    label: 'CPL',
                    align: 'right',
                    render: row => {
                      const l = leadsFromActions(row.actions)
                      const s = Number(row.spend ?? 0)
                      return formatCurrency(l > 0 ? s / l : s)
                    },
                    csvValue: row => {
                      const l = leadsFromActions(row.actions)
                      const s = Number(row.spend ?? 0)
                      return String(l > 0 ? s / l : s)
                    }
                  },
                  { label: 'Impressões', field: 'impressions', align: 'right', render: row => formatNumber(Number(row.impressions ?? 0)) },
                  { label: 'Cliques', field: 'clicks', align: 'right', render: row => formatNumber(Number(row.clicks ?? 0)) },
                  {
                    label: 'CTR',
                    align: 'right',
                    render: row => {
                      const c = Number(row.clicks ?? 0)
                      const i = Number(row.impressions ?? 0)
                      return i > 0 ? `${((c / i) * 100).toFixed(2)}%` : '0.00%'
                    },
                    csvValue: row => {
                      const c = Number(row.clicks ?? 0)
                      const i = Number(row.impressions ?? 0)
                      return i > 0 ? `${((c / i) * 100).toFixed(2)}%` : '0.00%'
                    }
                  }
                ]}
              />
            )}

            {dataSubTab === 'campaigns' && (
              <DataTable<any>
                title="Desempenho Geral de Campanhas (Meta Ads)"
                rows={ranking}
                exportFileName="desempenho_campanhas"
                searchFields={['name']}
                searchPlaceholder="Buscar campanha..."
                defaultSortField="spend"
                columns={[
                  { label: 'Campanha', field: 'name', render: row => <span className="font-semibold text-zinc-100">{row.name}</span> },
                  { label: 'Gasto', field: 'spend', align: 'right', render: row => formatCurrency(row.spend), csvValue: row => String(row.spend) },
                  { label: 'Leads', field: 'leads', align: 'right', render: row => formatNumber(row.leads) },
                  { label: 'CPL', field: 'cpl', align: 'right', render: row => row.cpl === Infinity ? '—' : formatCurrency(row.cpl), csvValue: row => String(row.cpl) },
                  { label: 'Impressões', field: 'impressions', align: 'right', render: row => formatNumber(row.impressions) },
                  { label: 'Cliques', field: 'clicks', align: 'right', render: row => formatNumber(row.clicks) },
                  { label: 'CTR', field: 'ctr', align: 'right', render: row => `${row.ctr.toFixed(2)}%` }
                ]}
              />
            )}

            {dataSubTab === 'platforms' && (
              <DataTable<any>
                title="Desempenho por Plataforma de Publicação"
                rows={porPlataforma}
                exportFileName="desempenho_plataformas"
                searchFields={['name']}
                searchPlaceholder="Buscar plataforma..."
                defaultSortField="leads"
                columns={[
                  { label: 'Plataforma', field: 'name', render: row => <span className="capitalize">{row.name}</span> },
                  { label: 'Gasto', field: 'spend', align: 'right', render: row => formatCurrency(row.spend), csvValue: row => String(row.spend) },
                  { label: 'Leads Gerados', field: 'leads', align: 'right', render: row => formatNumber(row.leads) },
                  {
                    label: 'CPL',
                    align: 'right',
                    render: row => formatCurrency(row.leads > 0 ? row.spend / row.leads : row.spend),
                    csvValue: row => String(row.leads > 0 ? row.spend / row.leads : row.spend)
                  }
                ]}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
