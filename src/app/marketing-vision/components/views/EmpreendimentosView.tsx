'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Building2, X, Upload, Download, Trash2, Loader2, Camera,
  CheckSquare, Clock, FileText, BarChart3, DollarSign, Home,
} from 'lucide-react'
import { useData } from '../../context/DataContext'
import { useUser } from '@/context/UserContext'

interface Unidade { id: number; bloco: string; numero: string; status: string; status_venda: number; valor: number; metragem: number; raw: Record<string, unknown>; }
interface Venda   { id: number; id_unidade: number; valor: number; data_venda: string; status: string; raw: Record<string, unknown>; }
interface Material{ id: string; nome: string; tipo: string; content_type: string; size_bytes: number; uploaded_by: string; created_at: string; downloadUrl: string; }
interface EmpDetail { empreendimento: { id: number; nome: string; situacao: string; tipo: string; raw: Record<string, unknown>; imageUrl: string | null }; unidades: Unidade[]; vendas: Venda[]; materiais: Material[]; }

const BRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0)
const fmtDate = (s?: string | null) => s ? new Date(s).toLocaleDateString('pt-BR') : '—'
const fmtSize = (b?: number | null) => { if (!b) return ''; if (b < 1024) return `${b} B`; if (b < 1048576) return `${(b/1024).toFixed(1)} KB`; return `${(b/1048576).toFixed(1)} MB` }

