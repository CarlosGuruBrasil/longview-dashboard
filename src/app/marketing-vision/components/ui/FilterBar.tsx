'use client'

import { X } from 'lucide-react'
import { useData } from '../../context/DataContext'
import { useMemo } from 'react'
import { getOrigin } from '../../utils/leads'
import type { FunnelStage } from '../../utils/funnel'

const funnelStageOptions: Array<{ value: FunnelStage; label: string }> = [
  { value: 'atendimento', label: 'Etapa: atendimento ou além' },
  { value: 'visita', label: 'Etapa: visita ou além' },
  { value: 'reserva', label: 'Etapa: reserva ou além' },
  { value: 'venda', label: 'Etapa: venda' },
]

export default function FilterBar() {
  const { allLeads, leadFilters, setLeadFilters, clearFilters } = useData()

  const originOptions = useMemo(() => {
    const set = new Set<string>()
    for (const lead of allLeads) {
      const origin = getOrigin(lead)
      if (origin && origin !== 'Desconhecido') set.add(origin)
    }
    return Array.from(set).sort()
  }, [allLeads])

  const situacaoOptions = useMemo(() => {
    const set = new Set<string>()
    for (const lead of allLeads) {
      const sit = lead.situacao
      const name = typeof sit === 'object' && sit ? sit.nome : sit
      if (name && typeof name === 'string') set.add(name)
    }
    return Array.from(set).sort()
  }, [allLeads])

  const empreendimentoOptions = useMemo(() => {
    const set = new Set<string>()
    for (const lead of allLeads) {
      const emp = lead.empreendimento
      const name = Array.isArray(emp)
        ? emp[0]?.nome
        : (emp as { nome?: string } | undefined)?.nome
      if (name) set.add(name)
    }
    return Array.from(set).sort()
  }, [allLeads])

  const corretorOptions = useMemo(() => {
    const set = new Set<string>()
    for (const lead of allLeads) {
      const name = lead.corretor?.nome
      if (name) set.add(name)
    }
    return Array.from(set).sort()
  }, [allLeads])

  const imobiliariaOptions = useMemo(() => {
    const set = new Set<string>()
    for (const lead of allLeads) {
      const name = lead.imobiliaria?.nome
      if (name) set.add(name)
    }
    return Array.from(set).sort()
  }, [allLeads])

  const gestorOptions = useMemo(() => {
    const set = new Set<string>()
    for (const lead of allLeads) {
      const rawGestor = lead.raw?.gestor
      const rawName = rawGestor && typeof rawGestor === 'object' ? (rawGestor as { nome?: unknown }).nome : undefined
      const name = lead.gestor?.nome || (typeof rawName === 'string' ? rawName : undefined)
      if (name) set.add(name)
    }
    return Array.from(set).sort()
  }, [allLeads])

  const hasFilters = !!leadFilters.origem || !!leadFilters.situacao || !!leadFilters.empreendimento ||
                     !!leadFilters.corretor || !!leadFilters.imobiliaria || !!leadFilters.gestor ||
                     !!leadFilters.startDate || !!leadFilters.endDate || !!leadFilters.funnelStage

  const selectStyle = "h-9 px-3 text-[12px] rounded-xl bg-zinc-900 border border-white/10 text-zinc-300 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 max-w-[170px] truncate cursor-pointer transition-all hover:bg-zinc-800/80 font-semibold"

  return (
    <div className="flex items-center flex-wrap gap-2.5 bg-white/[0.01] border border-white/5 p-3 rounded-2xl w-full">
      
      {/* Filtro de Data Inicial */}
      <div className="flex items-center gap-2 bg-zinc-900 border border-white/10 rounded-xl px-3 h-9 text-xs">
        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">De</span>
        <input
          type="date"
          value={leadFilters.startDate ?? ''}
          onChange={e => setLeadFilters({ ...leadFilters, startDate: e.target.value || undefined })}
          className="bg-transparent text-zinc-200 focus:outline-none text-[11px] cursor-pointer [color-scheme:dark] w-[105px] font-bold"
        />
      </div>

      {/* Filtro de Data Final */}
      <div className="flex items-center gap-2 bg-zinc-900 border border-white/10 rounded-xl px-3 h-9 text-xs">
        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Até</span>
        <input
          type="date"
          value={leadFilters.endDate ?? ''}
          onChange={e => setLeadFilters({ ...leadFilters, endDate: e.target.value || undefined })}
          className="bg-transparent text-zinc-200 focus:outline-none text-[11px] cursor-pointer [color-scheme:dark] w-[105px] font-bold"
        />
      </div>

      {/* Origem */}
      <select
        value={leadFilters.origem ?? ''}
        onChange={e => setLeadFilters({ ...leadFilters, origem: e.target.value || undefined })}
        className={selectStyle}
      >
        <option value="">Origem: todas</option>
        {originOptions.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>

      {/* Situação */}
      <select
        value={leadFilters.situacao ?? ''}
        onChange={e => setLeadFilters({ ...leadFilters, situacao: e.target.value || undefined, funnelStage: undefined })}
        className={selectStyle}
      >
        <option value="">Situação: todas</option>
        {situacaoOptions.map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      {/* Etapa cumulativa do funil */}
      <select
        value={leadFilters.funnelStage ?? ''}
        onChange={e => setLeadFilters({ ...leadFilters, funnelStage: (e.target.value || undefined) as FunnelStage | undefined, situacao: undefined })}
        className={selectStyle}
      >
        <option value="">Etapa do funil: todas</option>
        {funnelStageOptions.map(stage => (
          <option key={stage.value} value={stage.value}>{stage.label}</option>
        ))}
      </select>

      {/* Empreendimento */}
      <select
        value={leadFilters.empreendimento ?? ''}
        onChange={e => setLeadFilters({ ...leadFilters, empreendimento: e.target.value || undefined })}
        className={selectStyle}
      >
        <option value="">Empreendimento: todos</option>
        {empreendimentoOptions.map(e => (
          <option key={e} value={e}>{e}</option>
        ))}
      </select>

      {/* Corretor */}
      <select
        value={leadFilters.corretor ?? ''}
        onChange={e => setLeadFilters({ ...leadFilters, corretor: e.target.value || undefined })}
        className={selectStyle}
      >
        <option value="">Corretor: todos</option>
        {corretorOptions.map(c => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      {/* Imobiliária */}
      <select
        value={leadFilters.imobiliaria ?? ''}
        onChange={e => setLeadFilters({ ...leadFilters, imobiliaria: e.target.value || undefined })}
        className={selectStyle}
      >
        <option value="">Imobiliária: todas</option>
        {imobiliariaOptions.map(i => (
          <option key={i} value={i}>{i}</option>
        ))}
      </select>

      {/* Gestor */}
      <select
        value={leadFilters.gestor ?? ''}
        onChange={e => setLeadFilters({ ...leadFilters, gestor: e.target.value || undefined })}
        className={selectStyle}
      >
        <option value="">Gestor: todos</option>
        {gestorOptions.map(g => (
          <option key={g} value={g}>{g}</option>
        ))}
      </select>

      {hasFilters && (
        <button
          onClick={clearFilters}
          className="flex items-center gap-1.5 px-3.5 h-9 rounded-xl text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors font-bold border border-red-500/10"
        >
          <X size={12} />
          Limpar Filtros
        </button>
      )}
    </div>
  )
}
