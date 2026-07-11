'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, BarChart, Cell,
} from 'recharts'
import {
  AlertTriangle, AlertCircle, Info, Flame, TrendingUp, TrendingDown,
  Lightbulb, RefreshCw, ClipboardCheck, ListChecks, Percent, Search, X,
} from 'lucide-react'
import LogoLoader from '@/components/ui/LogoLoader'
import logger from '@/lib/logger'
import InspecaoDetailModal from '../components/InspecaoDetailModal'

// ---------- tipos (espelham /api/construpoint/intelligence) ----------
interface Comparativos {
  mesReferencia: string | null
  inspecoes: { atual: number; mom: number | null; yoy: number | null }
  verificacoes: { atual: number; mom: number | null; yoy: number | null }
  taxaReprovacao: { atual: number; anterior: number | null; anoAnterior: number | null; mediaMovel: number | null }
}

interface MonthPoint {
  key: string; label: string
  inspecoes: number; verificacoes: number; aprovadas: number; reprovadas: number
  taxaReprovacao: number; mediaMovel: number | null
}

interface ObraRank {
  obra: string; verificacoes: number; reprovadas: number
  taxaReprovacao: number; tendencia: number | null
}

interface ItemSistemico {
  verificacao: string; modelo: string; reprovacoes: number; obras: number
  solucaoRecomendada: string | null
}

interface InspetorRank {
  inspetor: string; verificacoes: number; reprovadas: number; taxaReprovacao: number
}

interface Alerta {
  severidade: 'critico' | 'alto' | 'atencao' | 'info'
  titulo: string; detalhe: string; recomendacao: string
  actionHref?: string
}

interface IntelligenceData {
  comparativos: Comparativos
  serie: MonthPoint[]
  rankingObras: ObraRank[]
  itensSistemicos: ItemSistemico[]
  rankingInspetores: InspetorRank[]
  alertas: Alerta[]
  filterOptions: { obras: string[]; inspetores: string[] }
  meta: {
    taxaGeral90: number; inspecoesPendentes: number; semClassificacao: number
    agendadasAtrasadas: number; recusadas: number; pendentesReinspecao: number; geradoEm: string
  }
}

interface Ocorrencia {
  codigo?: string
  obra?: string
  inspetor?: string
  data?: string
  problema?: string
  solucao?: string
  inspecaoId?: number
}

// ---------- estilo ----------
const TICK = '#71717a'
const GRID = 'rgba(255,255,255,0.05)'

const SEV = {
  critico: { icon: Flame,         color: '#f43f5e', bg: 'bg-rose-500/10',    border: 'border-rose-500/25',    label: 'Crítico' },
  alto:    { icon: AlertTriangle, color: '#f59e0b', bg: 'bg-amber-500/10',   border: 'border-amber-500/25',   label: 'Alto' },
  atencao: { icon: AlertCircle,   color: '#0ea5e9', bg: 'bg-sky-500/10',     border: 'border-sky-500/25',     label: 'Atenção' },
  info:    { icon: Info,          color: '#a1a1aa', bg: 'bg-zinc-500/10',    border: 'border-zinc-500/25',    label: 'Info' },
} as const

function GlassCard({ title, children, className = '' }: {
  title?: string; children: React.ReactNode; className?: string
}) {
  return (
    <div className={`rounded-xl border border-[#1E1E22] bg-[#121214]/60 p-5 ${className}`}>
      {title && <h3 className="text-sm font-semibold text-zinc-300 mb-4">{title}</h3>}
      {children}
    </div>
  )
}