const TIPOS_MATERIAL = [
  { value: 'tabela',   label: 'Tabela de Preços' },
  { value: 'ebook',    label: 'E-book / Book'    },
  { value: 'planta',   label: 'Planta'            },
  { value: 'memorial', label: 'Memorial Descritivo' },
  { value: 'video',    label: 'Vídeo'             },
  { value: 'foto',     label: 'Foto'              },
  { value: 'outro',    label: 'Outro'             },
]
const STATUS_COLOR: Record<string, string> = {
  Disponivel: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  Reservado:  'text-amber-400  bg-amber-500/10  border-amber-500/20',
  Vendido:    'text-sky-400    bg-sky-500/10    border-sky-500/20',
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

type Tab = 'resumo' | 'unidades' | 'vendas' | 'materiais'

function DetailPanel({ empId, dateRange, onClose, isAdmin }: { empId: number; dateRange: { start: string; end: string }; onClose: () => void; isAdmin: boolean }) {
  const [data, setData]       = useState<EmpDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState<Tab>('resumo')
  const [unitFilter, setUnitFilter] = useState<'all'|'Disponivel'|'Reservado'|'Vendido'>('all')
  const [uploading, setUploading]   = useState(false)
  const [matTipo, setMatTipo]       = useState('tabela')
  const [matNome, setMatNome]       = useState('')
  const [imgTs, setImgTs]           = useState(Date.now())
  const fileRef  = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/empreendimentos/${empId}`)
      .then(r => r.json()).then(setData).catch(console.error).finally(() => setLoading(false))
  }, [empId])

  const refreshMateriais = () =>
    fetch(`/api/empreendimentos/${empId}/materiais`).then(r => r.json())
      .then(d => setData(p => p ? { ...p, materiais: d.materiais } : p)).catch(console.error)

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

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'resumo',    label: 'Visão Geral', icon: BarChart3  },
    { key: 'unidades',  label: 'Unidades',    icon: Home       },
    { key: 'vendas',    label: 'Vendas',      icon: DollarSign },
    { key: 'materiais', label: 'Materiais',   icon: FileText   },
  ]

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-3xl bg-[#09090b] border-l border-[#1C1C1E] z-50 flex flex-col shadow-2xl">
        {/* Header com imagem de capa */}
        <div className="relative h-40 shrink-0 bg-[#121214]">
          {data?.empreendimento.imageUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={`${data.empreendimento.imageUrl}&t=${imgTs}`} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center"><Building2 size={40} className="text-zinc-700" /></div>}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="absolute top-3 right-3 flex gap-2">
            {isAdmin && (
              <label className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-black/60 text-white text-xs cursor-pointer hover:bg-black/80 border border-white/10">
                <Camera size={12} /> Foto
                <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f) }} />
              </label>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 border border-white/10 text-white"><X size={15} /></button>
          </div>
          {data && (
            <div className="absolute bottom-3 left-4">
              <h2 className="text-lg font-bold text-white leading-tight">{data.empreendimento.nome}</h2>
              <div className="flex items-center gap-2 mt-1">
                {data.empreendimento.situacao && <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-white border border-white/20">{data.empreendimento.situacao}</span>}
                {data.empreendimento.tipo     && <span className="text-[11px] text-zinc-400">{data.empreendimento.tipo}</span>}
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 py-2 border-b border-[#1C1C1E] shrink-0 overflow-x-auto scrollbar-none">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${tab === key ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
              <Icon size={12} /> {label}
              {key==='unidades'  && data && <span className="ml-0.5 text-[10px] text-zinc-600">{data.unidades.length}</span>}
              {key==='vendas'    && data && <span className="ml-0.5 text-[10px] text-zinc-600">{data.vendas.length}</span>}
              {key==='materiais' && data && <span className="ml-0.5 text-[10px] text-zinc-600">{data.materiais.length}</span>}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-40 gap-3 text-zinc-500"><Loader2 size={18} className="animate-spin" /><span className="text-sm">Carregando...</span></div>
          ) : !data ? (
            <p className="text-center text-zinc-500 py-10">Erro ao carregar dados.</p>
          ) : (
            <>
              {/* RESUMO */}
              {tab === 'resumo' && (() => {
                const u = data.unidades
                const disp = u.filter(x => x.status==='Disponivel').length
                const res  = u.filter(x => x.status==='Reservado').length
                const vend = u.filter(x => x.status==='Vendido').length
                const vgvDisp    = u.filter(x => x.status==='Disponivel').reduce((s,x) => s+(x.valor||0),0)
                const vgvVendRes = u.filter(x => x.status!=='Disponivel').reduce((s,x) => s+(x.valor||0),0)
                const totalVendas = data.vendas.reduce((s,v) => s+(v.valor||0),0)
                const raw = data.empreendimento.raw as Record<string,unknown>
                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[['Disponíveis',disp,'text-emerald-400'],['Reservadas',res,'text-amber-400'],['Vendidas',vend,'text-sky-400'],['Total',u.length,'text-zinc-200']].map(([l,v,c]) => (
                        <div key={l as string} className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-3 text-center">
                          <p className={`text-xl font-bold ${c}`}>{v as number}</p>
                          <p className="text-[11px] text-zinc-500 mt-0.5">{l as string}</p>
                        </div>
                      ))}
                    </div>
                    {u.length>0 && <StatusBar disp={disp} res={res} vend={vend} total={u.length} />}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[['VGV Disponível',vgvDisp,'text-emerald-400'],['VGV Vendido + Res.',vgvVendRes,'text-sky-400'],['Total Vendas',totalVendas,'text-white']].map(([l,v,c]) => (
                        <div key={l as string} className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-3">
                          <p className="text-[11px] text-zinc-500">{l as string}</p>
                          <p className={`text-sm font-bold ${c} mt-0.5`}>{BRL(v as number)}</p>
                        </div>
                      ))}
                    </div>
                    {raw && (
                      <div className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-3 space-y-1.5">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Dados do CV CRM</p>
                        {([['Endereço',(raw.endereco||raw.logradouro) as string],['Cidade',((raw.cidade||((raw.cidade_obj as Record<string,unknown>|undefined)?.nome)) as string)],['Bairro',raw.bairro as string],['CEP',raw.cep as string],['Construtora',((raw.construtora||((raw.construtora_obj as Record<string,unknown>|undefined)?.nome)) as string)],['Entrega',(raw.previsao_entrega||raw.data_entrega) as string],['Obra',raw.percentual_obra ? `${raw.percentual_obra}%` : null]] as [string,string|null][]).filter(([,v])=>v).map(([k,v])=>(
                          <div key={k} className="flex items-center justify-between text-xs"><span className="text-zinc-500">{k}</span><span className="text-zinc-300">{v}</span></div>
                        ))}
                      </div>
                    )}
                    {(() => {
                      const presentes = new Set(data.materiais.map(m=>m.tipo))
                      const faltando  = TIPOS_MATERIAL.filter(t=>!presentes.has(t.value)&&['tabela','ebook','planta'].includes(t.value))
                      if (!faltando.length) return null
                      return (
                        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                          <p className="text-[11px] font-bold text-amber-400 mb-1.5">⚠️ Materiais não cadastrados</p>
                          <div className="flex flex-wrap gap-1.5">{faltando.map(t=><span key={t.value} className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">{t.label}</span>)}</div>
                        </div>
                      )
                    })()}
                  </div>
                )
              })()}

              {/* UNIDADES */}
              {tab === 'unidades' && (
                <div className="space-y-3">
                  <div className="flex gap-2 flex-wrap">
                    {(['all','Disponivel','Reservado','Vendido'] as const).map(s => (
                      <button key={s} onClick={() => setUnitFilter(s)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${unitFilter===s ? 'bg-white/10 text-white border-white/20' : 'text-zinc-500 border-[#1E1E22] hover:text-zinc-300'}`}>
                        {s==='all' ? `Todas (${data.unidades.length})` : s==='Disponivel' ? `Disponíveis (${data.unidades.filter(u=>u.status===s).length})` : s==='Reservado' ? `Reservadas (${data.unidades.filter(u=>u.status===s).length})` : `Vendidas (${data.unidades.filter(u=>u.status===s).length})`}
                      </button>
                    ))}
                  </div>
                  {unidadesFiltradas.length === 0 ? (
                    <p className="text-xs text-zinc-600 py-6 text-center">Nenhuma unidade.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-[#1E1E22]">
                      <table className="w-full text-left">
                        <thead className="bg-[#0E0E10] text-[11px] uppercase font-bold text-zinc-500 tracking-wider">
                          <tr>{['Bloco','Unidade','Área','Valor','Status'].map(h=><th key={h} className="py-2.5 px-3">{h}</th>)}</tr>
                        </thead>
                        <tbody className="divide-y divide-[#1C1C1E]">
                          {unidadesFiltradas.map(u => (
                            <tr key={u.id} className="hover:bg-[#17171A] transition-colors">
                              <td className="py-2.5 px-3 text-xs text-zinc-400">{u.bloco||'—'}</td>
                              <td className="py-2.5 px-3 text-xs font-medium text-white">{u.numero||'—'}</td>
                              <td className="py-2.5 px-3 text-xs text-zinc-400 whitespace-nowrap">{u.metragem ? `${u.metragem} m²` : '—'}</td>
                              <td className="py-2.5 px-3 text-xs text-zinc-200 whitespace-nowrap font-mono">{u.valor ? BRL(u.valor) : '—'}</td>
                              <td className="py-2.5 px-3"><span className={`text-[11px] px-2 py-0.5 rounded-full border ${STATUS_COLOR[u.status]||'text-zinc-500 border-zinc-700'}`}>{u.status==='Disponivel'?'Disponível':u.status}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* VENDAS */}
              {tab === 'vendas' && (
                <div className="space-y-4">
                  <div className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-3">
                    <p className="text-[11px] text-zinc-500 mb-2">{dateRange.start||dateRange.end ? `Período: ${dateRange.start||'—'} → ${dateRange.end||'—'}` : 'Todas as vendas (sem filtro)'}</p>
                    <div className="flex items-center gap-6">
                      <div><p className="text-xl font-bold text-white">{vendasFiltradas.length}</p><p className="text-[11px] text-zinc-500">vendas</p></div>
                      <div><p className="text-xl font-bold text-emerald-400">{BRL(vendasFiltradas.reduce((s,v)=>s+(v.valor||0),0))}</p><p className="text-[11px] text-zinc-500">VGV realizado</p></div>
                    </div>
                  </div>
                  {data.vendas.length !== vendasFiltradas.length && (
                    <div className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-3">
                      <p className="text-[11px] text-zinc-500 mb-2">Total histórico</p>
                      <div className="flex items-center gap-6">
                        <div><p className="text-lg font-bold text-zinc-300">{data.vendas.length}</p><p className="text-[11px] text-zinc-500">vendas</p></div>
                        <div><p className="text-lg font-bold text-zinc-300">{BRL(data.vendas.reduce((s,v)=>s+(v.valor||0),0))}</p><p className="text-[11px] text-zinc-500">VGV total</p></div>
                      </div>
                    </div>
                  )}
                  {data.vendas.length === 0 ? (
                    <p className="text-xs text-zinc-600 py-6 text-center">Nenhuma venda registrada.</p>
                  ) : (
                    <div className="space-y-2">
                      {data.vendas.map(v => {
                        const inPeriod = vendasFiltradas.some(vf=>vf.id===v.id)
                        return (
                          <div key={v.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${inPeriod ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-[#1E1E22] bg-[#121214]/40 opacity-50'}`}>
                            <DollarSign size={14} className={inPeriod ? 'text-emerald-400' : 'text-zinc-600'} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-white">Unidade #{v.id_unidade||'—'}</p>
                              <p className="text-[11px] text-zinc-500 mt-0.5">{fmtDate(v.data_venda)} · {v.status||'—'}</p>
                            </div>
                            <p className={`text-sm font-bold whitespace-nowrap ${inPeriod ? 'text-emerald-400' : 'text-zinc-400'}`}>{BRL(v.valor)}</p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* MATERIAIS */}
              {tab === 'materiais' && (
                <div className="space-y-4">
                  {isAdmin && (
                    <div className="border border-dashed border-[#2E2E34] rounded-xl p-4 space-y-3">
                      <p className="text-xs font-semibold text-zinc-400">Adicionar material</p>
                      <div className="grid grid-cols-2 gap-2">
                        <select value={matTipo} onChange={e=>setMatTipo(e.target.value)} className="bg-[#1a1a1f] border border-[#2E2E34] rounded-lg px-3 py-2 text-xs text-white focus:outline-none">
                          {TIPOS_MATERIAL.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        <input value={matNome} onChange={e=>setMatNome(e.target.value)} placeholder="Nome (opcional)" className="bg-[#1a1a1f] border border-[#2E2E34] rounded-lg px-3 py-2 text-xs text-white focus:outline-none" />
                      </div>
                      <button onClick={()=>fileRef.current?.click()} disabled={uploading}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#1a1a1f] border border-[#2E2E34] rounded-lg text-xs text-zinc-300 hover:bg-[#222228] disabled:opacity-50">
                        {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                        {uploading ? 'Enviando...' : 'Escolher arquivo (máx 100 MB)'}
                      </button>
                      <input ref={fileRef} type="file" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)uploadMaterial(f)}} />
                    </div>
                  )}
                  <div className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-3 space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Checklist</p>
                    {TIPOS_MATERIAL.filter(t=>['tabela','ebook','planta','memorial'].includes(t.value)).map(t => {
                      const ok = data.materiais.some(m=>m.tipo===t.value)
                      return (
                        <div key={t.value} className="flex items-center gap-2 text-xs">
                          {ok ? <CheckSquare size={13} className="text-emerald-400 shrink-0" /> : <Clock size={13} className="text-zinc-600 shrink-0" />}
                          <span className={ok ? 'text-zinc-300' : 'text-zinc-600'}>{t.label}</span>
                          {ok && <span className="ml-auto text-[10px] text-emerald-500">{data.materiais.filter(m=>m.tipo===t.value).length} arquivo(s)</span>}
                        </div>
                      )
                    })}
                  </div>
                  {data.materiais.length === 0 ? (
                    <p className="text-xs text-zinc-600 py-4 text-center">Nenhum material cadastrado.</p>
                  ) : (
                    <div className="space-y-2">
                      {data.materiais.map(m => (
                        <div key={m.id} className="flex items-center gap-3 p-3 bg-[#121214]/60 border border-[#1E1E22] rounded-xl">
                          <FileText size={14} className="text-zinc-500 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-zinc-200 truncate">{m.nome}</p>
                            <p className="text-[10px] text-zinc-500 mt-0.5">{TIPOS_MATERIAL.find(t=>t.value===m.tipo)?.label||m.tipo} · {fmtSize(m.size_bytes)} · {m.uploaded_by} · {fmtDate(m.created_at)}</p>
                          </div>
                          <a href={m.downloadUrl} download={m.nome} className="p-1.5 hover:bg-white/5 text-zinc-500 hover:text-white rounded-lg shrink-0"><Download size={13} /></a>
                          {isAdmin && <button onClick={()=>deleteMaterial(m.id)} className="p-1.5 hover:bg-red-500/10 text-zinc-600 hover:text-red-400 rounded-lg shrink-0"><Trash2 size={13} /></button>}
                        </div>
                      ))}
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

export default function EmpreendimentosView() {
  const { estoque, filteredLeads, dateRange } = useData()
  const { currentUser } = useUser()
  const isAdmin = currentUser.role === 'Desenvolvedor' || currentUser.role === 'Diretoria' || !!currentUser.permissions?.isAdmin
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [imgTs] = useState(Date.now())

  const empreendimentos = Array.isArray(estoque?.empreendimentos) ? estoque.empreendimentos : []
  const resumo          = Array.isArray(estoque?.resumo)          ? estoque.resumo          : []

  const leadCountByProject = useMemo(() => {
    const map = new Map<string, number>()
    for (const lead of filteredLeads) {
      for (const emp of ((lead.empreendimento ?? []) as { nome?: string }[])) {
        if (emp.nome) map.set(emp.nome, (map.get(emp.nome) ?? 0) + 1)
      }
    }
    return map
  }, [filteredLeads])

  if (empreendimentos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-zinc-600">
        <Building2 size={40} className="opacity-30" />
        <p className="text-sm font-semibold text-zinc-400">Nenhum empreendimento</p>
        <p className="text-xs text-center max-w-xs">Os dados sincronizam automaticamente às 3h e 15h.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {empreendimentos.map((emp: { id: number; nome: string; situacao: string; tipo: string }) => {
          const stats = (resumo.find((r: { id_empreendimento: number }) => r.id_empreendimento === emp.id) || { total:0,disponivel:0,reservado:0,vendido:0,vgv_disponivel:0,vgv_vendido:0 }) as { total:number;disponivel:number;reservado:number;vendido:number;vgv_disponivel:number;vgv_vendido:number }
          const leads = leadCountByProject.get(emp.nome) ?? 0
          return (
            <div key={emp.id} onClick={() => setSelectedId(emp.id)}
              className="group bg-[#121214]/60 border border-[#1E1E22] rounded-2xl overflow-hidden cursor-pointer hover:border-zinc-700 transition-all shadow-lg hover:shadow-xl">
              <div className="relative h-40 bg-[#0E0E10]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/empreendimentos/${emp.id}/image?t=${imgTs}`} alt=""
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
                <div className="absolute inset-0 flex items-center justify-center opacity-30">
                  <Building2 size={32} className="text-zinc-600" />
                </div>
                <div className="absolute bottom-3 left-3 right-3">
                  <p className="text-sm font-bold text-white leading-tight truncate">{emp.nome}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {emp.situacao && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white">{emp.situacao}</span>}
                    {emp.tipo     && <span className="text-[10px] text-zinc-400">{emp.tipo}</span>}
                  </div>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <StatusBar disp={stats.disponivel} res={stats.reservado} vend={stats.vendido} total={stats.total} />
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[['Disponíveis',stats.disponivel,'text-emerald-400'],['Reservadas',stats.reservado,'text-amber-400'],['Vendidas',stats.vendido,'text-sky-400']].map(([l,v,c]) => (
                    <div key={l as string}><p className={`text-base font-bold ${c}`}>{v as number}</p><p className="text-[10px] text-zinc-500">{l as string}</p></div>
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
      {selectedId !== null && <DetailPanel empId={selectedId} dateRange={dateRange} onClose={() => setSelectedId(null)} isAdmin={isAdmin} />}
    </div>
  )
}
