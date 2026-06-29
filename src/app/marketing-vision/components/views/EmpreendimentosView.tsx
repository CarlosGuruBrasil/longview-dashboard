'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Building2, X, Upload, Download, Trash2, Loader2, Camera,
  CheckSquare, Clock, FileText, BarChart3, DollarSign, Home, Map as MapIcon,
} from 'lucide-react'
import { useData } from '../../context/DataContext'
import { useUser } from '@/context/UserContext'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Unidade {
  id: number; bloco: string; numero: string; status: string; status_venda: number;
  valor: number; metragem: number; andar: number | null; coluna: number | null;
  tipologia: string | null; raw: Record<string, unknown>;
}
interface Venda   { id: number; id_unidade: number; valor: number; data_venda: string; status: string; }
interface Material{ id: string; nome: string; tipo: string; content_type?: string; size_bytes?: number | null; uploaded_by?: string; created_at?: string; downloadUrl: string; fonte: 'cvcrm' | 'manual'; }
interface EmpDetail {
  empreendimento: {
    id: number; nome: string; situacao: string; tipo: string;
    imageUrl: string | null; tabela: unknown; linkDisponibilidade: string | null;
    andamento: number | null; dataEntrega: string | null; segmento: string | null;
    situacaoObra: string | null; foto: string | null; logo: string | null;
    endereco: string | null; bairro: string | null; cidade: string | null;
    estado: string | null; latitude: string | null; longitude: string | null;
    raw: Record<string, unknown>;
  };
  unidades: Unidade[];
  vendas: Venda[];
  cvMateriais: Material[];
  materiais: Material[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const BRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0)
const fmtDate = (s?: string | null) => { if (!s) return '—'; try { return new Date(s).toLocaleDateString('pt-BR') } catch { return s } }
const fmtSize = (b?: number | null) => { if (!b) return ''; if (b < 1024) return `${b} B`; if (b < 1048576) return `${(b/1024).toFixed(1)} KB`; return `${(b/1048576).toFixed(1)} MB` }

const TIPOS_MATERIAL = [
  { value: 'tabela',   label: 'Tabela de Preços' },
  { value: 'ebook',    label: 'E-book / Book'    },
  { value: 'planta',   label: 'Planta'            },
  { value: 'campanha', label: 'Material de Campanha' },
  { value: 'memorial', label: 'Memorial Descritivo' },
  { value: 'video',    label: 'Vídeo'             },
  { value: 'outro',    label: 'Outro'             },
]

const STATUS_STYLE: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  Disponivel: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-300', dot: 'bg-emerald-400' },
  Reservado:  { bg: 'bg-amber-500/15',   border: 'border-amber-500/30',   text: 'text-amber-300',   dot: 'bg-amber-400'   },
  Vendido:    { bg: 'bg-sky-500/15',     border: 'border-sky-500/30',     text: 'text-sky-300',     dot: 'bg-sky-400'     },
}

function StatusBar({ disp, res, vend, total }: { disp: number; res: number; vend: number; total: number }) {
  const t = total || 1
  return (
    <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
      <div style={{ width: `${(disp/t)*100}%`, background: '#10b981' }} className="min-w-0 transition-all" />
      <div style={{ width: `${(res /t)*100}%`, background: '#f59e0b' }} className="min-w-0 transition-all" />
      <div style={{ width: `${(vend/t)*100}%`, background: '#0ea5e9' }} className="min-w-0 transition-all" />
    </div>
  )
}

// ── Mapa de Disponibilidade ───────────────────────────────────────────────────

