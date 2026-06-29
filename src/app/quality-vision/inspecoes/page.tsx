'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, Calendar } from 'lucide-react'

interface UltimaInspecao {
  id: number
  code?: string
  modelo?: string
  obra?: string
  inspetor?: string
  status?: string
  data?: string
  nota?: number
}

function formatDate(d?: string) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function statusColor(nota?: number) {
  if (nota == null) return 'text-zinc-500'
  if (nota >= 80) return 'text-emerald-400'
  if (nota >= 60) return 'text-amber-400'
  return 'text-red-400'
}

export default function InspecoesPage() {
  const currentYear = new Date().getFullYear()
  const [startYear, setStartYear] = useState(currentYear - 1)
  const [endYear,   setEndYear]   = useState(currentYear)
  const [inspecoes, setInspecoes] = useState<UltimaInspecao[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/construpoint?startYear=${startYear}&endYear=${endYear}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(d => setInspecoes(d.ultimasInspecoes || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [startYear, endYear])

  return (
    <div className="w-full space-y-6 p-4 md:p-6 lg:px-6 lg:py-4">
      <div className="flex justify-end">
        <div className="flex items-center gap-2 rounded-xl border border-[#1E1E22] bg-[#121214]/60 px-4 py-2">
          <Calendar size={14} className="text-zinc-500" />
          <select
            value={startYear}
            onChange={e => setStartYear(Number(e.target.value))}
            className="bg-transparent text-xs text-zinc-300 outline-none"
          >
            {[currentYear - 2, currentYear - 1, currentYear].map(y => (
              <option key={y} value={y} className="bg-zinc-900">{y}</option>
            ))}
          </select>
          <span className="text-zinc-600 text-xs">-</span>
          <select
            value={endYear}
            onChange={e => setEndYear(Number(e.target.value))}
            className="bg-transparent text-xs text-zinc-300 outline-none"
          >
            {[currentYear - 1, currentYear].map(y => (
              <option key={y} value={y} className="bg-zinc-900">{y}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-4 p-12" style={{ minHeight: '60vh' }}>
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-[#1E1E22]" />
            <div className="absolute inset-0 rounded-full border-2 border-t-emerald-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
          </div>
          <p className="text-sm text-zinc-400">Buscando dados de inspeções…</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-3 p-12" style={{ minHeight: '60vh' }}>
          <AlertCircle className="text-red-400" size={32} />
          <p className="text-sm text-zinc-300 font-medium">Erro ao buscar dados</p>
          <p className="text-xs text-zinc-500">{error}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#1E1E22] bg-[#121214]/60 p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1C1C1E]">
                  {['Código', 'Modelo', 'Obra', 'Inspetor', 'Data', 'Status', 'Nota'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-zinc-500 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inspecoes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-zinc-600">Sem inspeções no período selecionado.</td>
                  </tr>
                ) : (
                  inspecoes.map((insp, i) => (
                    <tr key={i} className="border-b border-[#1C1C1E] hover:bg-[#17171A] transition">
                      <td className="py-3 px-4 text-zinc-300 font-mono text-xs">{insp.code ?? '-'}</td>
                      <td className="py-3 px-4 text-zinc-200">{insp.modelo ?? '-'}</td>
                      <td className="py-3 px-4 text-zinc-400">{insp.obra ?? '-'}</td>
                      <td className="py-3 px-4 text-emerald-400/80 text-xs">{insp.inspetor ?? '-'}</td>
                      <td className="py-3 px-4 text-zinc-400 whitespace-nowrap text-xs">{formatDate(insp.data)}</td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 rounded-full border border-[#1E1E22] bg-[#18181B] text-[10px] font-semibold text-zinc-300 uppercase tracking-wider">
                          {insp.status ?? '-'}
                        </span>
                      </td>
                      <td className={`py-3 px-4 font-bold text-sm ${statusColor(insp.nota)}`}>
                        {insp.nota != null ? `${insp.nota.toFixed(1)}%` : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
