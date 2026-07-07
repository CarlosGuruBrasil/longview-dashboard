'use client';
import React, { useState, useEffect } from 'react';
import { GitMerge, ShoppingCart, RefreshCw, ArrowDown } from 'lucide-react';
import logger from '@/lib/logger';

interface Etapa       { nome: string; ordem: number; qtd: number }
interface Reserva     { situacao: string; qtd: number }

// Ordem manual das situações de reserva (pipeline real de vendas)
const RESERVA_ORDER: Record<string, number> = {
  'Nova Reserva/Inclusão de Docs': 1,
  'Ajuste de Documentos':          2,
  'Confecção de Contrato':         3,
  'Envio Sienge':                  4,
  'Vendida':                       5,
}

const RESERVA_COLORS: Record<string, string> = {
  'Nova Reserva/Inclusão de Docs': '#0ea5e9',
  'Ajuste de Documentos':          '#8b5cf6',
  'Confecção de Contrato':         '#f59e0b',
  'Envio Sienge':                  '#06b6d4',
  'Vendida':                       '#10b981',
}

const LEAD_STAGE_COLORS: Record<number, string> = {
  1: '#3b82f6', 2: '#06b6d4', 3: '#06b6d4',
  4: '#8b5cf6', 5: '#8b5cf6', 6: '#8b5cf6',
  7: '#f59e0b', 8: '#10b981', 9: '#ef4444',
  10: '#6366f1', 11: '#64748b',
}

// Etapas excluídas do funil de leads (não são pipeline ativo)
const EXCLUIR_ETAPAS = new Set(['Perdido', 'Lançamento Sul da Ilha', 'Lançamento Trindade'])

function FunilLeads({ etapas, total }: { etapas: Etapa[]; total: number }) {
  const ativas = etapas.filter(e => !EXCLUIR_ETAPAS.has(e.nome))
  const maxQtd = Math.max(...ativas.map(e => e.qtd), 1)

  return (
    <div className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl overflow-hidden">
      <div className="p-4 border-b border-[#1C1C1E] flex items-center gap-2">
        <GitMerge size={14} className="text-sky-400" />
        <h4 className="text-sm font-semibold text-white">Funil de Leads</h4>
        <span className="ml-auto text-[11px] text-zinc-500">{total} leads no CRM</span>
      </div>
      <div className="p-4 space-y-2">
        {ativas.map(etapa => {
          const pct = total > 0 ? Math.round((etapa.qtd / total) * 100) : 0
          const cor = LEAD_STAGE_COLORS[etapa.ordem] ?? '#52525b'
          return (
            <div key={etapa.nome} className="flex items-center gap-3">
              <span className="text-[11px] text-zinc-400 w-52 shrink-0 truncate">{etapa.nome}</span>
              <div className="flex-1 bg-zinc-800/50 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-700"
                  style={{ width: `${Math.max((etapa.qtd / maxQtd) * 100, etapa.qtd > 0 ? 2 : 0)}%`, backgroundColor: cor }}
                />
              </div>
              <span className="text-xs font-bold text-white w-10 text-right">{etapa.qtd}</span>
              <span className="text-[10px] text-zinc-600 w-8 text-right">{pct}%</span>
            </div>
          )
        })}
        {/* Perdidos separados abaixo */}
        {etapas.filter(e => EXCLUIR_ETAPAS.has(e.nome)).map(etapa => (
          <div key={etapa.nome} className="flex items-center gap-3 opacity-40">
            <span className="text-[11px] text-zinc-600 w-52 shrink-0 truncate italic">{etapa.nome}</span>
            <div className="flex-1 bg-zinc-800/30 rounded-full h-1.5">
              <div className="h-1.5 rounded-full" style={{ width: `${Math.max((etapa.qtd / maxQtd) * 100, 2)}%`, backgroundColor: '#52525b' }} />
            </div>
            <span className="text-xs text-zinc-600 w-10 text-right">{etapa.qtd}</span>
            <span className="text-[10px] text-zinc-700 w-8 text-right">—</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function FunilReservas({ reservas }: { reservas: Reserva[] }) {
  const sorted = [...reservas].sort((a, b) => (RESERVA_ORDER[a.situacao] ?? 99) - (RESERVA_ORDER[b.situacao] ?? 99))
  const total  = reservas.reduce((s, r) => s + r.qtd, 0)
  const vendidas = reservas.find(r => r.situacao === 'Vendida')?.qtd ?? 0
  const taxaConversao = total > 0 ? Math.round((vendidas / total) * 100) : 0

  return (
    <div className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl overflow-hidden">
      <div className="p-4 border-b border-[#1C1C1E] flex items-center gap-2">
        <ShoppingCart size={14} className="text-emerald-400" />
        <h4 className="text-sm font-semibold text-white">Funil de Reservas</h4>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[11px] text-zinc-500">{total} reservas</span>
          <span className="text-[11px] font-bold text-emerald-400">{taxaConversao}% convertidas</span>
        </div>
      </div>

      {/* Blocos de funil em cascata (centrado, afunilando) */}
      <div className="p-4 flex flex-col items-center gap-0.5">
        {sorted.map((r, idx) => {
          const pctOfFirst = sorted[0]?.qtd > 0 ? Math.round((r.qtd / sorted[0].qtd) * 100) : 0
          const widthPct   = Math.max(30, pctOfFirst)
          const cor        = RESERVA_COLORS[r.situacao] ?? '#52525b'
          const next       = sorted[idx + 1]
          const dropped    = next ? r.qtd - next.qtd : 0

          return (
            <div key={r.situacao} className="flex flex-col items-center w-full">
              <div
                style={{
                  width: `${widthPct}%`,
                  background: `${cor}18`,
                  borderColor: `${cor}40`,
                }}
                className="border rounded-xl px-4 py-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cor }} />
                    <span className="text-[11px] text-zinc-300 truncate font-medium">{r.situacao}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-lg font-black text-white">{r.qtd}</span>
                    <span className="text-[11px] font-bold" style={{ color: cor }}>{pctOfFirst}%</span>
                  </div>
                </div>
              </div>
              {next && dropped > 0 && (
                <div className="flex items-center gap-1 py-0.5 text-[10px] text-zinc-600">
                  <ArrowDown size={8} />
                  <span className="text-red-400/60">-{dropped}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function FunilComercialView() {
  const [etapas,       setEtapas]       = useState<Etapa[]>([])
  const [funilReservas, setFunilReservas] = useState<Reserva[]>([])
  const [loading,      setLoading]      = useState(true)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/sales-vision')
      const json = await res.json()
      setEtapas(json.funil ?? [])
      setFunilReservas(json.funilReservas ?? [])
    } catch (e) {
      logger.error({ e }, 'Erro funil comercial')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void fetchData() }, [])

  const totalLeads = etapas.reduce((s, e) => s + e.qtd, 0)

  return (
    <div className="flex-1 w-full space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Funil Comercial</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Pipeline de leads e reservas em andamento</p>
        </div>
        <button
          onClick={fetchData}
          className="p-2 bg-[#121214] border border-[#1E1E22] text-zinc-400 hover:text-white rounded-xl transition-all"
          title="Atualizar"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-48 animate-pulse bg-zinc-800/30 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <FunilLeads etapas={etapas} total={totalLeads} />
          <FunilReservas reservas={funilReservas} />
        </div>
      )}
    </div>
  )
}