function DeltaChip({ value, invert = false, suffix = '%' }: { value: number | null; invert?: boolean; suffix?: string }) {
  if (value == null) return <span className="text-[11px] text-zinc-600">—</span>
  const good = invert ? value < 0 : value > 0
  const Icon = value > 0 ? TrendingUp : TrendingDown
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${good ? 'text-emerald-400' : 'text-rose-400'}`}>
      <Icon size={11} />
      {value > 0 ? '+' : ''}{value}{suffix}
    </span>
  )
}

function KpiCompareCard({ icon: Icon, label, value, color, mom, yoy, invert }: {
  icon: React.ElementType; label: string; value: string; color: string
  mom: number | null; yoy: number | null; invert?: boolean
}) {
  return (
    <div className="rounded-xl border border-[#1E1E22] bg-[#121214]/60 p-4">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs text-zinc-500 leading-tight">{label}</p>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}20` }}>
          <Icon size={14} style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-zinc-100">{value}</p>
      <div className="flex items-center gap-3 mt-2">
        <span className="text-[10px] text-zinc-600 uppercase">M/M</span>
        <DeltaChip value={mom} invert={invert} />
        <span className="text-[10px] text-zinc-600 uppercase ml-2">A/A</span>
        <DeltaChip value={yoy} invert={invert} />
      </div>
    </div>
  )
}

