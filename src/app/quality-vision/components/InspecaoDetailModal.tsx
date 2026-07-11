'use client'

import { useState, useEffect } from 'react'
import { X, AlertCircle, User, Calendar } from 'lucide-react'
import logger from '@/lib/logger'

interface InspecaoDetail {
  id: number
  code?: string
  modelo?: string
  obra?: string
  local?: string
  inspetor?: string
  status?: string
  dataCriacao?: string
  dataAgendamento?: string
  dataAtualizacao?: string
  nota?: number
  nivel1?: string
  nivel2?: string
  nivel3?: string
  nivel4?: string
}

interface Verificacao {
  verificacao?: string
  resultado?: string
  problema?: string
  solucao?: string
  inspetor?: string
  data?: string
  notaItem?: string
}

const STATUS_COLORS: Record<string, string> = {
  'Aceito': '#10b981',
  'Agendado': '#0ea5e9',
  'Em Andamento': '#f59e0b',
  'Recusado': '#f43f5e',
  'Pendente Aprovação': '#a855f7',
  'Pendente Reinspeção': '#ec4899',
}

const RESULTADO_COLORS: Record<string, string> = {
  'Aprovado': '#10b981',
  'Reprovado': '#f43f5e',
  'Não se aplica': '#64748b',
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="px-2 py-0.5 rounded-full border text-[10px] font-medium whitespace-nowrap"
      style={{ borderColor: `${color}40`, background: `${color}15`, color }}
    >
      {label}
    </span>
  )
}

function formatDateTime(d?: string) {
  if (!d) return '-'
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div>
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm text-zinc-200">{value}</p>
    </div>
  )
}

export default function InspecaoDetailModal({ id, onClose }: { id: number | null; onClose: () => void }) {
  const [data, setData] = useState<{ inspecao: InspecaoDetail; verificacoes: Verificacao[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (id == null) { setData(null); return }
    async function load() {
      setLoading(true)
      setError(null)
      setData(null)
      try {
        const r = await fetch(`/api/construpoint/inspecao/${id}`)
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        setData(await r.json())
      } catch (e) {
        logger.error({ err: e }, '[InspecaoDetailModal] fetch falhou')
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [id])

  if (id == null) return null

  const insp = data?.inspecao
  const verificacoes = data?.verificacoes ?? []
  const local = [insp?.nivel1, insp?.nivel2, insp?.nivel3, insp?.nivel4].filter(Boolean).join(' > ')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl border border-[#1E1E22] bg-[#0d0d0f] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between gap-3 px-6 py-4 border-b border-[#1E1E22] bg-[#0d0d0f]/95 backdrop-blur">
          <div>
            <p className="text-xs text-zinc-500 font-mono">{insp?.code ?? (loading ? 'Carregando…' : '-')}</p>
            <h3 className="text-base font-semibold text-zinc-100">{insp?.modelo ?? ''}</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="relative w-10 h-10">
                <div className="absolute inset-0 rounded-full border-2 border-[#1E1E22]" />
                <div className="absolute inset-0 rounded-full border-2 border-t-emerald-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16">
              <AlertCircle className="text-red-400" size={28} />
              <p className="text-sm text-zinc-300">Erro ao buscar a inspeção</p>
              <p className="text-xs text-zinc-500">{error}</p>
            </div>
          ) : insp ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {insp.status && <Badge label={insp.status} color={STATUS_COLORS[insp.status] ?? '#71717a'} />}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 rounded-xl border border-[#1E1E22] bg-[#121214]/60 p-4">
                <Field label="Empreendimento" value={insp.obra} />
                <Field label="Local" value={local || insp.local} />
                <Field label="Inspetor" value={insp.inspetor} />
                <Field label="Criada em" value={formatDateTime(insp.dataCriacao)} />
                <Field label="Agendada para" value={formatDateTime(insp.dataAgendamento)} />
                <Field label="Última atualização" value={formatDateTime(insp.dataAtualizacao)} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-zinc-300">Itens Verificados</h4>
                  <span className="text-[11px] text-zinc-500">{verificacoes.length.toLocaleString('pt-BR')} itens</span>
                </div>
                {verificacoes.length === 0 ? (
                  <div className="rounded-xl border border-[#1E1E22] bg-[#121214]/60 p-6 text-center text-sm text-zinc-500">
                    {insp.status === 'Agendado'
                      ? 'Inspeção ainda não realizada — checklist será preenchido quando ela acontecer.'
                      : 'Sem itens de verificação registrados para esta inspeção.'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {verificacoes.map((v, i) => (
                      <div key={i} className="rounded-xl border border-[#1E1E22] bg-[#121214]/60 p-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <p className="text-sm text-zinc-200 font-medium">{v.verificacao ?? '-'}</p>
                          {v.resultado && <Badge label={v.resultado} color={RESULTADO_COLORS[v.resultado] ?? '#71717a'} />}
                        </div>
                        {(v.problema || v.solucao) && (
                          <div className="grid sm:grid-cols-2 gap-3 mt-2 text-xs">
                            {v.problema && (
                              <div>
                                <p className="text-red-400/80 font-medium mb-0.5">Problema</p>
                                <p className="text-zinc-400">{v.problema}</p>
                              </div>
                            )}
                            {v.solucao && (
                              <div>
                                <p className="text-emerald-400/80 font-medium mb-0.5">Solução recomendada</p>
                                <p className="text-zinc-400">{v.solucao}</p>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-3 pt-2 border-t border-[#1C1C1E] text-[11px] text-zinc-600">
                          {v.inspetor && <span className="flex items-center gap-1"><User size={10} />{v.inspetor}</span>}
                          {v.data && <span className="flex items-center gap-1"><Calendar size={10} />{formatDateTime(v.data)}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