function MapaDisponibilidade({ unidades }: { unidades: Unidade[] }) {
  const [tooltip, setTooltip] = useState<{ unit: Unidade; x: number; y: number } | null>(null)

  // Agrupar por andar e coluna
  const hasGrid = unidades.some(u => u.andar !== null && u.coluna !== null)

  if (!hasGrid) {
    // Fallback: grade por bloco × número
    const blocos = [...new Set(unidades.map(u => u.bloco).filter(Boolean))].sort()
    if (!blocos.length) return (
      <p className="text-xs text-zinc-600 py-6 text-center">Dados de posição não disponíveis para este empreendimento.</p>
    )
    return (
      <div className="space-y-4">
        {blocos.map(bloco => {
          const unis = unidades.filter(u => u.bloco === bloco).sort((a,b) => (a.numero||'').localeCompare(b.numero||'', 'pt-BR', { numeric: true }))
          return (
            <div key={bloco}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-2">{bloco || 'Sem Bloco'}</p>
              <div className="flex flex-wrap gap-1.5">
                {unis.map(u => {
                  const st = STATUS_STYLE[u.status] || { bg: 'bg-zinc-800', border: 'border-zinc-700', text: 'text-zinc-400', dot: 'bg-zinc-600' }
                  return (
                    <div key={u.id} title={`${u.numero} — ${u.status === 'Disponivel' ? 'Disponível' : u.status}${u.valor ? ` — ${BRL(u.valor)}` : ''}${u.tipologia ? ` — ${u.tipologia}` : ''}`}
                      className={`w-10 h-10 rounded-lg border flex items-center justify-center text-[10px] font-bold cursor-pointer hover:scale-110 transition-transform ${st.bg} ${st.border} ${st.text}`}>
                      {(u.numero||'').replace(/\D/g,'').slice(-3) || u.numero?.slice(0,3) || '?'}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
        <div className="flex items-center gap-4 pt-2">
          {[['Disponível','bg-emerald-400'],['Reservado','bg-amber-400'],['Vendido','bg-sky-400']].map(([l,c]) => (
            <div key={l} className="flex items-center gap-1.5"><div className={`w-2.5 h-2.5 rounded-full ${c}`}/><span className="text-[11px] text-zinc-500">{l}</span></div>
          ))}
        </div>
      </div>
    )
  }

  // Grid por andar (Y) × coluna (X)
  const andares  = Array.from(new Set<number>(unidades.filter(u => u.andar  !== null).map(u => u.andar  as number))).sort((a,b) => b - a)
  const colunas  = Array.from(new Set<number>(unidades.filter(u => u.coluna !== null).map(u => u.coluna as number))).sort((a,b) => a - b)
  const gridObj: Record<string, Unidade> = {}
  unidades.filter(u => u.andar && u.coluna).forEach(u => { gridObj[`${u.andar}-${u.coluna}`] = u })

  return (
    <div className="relative">
      <div className="overflow-x-auto">
        <table className="border-collapse mx-auto">
          <thead>
            <tr>
              <th className="w-8 text-[10px] text-zinc-600 font-normal pr-2">Andar</th>
              {colunas.map(c => (
                <th key={c} className="text-[10px] text-zinc-600 font-normal px-0.5 pb-1 w-9 text-center">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {andares.map(andar => (
              <tr key={andar}>
                <td className="text-[10px] text-zinc-500 font-mono pr-2 text-right whitespace-nowrap">{andar}º</td>
                {colunas.map(col => {
                  const u = gridObj[`${andar}-${col}`]
                  if (!u) return <td key={col} className="p-0.5"><div className="w-9 h-8" /></td>
                  const st = STATUS_STYLE[u.status] || { bg: 'bg-zinc-800', border: 'border-zinc-700', text: 'text-zinc-400', dot: 'bg-zinc-600' }
                  return (
                    <td key={col} className="p-0.5">
                      <div
                        onMouseEnter={e => setTooltip({ unit: u, x: e.clientX, y: e.clientY })}
                        onMouseLeave={() => setTooltip(null)}
                        className={`w-9 h-8 rounded border flex items-center justify-center text-[9px] font-bold cursor-pointer hover:scale-110 transition-transform select-none ${st.bg} ${st.border} ${st.text}`}
                      >
                        {(u.numero||'').slice(-3) || '?'}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div className="fixed z-[200] pointer-events-none bg-[#1a1a1f] border border-[#2E2E34] rounded-xl p-2.5 shadow-2xl text-xs"
          style={{ left: tooltip.x + 12, top: tooltip.y - 60 }}>
          <p className="font-bold text-white">{tooltip.unit.numero}</p>
          {tooltip.unit.tipologia && <p className="text-zinc-400">{tooltip.unit.tipologia}</p>}
          {tooltip.unit.metragem  && <p className="text-zinc-400">{tooltip.unit.metragem} m²</p>}
          {tooltip.unit.valor     && <p className="text-emerald-400 font-semibold">{BRL(tooltip.unit.valor)}</p>}
          <p className={`mt-0.5 font-semibold ${STATUS_STYLE[tooltip.unit.status]?.text || 'text-zinc-400'}`}>
            {tooltip.unit.status === 'Disponivel' ? 'Disponível' : tooltip.unit.status}
          </p>
        </div>
      )}

      {/* Legenda */}
      <div className="flex items-center gap-4 pt-3 justify-center">
        {[['Disponível','bg-emerald-400'],['Reservado','bg-amber-400'],['Vendido','bg-sky-400']].map(([l,c]) => (
          <div key={l} className="flex items-center gap-1.5"><div className={`w-2.5 h-2.5 rounded-full ${c}`}/><span className="text-[11px] text-zinc-500">{l}</span></div>
        ))}
      </div>
    </div>
  )
}

// ── Painel de detalhe ─────────────────────────────────────────────────────────

type Tab = 'resumo' | 'mapa' | 'unidades' | 'vendas' | 'materiais'

function DetailPanel({ empId, dateRange, onClose, isAdmin }: {
  empId: number; dateRange: { start: string; end: string }; onClose: () => void; isAdmin: boolean;
}) {
  const [data,    setData]    = useState<EmpDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState<Tab>('resumo')
  const [unitFilter, setUnitFilter] = useState<'all'|'Disponivel'|'Reservado'|'Vendido'>('all')
  const [uploading, setUploading] = useState(false)
  const [matTipo,   setMatTipo]   = useState('outro')
  const [matNome,   setMatNome]   = useState('')
  const [imgTs,     setImgTs]     = useState(Date.now())
  const fileRef  = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/empreendimentos/${empId}`)
      .then(r => r.json()).then(setData).catch(console.error).finally(() => setLoading(false))
  }, [empId])

  const refreshMateriais = () =>
    fetch(`/api/empreendimentos/${empId}/materiais`).then(r => r.json())
      .then(d => setData(p => p ? { ...p, materiais: d.materiais.map((m: Material) => ({ ...m, fonte: 'manual' as const })) } : p))
      .catch(console.error)

  const uploadMaterial = async (file: File) => {
    setUploading(true)
    const form = new FormData(); form.append('file', file); form.append('tipo', matTipo); form.append('nome', matNome || file.name)
    const res = await fetch(`/api/empreendimentos/${empId}/materiais`, { method: 'POST', body: form })
    if (!res.ok) alert((await res.json()).error || 'Erro ao enviar')
    else { setMatNome(''); refreshMateriais() }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const deleteMaterial = async (matId: string) => {
    if (!confirm('Remover este material?')) return
    await fetch(`/api/empreendimentos/${empId}/materiais/${matId}`, { method: 'DELETE' })
    refreshMateriais()
  }

  const uploadImage = async (file: File) => {
    const form = new FormData(); form.append('file', file)
    await fetch(`/api/empreendimentos/${empId}/image`, { method: 'POST', body: form })
    setImgTs(Date.now())
    setData(p => p ? { ...p, empreendimento: { ...p.empreendimento, imageUrl: `/api/empreendimentos/${empId}/image` } } : p)
  }

  const vendasFiltradas = useMemo(() => {
    if (!data?.vendas) return []
    if (!dateRange.start && !dateRange.end) return data.vendas
    return data.vendas.filter(v => {
      if (!v.data_venda) return false
      const d = v.data_venda.slice(0, 10)
      if (dateRange.start && d < dateRange.start) return false
      if (dateRange.end   && d > dateRange.end)   return false
      return true
    })
  }, [data?.vendas, dateRange])

  const unidadesFiltradas = useMemo(() => {
    if (!data?.unidades) return []
    return unitFilter === 'all' ? data.unidades : data.unidades.filter(u => u.status === unitFilter)
  }, [data?.unidades, unitFilter])

  // Todos os materiais juntos (CV CRM + manuais)
  const todosMateriais = useMemo(() => {
    if (!data) return []
    return [...(data.cvMateriais || []), ...(data.materiais || [])]
  }, [data])

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'resumo',    label: 'Resumo',     icon: BarChart3  },
    { key: 'mapa',      label: 'Mapa',       icon: MapIcon    },
    { key: 'unidades',  label: 'Unidades',   icon: Home       },
    { key: 'vendas',    label: 'Vendas',     icon: DollarSign },
    { key: 'materiais', label: 'Materiais',  icon: FileText   },
  ]

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-3xl bg-[#09090b] border-l border-[#1C1C1E] z-50 flex flex-col shadow-2xl">

        {/* Header com imagem */}
        <div className="relative h-44 shrink-0 bg-[#0E0E10]">
          {data?.empreendimento.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`${data.empreendimento.imageUrl}${data.empreendimento.imageUrl.includes('?') ? '&' : '?'}t=${imgTs}`}
              alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Building2 size={40} className="text-zinc-700" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
          <div className="absolute top-3 right-3 flex gap-2">
            {isAdmin && (
              <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/60 text-white text-xs cursor-pointer hover:bg-black/80 border border-white/10 backdrop-blur-sm">
                <Camera size={12} /> Trocar foto
                <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f) }} />
              </label>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 border border-white/10 backdrop-blur-sm text-white"><X size={15} /></button>
          </div>
          {data && (
            <div className="absolute bottom-3 left-4 right-20">
              <h2 className="text-lg font-bold text-white leading-tight truncate">{data.empreendimento.nome}</h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {data.empreendimento.situacao    && <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/15 text-white border border-white/20">{data.empreendimento.situacao}</span>}
                {data.empreendimento.situacaoObra && <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-zinc-300">{data.empreendimento.situacaoObra}</span>}
                {data.empreendimento.andamento !== null && <span className="text-[10px] text-zinc-400">{data.empreendimento.andamento}% concluído</span>}
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 py-2 border-b border-[#1C1C1E] shrink-0 overflow-x-auto scrollbar-none">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${tab===key ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
              <Icon size={12} /> {label}
              {key==='unidades'  && data && <span className="ml-0.5 text-[10px] text-zinc-600">{data.unidades.length}</span>}
              {key==='vendas'    && data && <span className="ml-0.5 text-[10px] text-zinc-600">{data.vendas.length}</span>}
              {key==='materiais' && data && <span className="ml-0.5 text-[10px] text-zinc-600">{todosMateriais.length}</span>}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-40 gap-3 text-zinc-500"><Loader2 size={18} className="animate-spin" /><span className="text-sm">Carregando...</span></div>
          ) : !data ? (
            <p className="text-center text-zinc-500 py-10 text-sm">Erro ao carregar dados.</p>
          ) : (
            <>
              {/* ── RESUMO ── */}
              {tab === 'resumo' && (() => {
                const u = data.unidades
                const disp = u.filter(x => x.status==='Disponivel').length
                const res  = u.filter(x => x.status==='Reservado').length
                const vend = u.filter(x => x.status==='Vendido').length
                const vgvDisp    = u.filter(x => x.status==='Disponivel').reduce((s,x) => s+(x.valor||0), 0)
                const vgvVendRes = u.filter(x => x.status!=='Disponivel').reduce((s,x) => s+(x.valor||0), 0)
                const totalVendas = data.vendas.reduce((s,v) => s+(v.valor||0), 0)
                const tabela = data.empreendimento.tabela as Record<string,unknown> | null
                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {([['Disponíveis',disp,'text-emerald-400'],['Reservadas',res,'text-amber-400'],['Vendidas',vend,'text-sky-400'],['Total',u.length,'text-zinc-200']] as [string,number,string][]).map(([l,v,c]) => (
                        <div key={l} className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-3 text-center">
                          <p className={`text-xl font-bold ${c}`}>{v}</p><p className="text-[11px] text-zinc-500 mt-0.5">{l}</p>
                        </div>
                      ))}
                    </div>
                    {u.length > 0 && <StatusBar disp={disp} res={res} vend={vend} total={u.length} />}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {([['VGV Disponível',vgvDisp,'text-emerald-400'],['VGV Vendido+Res.',vgvVendRes,'text-sky-400'],['Total Vendas',totalVendas,'text-white']] as [string,number,string][]).map(([l,v,c]) => (
                        <div key={l} className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-3">
                          <p className="text-[11px] text-zinc-500">{l}</p><p className={`text-sm font-bold ${c} mt-0.5`}>{BRL(v)}</p>
                        </div>
                      ))}
                    </div>
                    {/* Informações */}
                    <div className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-3 space-y-1.5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Informações</p>
                      {([
                        ['Endereço', [data.empreendimento.endereco, data.empreendimento.bairro, data.empreendimento.cidade, data.empreendimento.estado].filter(Boolean).join(', ')],
                        ['Entrega',  data.empreendimento.dataEntrega],
                        ['Segmento', data.empreendimento.segmento],
                        ['Obras',    data.empreendimento.situacaoObra],
                        ['Andamento',data.empreendimento.andamento !== null ? `${data.empreendimento.andamento}% concluído` : null],
                      ] as [string, string | null][]).filter(([,v]) => v).map(([k,v]) => (
                        <div key={k} className="flex items-start justify-between gap-4 text-xs">
                          <span className="text-zinc-500 shrink-0">{k}</span>
                          <span className="text-zinc-300 text-right">{v}</span>
                        </div>
                      ))}
                    </div>
                    {/* Tabela de preços do CV CRM */}
                    {tabela && (
                      <div className="bg-[#121214]/60 border border-emerald-500/20 rounded-xl p-3">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-500 mb-2">Tabela de Preços Vigente</p>
                        <p className="text-sm font-semibold text-white">{tabela.nome as string}</p>
                        <p className="text-xs text-zinc-400 mt-1">{tabela.tipo as string} · Vigência: {fmtDate(tabela.data_vigencia_de as string)} → {fmtDate(tabela.data_vigencia_ate as string)}</p>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* ── MAPA ── */}
              {tab === 'mapa' && (
                <div className="space-y-4">
                  <p className="text-xs text-zinc-500">Passe o mouse sobre uma unidade para ver detalhes. Clique na legenda para filtrar.</p>
                  <MapaDisponibilidade unidades={data.unidades} />
                  {data.empreendimento.linkDisponibilidade && (
                    <a href={data.empreendimento.linkDisponibilidade} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-sky-400 hover:text-sky-300 underline">
                      <MapIcon size={12} /> Ver mapa de disponibilidade no CV CRM ↗
                    </a>
                  )}
                </div>
              )}

              {/* ── UNIDADES ── */}
              {tab === 'unidades' && (
                <div className="space-y-3">
                  <div className="flex gap-2 flex-wrap">
                    {(['all','Disponivel','Reservado','Vendido'] as const).map(s => (
                      <button key={s} onClick={() => setUnitFilter(s)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${unitFilter===s ? 'bg-white/10 text-white border-white/20' : 'text-zinc-500 border-[#1E1E22] hover:text-zinc-300'}`}>
                        {s==='all'?`Todas (${data.unidades.length})`:s==='Disponivel'?`Disponíveis (${data.unidades.filter(u=>u.status===s).length})`:s==='Reservado'?`Reservadas (${data.unidades.filter(u=>u.status===s).length})`:`Vendidas (${data.unidades.filter(u=>u.status===s).length})`}
                      </button>
                    ))}
                  </div>
                  {unidadesFiltradas.length === 0 ? (
                    <p className="text-xs text-zinc-600 py-6 text-center">Nenhuma unidade encontrada.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-[#1E1E22]">
                      <table className="w-full text-left">
                        <thead className="bg-[#0E0E10] text-[11px] uppercase font-bold text-zinc-500 tracking-wider">
                          <tr>{['Unidade','Tipologia','Andar','Área','Valor','Status'].map(h=><th key={h} className="py-2.5 px-3 whitespace-nowrap">{h}</th>)}</tr>
                        </thead>
                        <tbody className="divide-y divide-[#1C1C1E]">
                          {unidadesFiltradas.map(u => (
                            <tr key={u.id} className="hover:bg-[#17171A] transition-colors">
                              <td className="py-2.5 px-3 text-xs font-medium text-white whitespace-nowrap">{u.numero||'—'}</td>
                              <td className="py-2.5 px-3 text-xs text-zinc-400 whitespace-nowrap">{u.tipologia||u.bloco||'—'}</td>
                              <td className="py-2.5 px-3 text-xs text-zinc-400 whitespace-nowrap">{u.andar ? `${u.andar}º` : '—'}</td>
                              <td className="py-2.5 px-3 text-xs text-zinc-400 whitespace-nowrap">{u.metragem ? `${u.metragem} m²` : '—'}</td>
                              <td className="py-2.5 px-3 text-xs font-mono text-zinc-200 whitespace-nowrap">{u.valor ? BRL(u.valor) : '—'}</td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span className={`text-[11px] px-2 py-0.5 rounded-full border ${STATUS_STYLE[u.status]?.bg||'bg-zinc-800'} ${STATUS_STYLE[u.status]?.border||'border-zinc-700'} ${STATUS_STYLE[u.status]?.text||'text-zinc-400'}`}>
                                  {u.status==='Disponivel'?'Disponível':u.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── VENDAS ── */}
              {tab === 'vendas' && (
                <div className="space-y-4">
                  <div className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-3">
                    <p className="text-[11px] text-zinc-500 mb-2">{dateRange.start||dateRange.end?`Período: ${dateRange.start||'—'} → ${dateRange.end||'—'}`:'Todas as vendas'}</p>
                    <div className="flex items-center gap-6">
                      <div><p className="text-xl font-bold text-white">{vendasFiltradas.length}</p><p className="text-[11px] text-zinc-500">vendas</p></div>
                      <div><p className="text-xl font-bold text-emerald-400">{BRL(vendasFiltradas.reduce((s,v)=>s+(v.valor||0),0))}</p><p className="text-[11px] text-zinc-500">VGV realizado</p></div>
                    </div>
                  </div>
                  {data.vendas.length !== vendasFiltradas.length && (
                    <div className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-3">
                      <p className="text-[11px] text-zinc-500 mb-2">Total histórico</p>
                      <div className="flex gap-6">
                        <div><p className="text-lg font-bold text-zinc-300">{data.vendas.length}</p><p className="text-[11px] text-zinc-500">vendas</p></div>
                        <div><p className="text-lg font-bold text-zinc-300">{BRL(data.vendas.reduce((s,v)=>s+(v.valor||0),0))}</p><p className="text-[11px] text-zinc-500">VGV total</p></div>
                      </div>
                    </div>
                  )}
                  {data.vendas.length===0 ? (
                    <p className="text-xs text-zinc-600 py-6 text-center">Nenhuma venda registrada.</p>
                  ) : (
                    <div className="space-y-2">
                      {data.vendas.map(v => {
                        const inP = vendasFiltradas.some(vf=>vf.id===v.id)
                        return (
                          <div key={v.id} className={`flex items-center gap-3 p-3 rounded-xl border ${inP?'border-emerald-500/20 bg-emerald-500/5':'border-[#1E1E22] bg-[#121214]/40 opacity-50'}`}>
                            <DollarSign size={14} className={inP?'text-emerald-400':'text-zinc-600'} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-white">Unidade #{v.id_unidade||'—'}</p>
                              <p className="text-[11px] text-zinc-500 mt-0.5">{fmtDate(v.data_venda)} · {v.status||'—'}</p>
                            </div>
                            <p className={`text-sm font-bold whitespace-nowrap ${inP?'text-emerald-400':'text-zinc-400'}`}>{BRL(v.valor)}</p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── MATERIAIS ── */}
              {tab === 'materiais' && (
                <div className="space-y-4">
                  {/* Checklist */}
                  <div className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-3 space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Checklist</p>
                    {TIPOS_MATERIAL.map(t => {
                      const ok = todosMateriais.some(m => m.tipo === t.value)
                      return (
                        <div key={t.value} className="flex items-center gap-2 text-xs">
                          {ok ? <CheckSquare size={13} className="text-emerald-400 shrink-0" /> : <Clock size={13} className="text-zinc-600 shrink-0" />}
                          <span className={ok?'text-zinc-300':'text-zinc-600'}>{t.label}</span>
                          {ok && <span className="ml-auto text-[10px] text-emerald-500">{todosMateriais.filter(m=>m.tipo===t.value).length}</span>}
                        </div>
                      )
                    })}
                  </div>

                  {/* Upload manual */}
                  {isAdmin && (
                    <div className="border border-dashed border-[#2E2E34] rounded-xl p-4 space-y-3">
                      <p className="text-xs font-semibold text-zinc-400">Adicionar material manualmente</p>
                      <div className="grid grid-cols-2 gap-2">
                        <select value={matTipo} onChange={e=>setMatTipo(e.target.value)} className="bg-[#1a1a1f] border border-[#2E2E34] rounded-lg px-3 py-2 text-xs text-white focus:outline-none">
                          {TIPOS_MATERIAL.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        <input value={matNome} onChange={e=>setMatNome(e.target.value)} placeholder="Nome (opcional)" className="bg-[#1a1a1f] border border-[#2E2E34] rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
                      </div>
                      <button onClick={()=>fileRef.current?.click()} disabled={uploading}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#1a1a1f] border border-[#2E2E34] rounded-lg text-xs text-zinc-300 hover:bg-[#222228] disabled:opacity-50">
                        {uploading?<Loader2 size={13} className="animate-spin"/>:<Upload size={13}/>}
                        {uploading?'Enviando...':'Escolher arquivo (máx 100 MB)'}
                      </button>
                      <input ref={fileRef} type="file" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)uploadMaterial(f)}} />
                    </div>
                  )}

                  {/* Lista de todos os materiais */}
                  {todosMateriais.length === 0 ? (
                    <p className="text-xs text-zinc-600 py-4 text-center">Nenhum material disponível.</p>
                  ) : (
                    <div className="space-y-2">
                      {/* Seção CV CRM */}
                      {(data.cvMateriais||[]).length > 0 && (
                        <>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Do CV CRM</p>
                          {(data.cvMateriais||[]).map(m => (
                            <div key={m.id} className="flex items-center gap-3 p-3 bg-[#121214]/60 border border-[#1E1E22] rounded-xl">
                              {m.tipo === 'planta' || (m.content_type||'').startsWith('image/')
                                // eslint-disable-next-line @next/next/no-img-element
                                ? <img src={m.downloadUrl} alt={m.nome} className="w-12 h-10 object-cover rounded-lg border border-[#1E1E22] shrink-0" />
                                : <FileText size={14} className="text-zinc-500 shrink-0" />}
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-zinc-200 truncate">{m.nome}</p>
                                <p className="text-[10px] text-zinc-500 mt-0.5">{TIPOS_MATERIAL.find(t=>t.value===m.tipo)?.label||m.tipo}{m.size_bytes?` · ${fmtSize(m.size_bytes)}`:''}</p>
                              </div>
                              <a href={m.downloadUrl} target="_blank" rel="noopener noreferrer"
                                className="p-1.5 hover:bg-white/5 text-zinc-500 hover:text-white rounded-lg shrink-0">
                                <Download size={13} />
                              </a>
                            </div>
                          ))}
                        </>
                      )}
                      {/* Seção manuais */}
                      {(data.materiais||[]).length > 0 && (
                        <>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mt-3">Adicionados manualmente</p>
                          {(data.materiais||[]).map(m => (
                            <div key={m.id} className="flex items-center gap-3 p-3 bg-[#121214]/60 border border-[#1E1E22] rounded-xl">
                              <FileText size={14} className="text-zinc-500 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-zinc-200 truncate">{m.nome}</p>
                                <p className="text-[10px] text-zinc-500 mt-0.5">{TIPOS_MATERIAL.find(t=>t.value===m.tipo)?.label||m.tipo}{m.size_bytes?` · ${fmtSize(m.size_bytes)}`:''}{m.uploaded_by?` · ${m.uploaded_by}`:''}</p>
                              </div>
                              <a href={m.downloadUrl} download={m.nome} className="p-1.5 hover:bg-white/5 text-zinc-500 hover:text-white rounded-lg shrink-0"><Download size={13} /></a>
                              {isAdmin && <button onClick={()=>deleteMaterial(m.id)} className="p-1.5 hover:bg-red-500/10 text-zinc-600 hover:text-red-400 rounded-lg shrink-0"><Trash2 size={13} /></button>}
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

// ── View principal ────────────────────────────────────────────────────────────

export default function EmpreendimentosView() {
  const { estoque, filteredLeads, dateRange } = useData()
  const { currentUser } = useUser()
  const isAdmin = currentUser.role === 'Desenvolvedor' || currentUser.role === 'Diretoria' || !!currentUser.permissions?.isAdmin
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [imgTs] = useState(Date.now())

  const empreendimentos = Array.isArray(estoque?.empreendimentos) ? estoque.empreendimentos : []
  const resumo          = Array.isArray(estoque?.resumo)          ? estoque.resumo          : []

  const leadCountByProject = useMemo(() => {
    const map: Record<string, number> = {}
    for (const lead of filteredLeads) {
      for (const emp of ((lead.empreendimento ?? []) as { nome?: string }[])) {
        if (emp.nome) map[emp.nome] = (map[emp.nome] ?? 0) + 1
      }
    }
    return map as Record<string, number>
  }, [filteredLeads])

  if (empreendimentos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-zinc-600">
        <Building2 size={40} className="opacity-30" />
        <p className="text-sm font-semibold text-zinc-400">Nenhum empreendimento</p>
        <p className="text-xs text-center max-w-xs">Sincroniza às 3h e 15h automaticamente.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {empreendimentos.map((emp: { id: number; nome: string; situacao: string; tipo: string; raw?: Record<string, unknown> }) => {
          const stats = (resumo.find((r: { id_empreendimento: number }) => r.id_empreendimento === emp.id) || { total:0,disponivel:0,reservado:0,vendido:0,vgv_disponivel:0,vgv_vendido:0 }) as { total:number;disponivel:number;reservado:number;vendido:number;vgv_disponivel:number;vgv_vendido:number }
          const leads = (leadCountByProject as Record<string, number>)[emp.nome] ?? 0
          const fotoUrl = (emp.raw?.foto as string) || null

          return (
            <div key={emp.id} onClick={() => setSelectedId(emp.id)}
              className="group bg-[#121214]/60 border border-[#1E1E22] rounded-2xl overflow-hidden cursor-pointer hover:border-zinc-700 transition-all shadow-lg hover:shadow-xl">
              <div className="relative h-44 bg-[#0E0E10]">
                {fotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/empreendimentos/${emp.id}/image?t=${imgTs}`}
                    alt="" className="w-full h-full object-cover"
                    onError={e => {
                      const img = e.target as HTMLImageElement
                      if (!img.dataset.fallback) { img.dataset.fallback = '1'; img.src = fotoUrl }
                    }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Building2 size={32} className="text-zinc-700" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
                <div className="absolute bottom-3 left-3 right-3">
                  <p className="text-sm font-bold text-white leading-tight truncate">{emp.nome}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {emp.situacao && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white">{emp.situacao}</span>}
                    {(emp.raw?.andamento as number | undefined) ? <span className="text-[10px] text-zinc-300">{emp.raw!.andamento as number}% obra</span> : null}
                  </div>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <StatusBar disp={stats.disponivel} res={stats.reservado} vend={stats.vendido} total={stats.total} />
                <div className="grid grid-cols-3 gap-2 text-center">
                  {([['Disp.',stats.disponivel,'text-emerald-400'],['Res.',stats.reservado,'text-amber-400'],['Vend.',stats.vendido,'text-sky-400']] as [string,number,string][]).map(([l,v,c]) => (
                    <div key={l}><p className={`text-base font-bold ${c}`}>{v}</p><p className="text-[10px] text-zinc-500">{l}</p></div>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-[#1E1E22]">
                  <div>
                    <p className="text-[10px] text-zinc-500">VGV Disponível</p>
                    <p className="text-xs font-semibold text-emerald-400">{BRL(stats.vgv_disponivel)}</p>
                  </div>
                  {leads > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">{leads} lead{leads!==1?'s':''}</span>}
                  <p className="text-[10px] text-zinc-500 font-mono">{stats.total} un.</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {selectedId !== null && (
        <DetailPanel empId={selectedId} dateRange={dateRange} onClose={() => setSelectedId(null)} isAdmin={isAdmin} />
      )}
    </div>
  )
}
