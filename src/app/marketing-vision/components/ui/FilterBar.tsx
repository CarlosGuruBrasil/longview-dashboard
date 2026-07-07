'use client'

import { X } from 'lucide-react'
import { useData } from '../../context/DataContext'
import { useMemo } from 'react'
import { getOrigin } from '../../utils/leads'

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
      const name = lead.gestor?.nome || (lead.raw as any)?.gestor?.nome
      if (name) set.add(name)
    }
    return Array.from(set).sort()
  }, [allLeads])

  const hasFilters = !!leadFilters.origem || !!leadFilters.situacao || !!leadFilters.empreendimento ||
                     !!leadFilters.corretor || !!leadFilters.imobiliaria || !!leadFilters.gestor ||
                     !!leadFilters.startDate || !!leadFilters.endDate

  return (
    <div className="flex items-center flex-wrap gap-2.5 bg-white/[0.01] border border-white/5 p-3 rounded-2xl">
      {/* Período de Data */}
      <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-xs shrink-0">
        <span className="text-[10px] text-zinc-500 font-bold uppercase">De</span>
        <input
          type="date"
          value={leadFilters.startDate ?? ''}
          onChange={e => setLeadFilters({ ...leadFilters, startDate: e.target.value || undefined })}
          className="bg-transparent text-zinc-300 focus:outline-none focus:border-transparent text-[11px] h-5 cursor-pointer [color-scheme:dark]"
        />
        <span className="text-[10px] text-zinc-500 font-bold uppercase ml-1">Até</span>
        <input
          type="date"
          value={leadFilters.endDate ?? ''}
          onChange={e => setLeadFilters({ ...leadFilters, endDate: e.target.value || undefined })}
          className="bg-transparent text-zinc-300 focus:outline-none focus:border-transparent text-[11px] h-5 cursor-pointer [color-scheme:dark]"
        />
      </div>

      {/* Origem */}
      <select
        value={leadFilters.origem ?? ''}
        onChange={e => setLeadFilters({ ...leadFilters, origem: e.target.value || undefined })}
        className="px-2.5 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-zinc-300 focus:outline-none focus:border-sky-500/40 max-w-[140px] truncate cursor-pointer"
      >
        <option value="">Origem: todas</option>
        {originOptions.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>

      {/* Situação */}
      <select
        value={leadFilters.situacao ?? ''}
        onChange={e => setLeadFilters({ ...leadFilters, situacao: e.target.value || undefined })}
        className="px-2.5 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-zinc-300 focus:outline-none focus:border-sky-500/40 max-w-[160px] truncate cursor-pointer"
      >
        <option value="">Situação: todas</option>
        {situacaoOptions.map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      {/* Empreendimento */}
      <select
        value={leadFilters.empreendimento ?? ''}
        onChange={e => setLeadFilters({ ...leadFilters, empreendimento: e.target.value || undefined })}
        className="px-2.5 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-zinc-300 focus:outline-none focus:border-sky-500/40 max-w-[180px] truncate cursor-pointer"
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
        className="px-2.5 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-zinc-300 focus:outline-none focus:border-sky-500/40 max-w-[160px] truncate cursor-pointer"
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
        className="px-2.5 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-zinc-300 focus:outline-none focus:border-sky-500/40 max-w-[180px] truncate cursor-pointer"
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
        className="px-2.5 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-zinc-300 focus:outline-none focus:border-sky-500/40 max-w-[150px] truncate cursor-pointer"
      >
        <option value="">Gestor: todos</option>
        {gestorOptions.map(g => (
          <option key={g} value={g}>{g}</option>
        ))}
      </select>

      {hasFilters && (
        <button
          onClick={clearFilters}
          className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors font-semibold"
        >
          <X size={12} />
          Limpar Filtros
        </button>
      )}
    </div>
  )
}
