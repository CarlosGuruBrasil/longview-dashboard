'use client'

import { useMemo, useState, useEffect } from 'react'
import { ShoppingBag, DollarSign, TrendingUp, MousePointerClick, RefreshCw } from 'lucide-react'
import { useData } from '../../context/DataContext'
import FilterBar from '../ui/FilterBar'
import { isSale, getLeadValueNumber } from '../../utils/leads'
import { getLeadStage } from '../../utils/metrics'
import { formatCurrency, formatDate, CHART_PALETTE } from '../../utils/formatters'
import GlassCard from '../ui/GlassCard'
import KpiCard from '../ui/KpiCard'
import LeadDrawer from '../ui/LeadDrawer'
import type { CvdwVenda, Lead } from '../../types'

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

function topByVgv(map: Map<string, CvdwVenda[]>, limit = 5) {
  return Array.from(map.entries())
    .map(([name, vendas]) => ({
      name,
      count: vendas.length,
      vgv: vendas.reduce((s, v) => s + (v.valor_contrato ?? 0), 0),
    }))
    .sort((a, b) => b.vgv - a.vgv)
    .slice(0, limit)
}

/**
 * Calcula a diferença em dias entre data_reserva e data_venda.
 * Retorna null se qualquer uma das datas estiver ausente.
 */
function calcDaysToSale(venda: CvdwVenda): number | null {
  const start = venda.data_reserva
  const end = venda.data_venda
  if (!start || !end) return null
  const a = new Date(start.replace(' ', 'T'))
  const b = new Date(end.replace(' ', 'T'))
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return null
  const diff = Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
  return diff < 0 ? 0 : diff
}

function DaysToSaleBadge({ days }: { days: number | null }) {
  if (days === null) return <span style={{ color: '#52525b' }}>-</span>

  let bg: string, color: string, label: string
  if (days <= 30) {
    bg = 'rgba(16,185,129,0.12)'
    color = '#10b981'
    label = '⚡ Rápido'
  } else if (days <= 90) {
    bg = 'rgba(245,158,11,0.12)'
    color = '#f59e0b'
    label = '⏱ Médio'
  } else {
    bg = 'rgba(168,85,247,0.12)'
    color = '#a855f7'
    label = '🕐 Longo'
  }

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold" style={{ color }}>
        {days === 0 ? 'No mesmo dia' : `${days} dias`}
      </span>
      <span
        className="text-[11px] px-1.5 py-0.5 rounded-full self-start whitespace-nowrap"
        style={{ backgroundColor: bg, color }}
      >
        {label}
      </span>
    </div>
  )
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

// ── venda detail modal — todos os dados vinculados da reserva ────────────────

function DetailField({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === '' || value === 0) return null
  return (
    <div>
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm text-zinc-200">{value}</p>
    </div>
  )
}

