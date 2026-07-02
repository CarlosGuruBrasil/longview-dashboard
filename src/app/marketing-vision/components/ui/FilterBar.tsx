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

  const hasFilters = !!leadFilters.origem || !!leadFilters.situacao || !!leadFilters.empreendimento

  return (
    <div className="flex items-center flex-wrap gap-2">
      {/* Origem */}
      <select
        value={leadFilters.origem ?? ''}
        onChange={e => setLeadFilters({ ...leadFilters, origem: e.target.value || undefined })}
        className="px-2.5 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-zinc-300 focus:outline-none focus:border-sky-500/40 max-w-[140px] truncate"
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
        className="px-2.5 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-zinc-300 focus:outline-none focus:border-sky-500/40 max-w-[160px] truncate"
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
        className="px-2.5 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-zinc-300 focus:outline-none focus:border-sky-500/40 max-w-[180px] truncate"
      >
        <option value="">Projeto: todos</option>
        {empreendimentoOptions.map(e => (
          <option key={e} value={e}>{e}</option>
        ))}
      </select>

      {hasFilters && (
        <button
          onClick={clearFilters}
          className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors"
        >
          <X size={12} />
          Limpar
        </button>
      )}
    </div>
  )
}