function formatDateShort(d?: string) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// Drill-down de uma linha de "falha sistêmica" — lista as ocorrências reais por trás do agregado,
// cada uma abrindo o InspecaoDetailModal (todos os dados da inspeção + checklist inteiro).
function ItemDetailModal({ item, onClose, onOpenInspecao }: {
  item: { verificacao: string; modelo: string } | null
  onClose: () => void
  onOpenInspecao: (id: number) => void
}) {
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!item) { setOcorrencias([]); return }
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const p = new URLSearchParams({ verificacao: item!.verificacao, modelo: item!.modelo })
        const r = await fetch(`/api/construpoint/intelligence/item?${p}`)
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const d = await r.json()
        setOcorrencias(d.ocorrencias ?? [])
      } catch (e) {
        logger.error({ err: e }, '[ItemDetailModal] fetch falhou')
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [item])

  if (!item) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl border border-[#1E1E22] bg-[#0d0d0f] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between gap-3 px-6 py-4 border-b border-[#1E1E22] bg-[#0d0d0f]/95 backdrop-blur">
          <div>
            <p className="text-xs text-zinc-500">{item.modelo}</p>
            <h3 className="text-base font-semibold text-zinc-100">{item.verificacao}</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition">
            <X size={18} />
          </button>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="relative w-8 h-8">
                <div className="absolute inset-0 rounded-full border-2 border-[#1E1E22]" />
                <div className="absolute inset-0 rounded-full border-2 border-t-violet-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
              </div>
            </div>
          ) : error ? (
            <p className="text-sm text-red-400 text-center py-8">{error}</p>
          ) : ocorrencias.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-8">Nenhuma ocorrência encontrada.</p>
          ) : (
            <div className="space-y-2">
              {ocorrencias.map((o, i) => (
                <button
                  key={i}
                  onClick={() => o.inspecaoId && onOpenInspecao(o.inspecaoId)}
                  disabled={!o.inspecaoId}
                  className="w-full text-left rounded-xl border border-[#1E1E22] bg-[#121214]/60 p-3 hover:bg-white/5 transition disabled:cursor-default disabled:hover:bg-[#121214]/60"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-mono text-zinc-300">{o.codigo ?? '-'}</span>
                    <span className="text-[11px] text-zinc-500">{o.obra} · {o.inspetor} · {formatDateShort(o.data)}</span>
                  </div>
                  {o.problema && <p className="text-xs text-zinc-400 mt-1">{o.problema}</p>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------- main ----------
export default function InteligenciaQualidadePage() {
  const router = useRouter()
  const [data, setData] = useState<IntelligenceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtros locais — cada tabela tem o seu, não afetam alertas/comparativos/ranking de obras.
  const [obraInspetores, setObraInspetores] = useState('')
  const [inspetorSearch, setInspetorSearch] = useState('')
  const [obraItens, setObraItens] = useState('')
  const [inspetorItens, setInspetorItens] = useState('')

  const [selectedItem, setSelectedItem] = useState<{ verificacao: string; modelo: string } | null>(null)
  const [selectedInspId, setSelectedInspId] = useState<number | null>(null)

  const queryString = useMemo(() => {
    const p = new URLSearchParams()
    if (obraInspetores) p.set('obraInspetores', obraInspetores)
    if (obraItens) p.set('obraItens', obraItens)
    if (inspetorItens) p.set('inspetorItens', inspetorItens)
    return p.toString()
  }, [obraInspetores, obraItens, inspetorItens])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(`/api/construpoint/intelligence?${queryString}`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setData(await r.json() as IntelligenceData)
    } catch (e) {
      logger.error({ err: e }, '[inteligencia] fetch inteligência falhou');
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const id = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(id)
  }, [queryString])

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center p-12" style={{ minHeight: '60vh' }}>
        <LogoLoader module="quality" text="Analisando dados de qualidade..." />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-12" style={{ minHeight: '60vh' }}>
        <AlertCircle className="text-red-400" size={32} />
        <p className="text-sm text-zinc-300 font-medium">Erro ao gerar inteligência</p>
        <p className="text-xs text-zinc-500">{error}</p>
        <button
          onClick={() => void load()}
          className="mt-2 px-4 py-2 text-xs rounded-lg bg-[#121214]/60 border border-[#1E1E22] text-zinc-300 hover:bg-white/10 transition flex items-center gap-2"
        >
          <RefreshCw size={12} /> Tentar novamente
        </button>
      </div>
    )
  }

  const { comparativos: c, serie, rankingObras, itensSistemicos, rankingInspetores, alertas } = data
  const serieRecente = serie.slice(-18)

  return (
    <div className="w-full space-y-6 p-4 md:p-6 relative">
      {loading && data && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0d0d0f]/60 backdrop-blur-[2px] rounded-xl transition-all duration-300">
          <div className="relative w-12 h-12 mb-4">
            <div className="absolute inset-0 rounded-full border-2 border-[#1E1E22]" />
            <div className="absolute inset-0 rounded-full border-2 border-t-violet-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
          </div>
          <p className="text-sm text-zinc-400 font-medium">Analisando dados...</p>
        </div>
      )}

      <div className={`space-y-6 transition-opacity duration-300 ${loading && data ? 'opacity-40 pointer-events-none' : ''}`}>
        {/* Alertas */}
      {alertas.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-zinc-300">
            Avisos e recomendações
            <span className="ml-2 text-xs font-normal text-zinc-500">{alertas.length} item{alertas.length !== 1 ? 's' : ''} detectado{alertas.length !== 1 ? 's' : ''} automaticamente</span>
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {alertas.map((a, i) => {
              const s = SEV[a.severidade]
              const Icon = s.icon
              return (
                <div key={i} className={`rounded-xl border ${s.border} ${s.bg} p-4`}>
                  <div className="flex items-start gap-3">
                    <Icon size={16} style={{ color: s.color }} className="mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: s.color }}>{s.label}</span>
                      </div>
                      <p className="text-sm font-semibold text-zinc-100 mt-0.5">{a.titulo}</p>
                      <p className="text-xs text-zinc-400 mt-1">{a.detalhe}</p>
                      <p className="text-xs text-zinc-300 mt-2 flex items-start gap-1.5">
                        <Lightbulb size={12} className="text-amber-300 mt-0.5 shrink-0" />
                        <span>{a.recomendacao}</span>
                      </p>
                      {a.actionHref && (
                        <Link href={a.actionHref} className="inline-flex mt-3 text-xs font-semibold hover:underline" style={{ color: s.color }}>
                          Ver registros que precisam de atenção →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* KPIs comparativos */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-300 mb-2">
          Comparativos {c.mesReferencia && <span className="text-xs font-normal text-zinc-500">— mês de referência: {c.mesReferencia}</span>}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <KpiCompareCard
            icon={ClipboardCheck} label="Inspeções no mês" color="#8b5cf6"
            value={c.inspecoes.atual.toLocaleString('pt-BR')}
            mom={c.inspecoes.mom} yoy={c.inspecoes.yoy}
          />
          <KpiCompareCard
            icon={ListChecks} label="Verificações no mês" color="#0ea5e9"
            value={c.verificacoes.atual.toLocaleString('pt-BR')}
            mom={c.verificacoes.mom} yoy={c.verificacoes.yoy}
          />
          <div className="rounded-xl border border-[#1E1E22] bg-[#121214]/60 p-4">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs text-zinc-500 leading-tight">Taxa de reprovação</p>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-rose-500/15">
                <Percent size={14} className="text-rose-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-zinc-100">{c.taxaReprovacao.atual}%</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-zinc-500">
              {c.taxaReprovacao.mediaMovel != null && (
                <span className={c.taxaReprovacao.atual <= c.taxaReprovacao.mediaMovel ? 'text-emerald-400' : 'text-rose-400'}>
                  Meta (média móvel): {c.taxaReprovacao.mediaMovel}%
                </span>
              )}
              {c.taxaReprovacao.anterior != null && <span>Mês anterior: {c.taxaReprovacao.anterior}%</span>}
              {c.taxaReprovacao.anoAnterior != null && <span>Ano anterior: {c.taxaReprovacao.anoAnterior}%</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Série histórica: taxa de reprovação × meta (média móvel) + volume */}
      <GlassCard title="Série histórica — Taxa de reprovação × Meta (média móvel 3m)">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={serieRecente} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="label" tick={{ fill: TICK, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="vol" orientation="right" tick={{ fill: TICK, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis yAxisId="taxa" tick={{ fill: TICK, fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
            <Tooltip
              contentStyle={{ background: '#121214', border: '1px solid #1E1E22', borderRadius: 12, fontSize: 12 }}
              labelStyle={{ color: '#d4d4d8', fontWeight: 600 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} formatter={v => <span style={{ color: '#a1a1aa' }}>{v}</span>} />
            <Bar yAxisId="vol" dataKey="verificacoes" name="Verificações" fill="rgba(139,92,246,0.25)" radius={[4, 4, 0, 0]} />
            <Line yAxisId="taxa" type="monotone" dataKey="taxaReprovacao" name="Taxa de reprovação (%)" stroke="#f43f5e" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
            <Line yAxisId="taxa" type="monotone" dataKey="mediaMovel" name="Meta — média móvel (%)" stroke="#f59e0b" strokeWidth={2} strokeDasharray="6 4" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </GlassCard>

      {/* Ranking de obras + inspetores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <GlassCard title="Obras por taxa de reprovação — últimos 90 dias">
          <ResponsiveContainer width="100%" height={Math.max(220, rankingObras.length * 28)}>
            <BarChart data={[...rankingObras].sort((a, b) => b.taxaReprovacao - a.taxaReprovacao)} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
              <XAxis type="number" tick={{ fill: TICK, fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
              <YAxis type="category" dataKey="obra" width={110} tick={{ fill: TICK, fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#121214', border: '1px solid #1E1E22', borderRadius: 12, fontSize: 12 }}
                formatter={(v, name) => [name === 'Taxa de reprovação' ? `${v}%` : v, name]}
              />
              <Bar dataKey="taxaReprovacao" name="Taxa de reprovação" radius={[0, 4, 4, 0]}>
                {[...rankingObras].sort((a, b) => b.taxaReprovacao - a.taxaReprovacao).map((o, i) => (
                  <Cell key={i} fill={o.taxaReprovacao >= data.meta.taxaGeral90 * 2 ? '#f43f5e' : o.taxaReprovacao > data.meta.taxaGeral90 ? '#f59e0b' : '#10b981'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[11px] text-zinc-600 mt-2">
            Verde: abaixo da média geral ({data.meta.taxaGeral90}%) · Âmbar: acima da média · Vermelho: 2× a média
          </p>
        </GlassCard>

        <GlassCard>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h3 className="text-sm font-semibold text-zinc-300">Inspetores — volume e taxa de reprovação (180 dias)</h3>
            <div className="flex items-center gap-2">
              <select
                value={obraInspetores}
                onChange={e => setObraInspetores(e.target.value)}
                className="h-8 px-2 text-[11px] rounded-lg bg-zinc-900 border border-white/10 text-zinc-300 focus:outline-none cursor-pointer"
              >
                <option value="">Empreendimento: todos</option>
                {data.filterOptions.obras.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-zinc-900 px-2 h-8">
                <Search size={11} className="text-zinc-600" />
                <input
                  value={inspetorSearch}
                  onChange={e => setInspetorSearch(e.target.value)}
                  placeholder="Buscar…"
                  className="bg-transparent text-[11px] text-zinc-300 outline-none placeholder:text-zinc-600 w-24"
                />
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#1C1C1E]">
                  {['Inspetor', 'Verificações', 'Reprovadas', 'Taxa'].map(h => (
                    <th key={h} className="text-left py-2 px-3 text-zinc-500 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rankingInspetores
                  .filter(i => !inspetorSearch.trim() || i.inspetor.toLowerCase().includes(inspetorSearch.trim().toLowerCase()))
                  .map((i, idx) => (
                    <tr
                      key={idx}
                      onClick={() => router.push(`/quality-vision/inspecoes?inspetor=${encodeURIComponent(i.inspetor)}`)}
                      className="border-b border-[#1C1C1E] hover:bg-[#17171A] transition cursor-pointer"
                    >
                      <td className="py-2.5 px-3 text-zinc-300">{i.inspetor}</td>
                      <td className="py-2.5 px-3 text-zinc-400">{i.verificacoes.toLocaleString('pt-BR')}</td>
                      <td className="py-2.5 px-3 text-zinc-400">{i.reprovadas.toLocaleString('pt-BR')}</td>
                      <td className={`py-2.5 px-3 font-semibold ${i.taxaReprovacao > data.meta.taxaGeral90 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {i.taxaReprovacao}%
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>

      {/* Itens sistêmicos com solução recomendada */}
      <GlassCard>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <h3 className="text-sm font-semibold text-zinc-300">Falhas recorrentes e soluções recomendadas — últimos 180 dias</h3>
          <div className="flex items-center gap-2">
            <select
              value={obraItens}
              onChange={e => setObraItens(e.target.value)}
              className="h-8 px-2 text-[11px] rounded-lg bg-zinc-900 border border-white/10 text-zinc-300 focus:outline-none cursor-pointer"
            >
              <option value="">Empreendimento: todos</option>
              {data.filterOptions.obras.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <select
              value={inspetorItens}
              onChange={e => setInspetorItens(e.target.value)}
              className="h-8 px-2 text-[11px] rounded-lg bg-zinc-900 border border-white/10 text-zinc-300 focus:outline-none cursor-pointer"
            >
              <option value="">Inspetor: todos</option>
              {data.filterOptions.inspetores.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
        </div>
        <p className="text-[11px] text-zinc-500 mb-4">
          Itens de verificação que mais reprovam. A solução recomendada é a mais registrada pelos próprios inspetores em campo para o item. Clique numa linha pra ver as ocorrências.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#1C1C1E]">
                {['Item de verificação', 'Modelo', 'Reprovações', 'Obras', 'Solução recomendada'].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-zinc-500 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {itensSistemicos.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-zinc-600">Nenhuma reprovação recorrente no período 🎉</td></tr>
              ) : (
                itensSistemicos.map((item, i) => (
                  <tr
                    key={i}
                    onClick={() => setSelectedItem({ verificacao: item.verificacao, modelo: item.modelo })}
                    className="border-b border-[#1C1C1E] hover:bg-[#17171A] transition align-top cursor-pointer"
                  >
                    <td className="py-2.5 px-3 text-zinc-300 max-w-[280px]">{item.verificacao}</td>
                    <td className="py-2.5 px-3 text-zinc-500 whitespace-nowrap">{item.modelo}</td>
                    <td className="py-2.5 px-3">
                      <span className={`font-semibold ${item.reprovacoes >= 10 ? 'text-rose-400' : 'text-amber-400'}`}>{item.reprovacoes}</span>
                    </td>
                    <td className="py-2.5 px-3 text-zinc-400">{item.obras}</td>
                    <td className="py-2.5 px-3 text-zinc-400 max-w-[320px]">
                      {item.solucaoRecomendada ? (
                        <span className="flex items-start gap-1.5">
                          <Lightbulb size={12} className="text-amber-300 mt-0.5 shrink-0" />
                          <span>{item.solucaoRecomendada}</span>
                        </span>
                      ) : <span className="text-zinc-600">—</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
      
      </div>

      <p className="text-[10px] text-zinc-600 text-right">
        Análise gerada em {new Date(data.meta.geradoEm).toLocaleString('pt-BR')} · dados Construpoint D-1
      </p>

      <ItemDetailModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onOpenInspecao={setSelectedInspId}
      />
      <InspecaoDetailModal id={selectedInspId} onClose={() => setSelectedInspId(null)} />
    </div>
  )
}