function VendaDetailModal({ venda, onClose, onOpenLead }: {
  venda: CvdwVenda | null
  onClose: () => void
  onOpenLead: (idlead: string) => void
}) {
  if (!venda) return null
  const dias = calcDaysToSale(venda)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0d0d0f] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between gap-3 px-6 py-4 border-b border-white/10 bg-[#0d0d0f]/95 backdrop-blur">
          <div>
            <p className="text-xs text-zinc-500">Reserva #{venda.idreserva ?? '-'}{venda.contrato_interno ? ` · Contrato ${venda.contrato_interno}` : ''}</p>
            <h3 className="text-base font-semibold text-zinc-100">{venda.cliente ?? '-'}</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition">✕</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Venda */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <DetailField label="Empreendimento" value={venda.empreendimento} />
            <DetailField label="Bloco / Unidade" value={[venda.bloco, venda.unidade].filter(Boolean).join(' / ')} />
            <DetailField label="Etapa" value={venda.etapa} />
            <DetailField label="Planta" value={venda.planta} />
            <DetailField label="Área privativa" value={venda.area_privativa ? `${venda.area_privativa} m²` : null} />
            <DetailField label="Região" value={venda.regiao} />
            <DetailField label="Reserva em" value={venda.data_reserva ? formatDate(venda.data_reserva) : null} />
            <DetailField label="Venda em" value={venda.data_venda ? formatDate(venda.data_venda) : null} />
            <DetailField label="Tempo até a compra" value={dias != null ? (dias === 0 ? 'No mesmo dia' : `${dias} dias`) : null} />
            <DetailField label="Valor de contrato" value={(venda.valor_contrato ?? 0) > 0 ? formatCurrency(venda.valor_contrato!) : null} />
            <DetailField label="Tipo de venda" value={venda.tipovenda} />
            <DetailField label="Tabela" value={venda.nometabela} />
          </div>

          {/* Cliente */}
          <div>
            <h4 className="text-sm font-semibold text-zinc-300 mb-2">Cliente</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <DetailField label="Nome" value={venda.cliente} />
              <DetailField label="E-mail" value={venda.email} />
              <DetailField label="Cidade" value={venda.cidade} />
              <DetailField label="Renda" value={(venda.renda ?? 0) > 0 ? formatCurrency(venda.renda!) : null} />
              <DetailField label="Idade" value={venda.idade} />
              <DetailField label="Sexo" value={venda.sexo} />
              <DetailField label="Estado civil" value={venda.estado_civil} />
            </div>
          </div>

          {/* Comercial */}
          <div>
            <h4 className="text-sm font-semibold text-zinc-300 mb-2">Comercial</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <DetailField label="Corretor" value={venda.corretor} />
              <DetailField label="Imobiliária" value={venda.imobiliaria} />
              <DetailField label="Mídia" value={venda.midia} />
              <DetailField label="Campanha" value={venda.campanha} />
            </div>
          </div>

          {/* Associados */}
          {venda.associados && venda.associados.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-zinc-300 mb-2">Associados ({venda.associados.length})</h4>
              <div className="space-y-2">
                {venda.associados.map((a, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm">
                    <span className="text-zinc-300">{a.tipo_associacao ?? 'Associado'}</span>
                    <span className="text-zinc-500 text-xs">
                      {a.percentagem_participacao != null ? `${a.percentagem_participacao}% de participação` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Link pro lead de origem */}
          {venda.idlead && (
            <button
              onClick={() => onOpenLead(String(venda.idlead))}
              className="w-full h-10 rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-400 text-sm font-semibold hover:bg-sky-500/20 transition"
            >
              Ver lead de origem (histórico e interações) →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── sales table ───────────────────────────────────────────────────────────────

const SALES_PAGE = 300

interface SalesTableProps {
  vendas: CvdwVenda[]
  onSelect: (venda: CvdwVenda) => void
}

function SalesTable({ vendas, onSelect }: SalesTableProps) {
  const [search, setSearch] = useState('')
  const [corretor, setCorretor] = useState('')
  const [imobiliaria, setImobiliaria] = useState('')
  const [empreendimento, setEmpreendimento] = useState('')
  const [visibleCount, setVisibleCount] = useState(SALES_PAGE)

  // Predicado parametrizável — `except` permite opções em cascata nos dropdowns
  // (cada um lista só valores possíveis dado o resto dos filtros ativos).
  const applyFilters = useMemo(() => {
    return (source: CvdwVenda[], except?: string) => source.filter(v => {
      if (except !== 'search'         && search && !v.cliente?.toLowerCase().includes(search.toLowerCase())) return false
      if (except !== 'corretor'       && corretor && v.corretor !== corretor) return false
      if (except !== 'imobiliaria'    && imobiliaria && v.imobiliaria !== imobiliaria) return false
      if (except !== 'empreendimento' && empreendimento && v.empreendimento !== empreendimento) return false
      return true
    })
  }, [search, corretor, imobiliaria, empreendimento])

  const corretores = useMemo(() =>
    Array.from(new Set(applyFilters(vendas, 'corretor').map(v => v.corretor).filter(Boolean) as string[])).sort(),
  [vendas, applyFilters])

  const imobiliarias = useMemo(() =>
    Array.from(new Set(applyFilters(vendas, 'imobiliaria').map(v => v.imobiliaria).filter(Boolean) as string[])).sort(),
  [vendas, applyFilters])

  const empreendimentos = useMemo(() =>
    Array.from(new Set(applyFilters(vendas, 'empreendimento').map(v => v.empreendimento).filter(Boolean) as string[])).sort(),
  [vendas, applyFilters])

  const filteredAll = useMemo(() => {
    return applyFilters(vendas)
      // Ordena pela data da venda mais recente primeiro
      .sort((a, b) => {
        const da = a.data_venda ? new Date(a.data_venda.replace(' ', 'T')).getTime() : 0
        const db = b.data_venda ? new Date(b.data_venda.replace(' ', 'T')).getTime() : 0
        return db - da
      })
  }, [vendas, applyFilters])

  // Reinicia a janela visível quando o filtro muda
  useEffect(() => { setVisibleCount(SALES_PAGE) }, [search, corretor, imobiliaria, empreendimento])

  const filtered = useMemo(() => filteredAll.slice(0, visibleCount), [filteredAll, visibleCount])
  const hasMore = filteredAll.length > visibleCount

  const chip     = 'no-tap shrink-0 h-9 px-3 rounded-full text-[13px] font-medium transition-all outline-none [color-scheme:dark] max-w-[140px]'
  const chipIdle = `${chip} border border-white/12 bg-white/[0.03] text-zinc-400 focus:border-white/30`
  const chipActv = `${chip} bg-white/90 text-zinc-900 border-transparent`

  const hasFilters = !!(search || corretor || imobiliaria || empreendimento)

  const cols = ['Cliente', 'Cad. Reserva', 'Data Venda', 'Tempo p/ Compra', 'Empreendimento', 'Bloco/Unidade', 'Corretor', 'Imobiliária', 'Valor Contrato', 'Tipologia']

  return (
    <div className="flex flex-col gap-3">
      {/* Filtros — estilo Adidas */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Buscar cliente..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={`${chipIdle} flex-1 min-w-0 placeholder:text-zinc-600`}
        />
        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setCorretor(''); setImobiliaria(''); setEmpreendimento(''); }}
            className={`${chipActv} !bg-zinc-700/60 !text-zinc-300 !border-white/10`}
          >✕</button>
        )}
      </div>

      {/* Selects horizontais scrolláveis */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
        {([
          ['Corretor',       corretores,      corretor,      setCorretor],
          ['Imobiliária',    imobiliarias,    imobiliaria,   setImobiliaria],
          ['Empreendimento', empreendimentos, empreendimento,setEmpreendimento],
        ] as const).map(([label, opts, val, setter]) => (
          <select
            key={label}
            value={val}
            onChange={e => setter(e.target.value)}
            className={val ? chipActv : chipIdle}
          >
            <option value="">{label}</option>
            {opts.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
        <span className="ml-auto self-center text-[13px] text-zinc-500 shrink-0 pl-2">
          Mostrando {filtered.length.toLocaleString('pt-BR')} de {filteredAll.length.toLocaleString('pt-BR')} vendas
        </span>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden flex flex-col gap-3">
        {filtered.length === 0 ? (
          <p className="text-center text-sm py-8" style={{ color: '#71717a' }}>Nenhuma venda encontrada</p>
        ) : filtered.map((v, i) => (
          <div
            key={`m-${v.idreserva ?? i}`}
            onClick={() => onSelect(v)}
            className="rounded-xl border border-white/10 bg-white/5 p-3 flex flex-col gap-2 cursor-pointer active:bg-white/10"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-semibold" style={{ color: '#e4e4e7' }}>{v.cliente || '-'}</span>
              <span className="text-xs font-bold shrink-0" style={{ color: (v.valor_contrato ?? 0) > 0 ? '#10b981' : '#71717a' }}>
                {(v.valor_contrato ?? 0) > 0 ? formatCurrency(v.valor_contrato!) : '-'}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span className="text-xs" style={{ color: '#71717a' }}>{v.empreendimento || '-'}</span>
              <span className="text-xs" style={{ color: '#71717a' }}>{[v.bloco, v.unidade].filter(Boolean).join(' / ') || '-'}</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs" style={{ color: '#10b981' }}>{v.data_venda ? formatDate(v.data_venda) : '-'}</span>
              <DaysToSaleBadge days={calcDaysToSale(v)} />
              {v.corretor && <span className="text-xs" style={{ color: '#a1a1aa' }}>{v.corretor}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              {cols.map(col => (
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
                <td colSpan={cols.length} className="px-3 py-8 text-center text-sm" style={{ color: '#71717a' }}>
                  Nenhuma venda encontrada
                </td>
              </tr>
            ) : (
              filtered.map((v, i) => (
                <tr
                  key={`${v.idreserva ?? i}-${v.idunidade ?? i}`}
                  onClick={() => onSelect(v)}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                >
                  {/* Cliente */}
                  <td className="px-3 py-2 font-medium whitespace-nowrap" style={{ color: '#e4e4e7' }}>
                    <div className="flex items-center gap-2">
                      <span>{v.cliente || '-'}</span>
                      {v.associados && v.associados.length > 0 && (
                        <span
                          className="text-[11px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded font-bold"
                          title={`${v.associados.length} associado(s): ${v.associados.map(a => a.tipo_associacao).join(', ')}`}
                        >
                          +{v.associados.length} assoc.
                        </span>
                      )}
                    </div>
                  </td>
                  {/* Cad. Reserva */}
                  <td className="px-3 py-2 whitespace-nowrap text-xs" style={{ color: '#71717a' }}>
                    {v.data_reserva ? formatDate(v.data_reserva) : '-'}
                  </td>
                  {/* Data Venda */}
                  <td className="px-3 py-2 whitespace-nowrap text-xs font-medium" style={{ color: '#10b981' }}>
                    {v.data_venda ? formatDate(v.data_venda) : '-'}
                  </td>
                  {/* Tempo p/ Compra */}
                  <td className="px-3 py-2 whitespace-nowrap">
                    <DaysToSaleBadge days={calcDaysToSale(v)} />
                  </td>
                  {/* Empreendimento */}
                  <td className="px-3 py-2 max-w-[140px] truncate" style={{ color: '#a1a1aa' }}>
                    {v.empreendimento || '-'}
                  </td>
                  {/* Bloco / Unidade */}
                  <td className="px-3 py-2 whitespace-nowrap text-xs" style={{ color: '#a1a1aa' }}>
                    {[v.bloco, v.unidade].filter(Boolean).join(' / ') || '-'}
                  </td>
                  {/* Corretor */}
                  <td className="px-3 py-2 whitespace-nowrap text-xs" style={{ color: '#a1a1aa' }}>
                    {v.corretor || '-'}
                  </td>
                  {/* Imobiliária */}
                  <td className="px-3 py-2 whitespace-nowrap text-xs" style={{ color: '#a1a1aa' }}>
                    {v.imobiliaria || '-'}
                  </td>
                  {/* Valor Contrato */}
                  <td
                    className="px-3 py-2 whitespace-nowrap font-semibold"
                    style={{ color: (v.valor_contrato ?? 0) > 0 ? '#10b981' : '#71717a' }}
                  >
                    {(v.valor_contrato ?? 0) > 0 ? formatCurrency(v.valor_contrato!) : '-'}
                  </td>
                  {/* Tipologia */}
                  <td className="px-3 py-2 whitespace-nowrap text-xs" style={{ color: '#a1a1aa' }}>
                    {[v.tipovenda, v.planta].filter(Boolean).join(' — ') || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <button
          onClick={() => setVisibleCount(c => c + SALES_PAGE)}
          className="self-center px-4 py-2 text-xs rounded-lg border border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/10 transition"
        >
          Carregar mais ({(filteredAll.length - filtered.length).toLocaleString('pt-BR')} restantes)
        </button>
      )}
    </div>
  )
}

// ── main component ─────────────────────────────────────────────────────────

export default function VendasView() {
  const { filteredLeads, allLeads } = useData()

  const [cvdwVendas, setCvdwVendas] = useState<CvdwVenda[]>([])
  const [loadingVendas, setLoadingVendas] = useState(false)
  const [vendaError, setVendaError] = useState<string | null>(null)
  const [selectedVenda, setSelectedVenda] = useState<CvdwVenda | null>(null)
  const [drawerLead, setDrawerLead] = useState<Lead | null>(null)

  // A partir da venda, abre o LeadDrawer do lead de origem (dados interligados)
  const openLeadById = (idlead: string) => {
    const lead = allLeads.find(l => String(l.idlead ?? l.id) === idlead)
    if (lead) {
      setSelectedVenda(null)
      setDrawerLead(lead)
    } else {
      alert(`Lead ${idlead} não está na base local carregada — refine o período pra localizá-lo.`)
    }
  }

  // Busca vendas individuais do endpoint CVDW
  const fetchVendas = async (force = false) => {
    setLoadingVendas(true)
    setVendaError(null)
    try {
      const url = force ? '/api/cv/vendas?refresh=true' : '/api/cv/vendas'
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setCvdwVendas(data.vendas ?? [])
    } catch (e: unknown) {
      setVendaError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoadingVendas(false)
    }
  }

  useEffect(() => {
    const id = window.setTimeout(() => { void fetchVendas() }, 0)
    return () => window.clearTimeout(id)
  }, [])

  // Fallback: usa leads do contexto para KPIs quando CVDW ainda não carregou
  const salesFromLeads = useMemo(() => filteredLeads.filter(isSale), [filteredLeads])

  // Denominador correto: todos os leads que JÁ PASSARAM pela visita
  // (inclui leads em reserva, proposta, venda — não só os que ainda estão no estágio visita)
  const visitasTotal = useMemo(
    () => filteredLeads.filter(l => getLeadStage(l) === 'visited').length,
    [filteredLeads]
  )

  // KPIs baseados nos dados CVDW (mais precisos, por reserva individual)
  const qtd = cvdwVendas.length > 0 ? cvdwVendas.length : salesFromLeads.length
  const vgvTotal = cvdwVendas.length > 0
    ? cvdwVendas.reduce((s, v) => s + (v.valor_contrato ?? 0), 0)
    : salesFromLeads.reduce((s, l) => s + getLeadValueNumber(l), 0)
  const ticketMedio = qtd > 0 ? vgvTotal / qtd : 0
  const visitaConvRate = visitasTotal > 0 ? ((salesFromLeads.length / visitasTotal) * 100).toFixed(1) : '0.0'

  // Rankings baseados em CVDW
  const topCorretores = useMemo(() =>
    topByVgv(groupBy(cvdwVendas, v => v.corretor || 'Sem Corretor')), [cvdwVendas])
  const topImobiliarias = useMemo(() =>
    topByVgv(groupBy(cvdwVendas, v => v.imobiliaria || 'Sem Imobiliária')), [cvdwVendas])
  const topEmpreendimentos = useMemo(() =>
    topByVgv(groupBy(cvdwVendas, v => v.empreendimento || 'Não Informado')), [cvdwVendas])
  const topMidias = useMemo(() =>
    topByVgv(groupBy(cvdwVendas, v => v.midia || 'Não Informada')), [cvdwVendas])
  const topTipos = useMemo(() =>
    topByVgv(groupBy(cvdwVendas, v => v.tipovenda || 'Não Informado')), [cvdwVendas])

  const usandoCvdw = cvdwVendas.length > 0

  return (
    <div className="flex flex-col gap-6">
      {/* Lead filters */}
      <FilterBar />

      {/* Banner de origem dos dados */}
      {!loadingVendas && (
        <div className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg text-xs border ${
          usandoCvdw
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
        }`}>
          <span>
            {usandoCvdw
              ? `✓ Dados individuais por reserva carregados (${cvdwVendas.length} vendas do CVDW)`
              : '⚠ Exibindo dados estimados dos leads. Clique em "Atualizar" para carregar dados por reserva.'}
          </span>
          <button
            onClick={() => fetchVendas(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-current opacity-80 hover:opacity-100 transition-opacity"
          >
            <RefreshCw size={12} />
            Atualizar
          </button>
        </div>
      )}

      {loadingVendas && (
        <div className="flex items-center justify-center gap-3 px-4 py-3 rounded-lg bg-sky-500/10 border border-sky-500/20 text-xs text-sky-400">
          <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
          Carregando vendas individuais do CVDW...
        </div>
      )}

      {vendaError && (
        <div className="px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          ⚠ Erro ao carregar CVDW: {vendaError}. Exibindo dados dos leads como fallback.
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          icon={ShoppingBag}
          label="Qtd. de Vendas"
          value={qtd}
          subtitle={usandoCvdw ? 'por reserva (CVDW)' : 'por lead (estimado)'}
          color="#10b981"
        />
        <KpiCard
          icon={DollarSign}
          label="VGV Total"
          value={formatCurrency(vgvTotal)}
          subtitle={usandoCvdw ? 'valor de contrato real' : 'valor negócio estimado'}
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
          subtitle={`${salesFromLeads.length} vendas / ${visitasTotal} visitaram`}
          color="#f59e0b"
        />
      </div>

      {/* Top 5 Rankings */}
      {usandoCvdw && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <RankingCard title="Top Corretores" items={topCorretores} />
          <RankingCard title="Top Imobiliárias" items={topImobiliarias} />
          <RankingCard title="Top Empreendimentos" items={topEmpreendimentos} />
          <RankingCard title="Top Mídias" items={topMidias} />
          <RankingCard title="Top Tipo de Venda" items={topTipos} />
        </div>
      )}

      {/* Sales table — individual por reserva */}
      {usandoCvdw ? (
        <GlassCard title={`Tabela de Vendas — Detalhamento por Reserva (${cvdwVendas.length} registros)`}>
          <SalesTable vendas={cvdwVendas} onSelect={setSelectedVenda} />
        </GlassCard>
      ) : (
        <GlassCard title="Tabela de Vendas (dados dos leads — aguardando CVDW)">
          <p className="text-sm text-zinc-500 py-6 text-center">
            Aguardando carregamento dos dados individuais por reserva...
          </p>
        </GlassCard>
      )}

      <VendaDetailModal venda={selectedVenda} onClose={() => setSelectedVenda(null)} onOpenLead={openLeadById} />
      <LeadDrawer lead={drawerLead} onClose={() => setDrawerLead(null)} />
    </div>
  )
}
