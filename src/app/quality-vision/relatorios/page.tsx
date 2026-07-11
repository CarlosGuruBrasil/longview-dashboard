'use client'

import React, { useState, useEffect, useMemo } from 'react'
import LogoLoader from '@/components/ui/LogoLoader'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'
import { AlertCircle, Calendar, Printer, Search, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import logger from '@/lib/logger'
import { useUser } from '@/context/UserContext'

// ---------- tipos ----------
interface QualityData {
  inspecoesPorDisciplina: Record<string, { total: number, [status: string]: number }>
  inspecoesPorLocalN1: Array<{ local: string, mapeadas: number, realizadas: number }>
  inspecoesPorLocalN2: Array<{ local: string, mapeadas: number, realizadas: number }>
  statusBreakdown: Record<string, number>
  kpis: {
    totalInspections: number
    taxaAprovacao: number
    taxaReprovacao: number
    totalVerificacoes: number
    aprovadas: number
    reprovadas: number
    naoAplica: number
  }
  ultimasInspecoes: Array<{
    id: string
    code: string
    modelo: string
    obra: string
    inspetor: string
    status: string
    statusId?: number
    data?: string
    disciplina?: string
    n1?: string
    n2?: string
    n3?: string
    n4?: string
  }>
  totalInspecoesFiltradas: number
  hasMoreInspecoes: boolean
  filterOptions: {
    obras: string[]
    status: string[]
    inspetores: string[]
    disciplinas: string[]
  }
}

const TICK_COLOR = '#a1a1aa'
const GRID_COLOR = 'rgba(255,255,255,0.05)'

type TooltipPayload = { name?: string; value?: number | string; color?: string }

function KpiCard({ title, value, subtitle }: { title: string, value: string | number, subtitle?: string }) {
  return (
    <div className="flex flex-col justify-center items-center h-full px-4 py-4 border border-white/10 rounded-xl bg-white/5">
      <p className="text-zinc-400 text-[10px] font-semibold tracking-wider uppercase mb-1">{title}</p>
      <p className="font-bold text-white text-3xl tracking-tight">{value}</p>
      {subtitle && <p className="text-zinc-500 mt-1 text-[9px] font-medium uppercase tracking-wider">{subtitle}</p>}
    </div>
  )
}

function PipelineBox({ label, count, percentage, color }: { label: string, count: number, percentage: string, color: string }) {
  return (
    <div className="flex flex-col p-3 rounded-lg border border-white/5 bg-[#121214]/50">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }}></div>
        <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">{label}</p>
      </div>
      <p className="text-xl font-bold text-white leading-tight">{count}</p>
      <p className="text-[10px] font-semibold" style={{ color: color }}>{percentage}%</p>
    </div>
  )
}

export default function RelatoriosPage() {
  const { currentUser } = useUser()
  const todayIso = () => new Date().toISOString().slice(0, 10)
  const isoMinusYears = (years: number) => { const d = new Date(); d.setFullYear(d.getFullYear() - years); return d.toISOString().slice(0, 10) }
  
  // States
  const [startDate, setStartDate] = useState(isoMinusYears(1))
  const [endDate,   setEndDate]   = useState(todayIso())
  const [page, setPage] = useState(1)
  
  // Filters
  const [filterObra, setFilterObra] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterInspetor, setFilterInspetor] = useState('')
  const [filterDisciplina, setFilterDisciplina] = useState('')
  
  const [data,      setData]      = useState<QualityData | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  // Report Generation State
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const [reportsData, setReportsData] = useState<{obra: string, data: QualityData}[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        params.append('startDate', startDate)
        params.append('endDate', endDate)
        const offset = (page - 1) * 100
        params.append('offset', offset.toString())
        if (filterObra) params.append('obra', filterObra)
        if (filterStatus) params.append('status', filterStatus)
        if (filterInspetor) params.append('inspetor', filterInspetor)
        if (filterDisciplina) params.append('disciplina', filterDisciplina)

        const r = await fetch(`/api/construpoint?${params.toString()}`)
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const d = await r.json() as QualityData
        setData(d)
      } catch (e) {
        logger.error({ err: e }, '[relatorios] fetch dados Construpoint falhou');
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [startDate, endDate, page, filterObra, filterStatus, filterInspetor, filterDisciplina])

  // --- REPORT GENERATOR ---
  const handleGenerateReport = async () => {
    if (!data) return
    setIsGeneratingReport(true)
    
    try {
      // Determine which obras to print
      const obrasToPrint = filterObra 
        ? [filterObra] 
        : data.filterOptions.obras.length > 0 
          ? data.filterOptions.obras 
          : ['Visão Geral']

      const fetchedReports: {obra: string, data: QualityData}[] = []

      // Fetch data for each obra concurrently
      const fetchPromises = obrasToPrint.map(async (obraName) => {
        const params = new URLSearchParams()
        params.append('startDate', startDate)
        params.append('endDate', endDate)
        params.append('offset', '0') // We don't need the paginated table for print, just the stats
        
        if (obraName !== 'Visão Geral') {
          params.append('obra', obraName)
        }
        
        if (filterStatus) params.append('status', filterStatus)
        if (filterInspetor) params.append('inspetor', filterInspetor)
        if (filterDisciplina) params.append('disciplina', filterDisciplina)

        const r = await fetch(`/api/construpoint?${params.toString()}`)
        if (r.ok) {
          const d = await r.json() as QualityData
          fetchedReports.push({ obra: obraName, data: d })
        }
      })

      await Promise.all(fetchPromises)
      
      // Sort alphabetically by obra name
      fetchedReports.sort((a, b) => a.obra.localeCompare(b.obra))
      
      setReportsData(fetchedReports)
      
      // Wait for React to render the hidden print wrappers
      setTimeout(() => {
        window.print()
        setIsGeneratingReport(false)
      }, 1000)

    } catch (e) {
      logger.error({ err: e }, 'Failed to generate report')
      setIsGeneratingReport(false)
      alert('Ocorreu um erro ao gerar o relatório.')
    }
  }

  const currentPrintDateTime = new Date().toLocaleString('pt-BR');
  const activeFilters = [
    filterObra ? `Obra: ${filterObra}` : '',
    filterDisciplina ? `Disciplina: ${filterDisciplina}` : '',
    filterStatus ? `Status: ${filterStatus}` : '',
    filterInspetor ? `Inspetor: ${filterInspetor}` : '',
  ].filter(Boolean).join(' • ') || 'Nenhum'

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: A4 landscape; margin: 0; }
          body, html { 
            background-color: #000000 !important; 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact;
            margin: 0; padding: 0;
          }
          nav, header, aside, .no-print { display: none !important; }
          main { padding: 0 !important; margin: 0 !important; max-width: none !important; background-color: #000000 !important; }
          
          .print-wrapper {
            display: block !important; width: 100%; background-color: #000000 !important;
            font-family: Arial, Helvetica, sans-serif !important; color: white !important;
          }

          .page-break { page-break-after: always; break-after: page; }

          .page-container {
            width: 297mm; height: 210mm; padding: 0; box-sizing: border-box;
            background-color: #000000 !important; position: relative; overflow: hidden;
          }
            
          .page-number {
            position: absolute; bottom: 12mm; right: 15mm; font-size: 14px;
            color: rgba(255,255,255,0.4); font-weight: 500; letter-spacing: 2px;
          }

          ::-webkit-scrollbar { display: none; }
        }
      `}} />

      {/* --- VISÃO DE TELA (NO-PRINT) --- */}
      <div className="w-full flex flex-col gap-6 p-4 md:p-6 lg:px-6 lg:py-4 no-print h-[calc(100vh-64px)] overflow-hidden">
        
        {/* Painel de Filtros e Ações */}
        <div className="flex flex-col gap-4 p-5 rounded-xl border border-[#1E1E22] bg-[#121214]/60 shrink-0">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
            
            {/* Título e Datas */}
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-bold text-white">Auditoria de Registros</h2>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-lg border border-[#2A2A2E] bg-black/40 px-3 py-2">
                  <Calendar size={14} className="text-zinc-500" />
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">De</span>
                  <input type="date" value={startDate} max={endDate} onChange={e => {setStartDate(e.target.value); setPage(1);}} className="bg-transparent text-xs text-zinc-300 outline-none [color-scheme:dark]" />
                  <span className="text-zinc-600 text-xs">–</span>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Até</span>
                  <input type="date" value={endDate} min={startDate} max={todayIso()} onChange={e => {setEndDate(e.target.value); setPage(1);}} className="bg-transparent text-xs text-zinc-300 outline-none [color-scheme:dark]" />
                </div>
              </div>
            </div>

            {/* Ações */}
            <div className="flex items-center w-full sm:w-auto">
              <button 
                onClick={handleGenerateReport}
                disabled={loading || !data || isGeneratingReport}
                className="flex w-full sm:w-auto items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors shadow-lg shadow-emerald-900/20"
              >
                {isGeneratingReport ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
                {isGeneratingReport ? 'Processando Empreendimentos...' : 'Imprimir Book Gerencial (PDF)'}
              </button>
            </div>
          </div>

          {/* Linha de Filtros Dinâmicos */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-2">
            <select value={filterObra} onChange={(e) => {setFilterObra(e.target.value); setPage(1);}} className="bg-black/40 border border-[#2A2A2E] rounded-lg text-sm text-zinc-300 px-3 py-2 outline-none">
              <option value="">Todas as Obras (Gerará 1 pág/obra)</option>
              {data?.filterOptions?.obras?.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <select value={filterDisciplina} onChange={(e) => {setFilterDisciplina(e.target.value); setPage(1);}} className="bg-black/40 border border-[#2A2A2E] rounded-lg text-sm text-zinc-300 px-3 py-2 outline-none">
              <option value="">Todas as Disciplinas</option>
              {data?.filterOptions?.disciplinas?.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => {setFilterStatus(e.target.value); setPage(1);}} className="bg-black/40 border border-[#2A2A2E] rounded-lg text-sm text-zinc-300 px-3 py-2 outline-none">
              <option value="">Todos os Status</option>
              {data?.filterOptions?.status?.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterInspetor} onChange={(e) => {setFilterInspetor(e.target.value); setPage(1);}} className="bg-black/40 border border-[#2A2A2E] rounded-lg text-sm text-zinc-300 px-3 py-2 outline-none">
              <option value="">Todos os Inspetores</option>
              {data?.filterOptions?.inspetores?.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
        </div>

        {/* LOADING & ERROR STATES */}
        <div className="flex-1 min-h-0 relative">
          {loading && (
            <div className="absolute inset-0 z-20 bg-[#121214]/90 backdrop-blur-md flex flex-col items-center justify-center rounded-xl border border-[#1E1E22]">
              <LogoLoader module="quality" text="Sincronizando Dados..." />
            </div>
          )}

          {error && (
            <div className="absolute inset-0 z-20 bg-[#121214] flex flex-col items-center justify-center gap-3 rounded-xl border border-[#1E1E22]">
              <AlertCircle className="text-red-400" size={32} />
              <p className="text-sm text-zinc-300 font-medium">Erro ao carregar dados</p>
              <p className="text-xs text-zinc-500">{error}</p>
            </div>
          )}

          {/* TABELA DE DADOS DE CONSULTA */}
          {data && !loading && !error && (
            <div className="flex flex-col h-full bg-[#121214]/60 border border-[#1E1E22] rounded-xl overflow-hidden relative">
              <div className="flex-1 overflow-auto">
                <table className="w-full text-left text-sm text-zinc-400 border-collapse">
                  <thead className="sticky top-0 bg-[#1A1A1E] text-zinc-300 border-b border-[#2A2A2E] shadow-sm z-10">
                    <tr>
                      <th className="font-medium px-4 py-3">Código</th>
                      <th className="font-medium px-4 py-3">Obra</th>
                      <th className="font-medium px-4 py-3">Modelo</th>
                      <th className="font-medium px-4 py-3">Disciplina</th>
                      <th className="font-medium px-4 py-3">Local n1</th>
                      <th className="font-medium px-4 py-3">Local n2</th>
                      <th className="font-medium px-4 py-3">Local n3</th>
                      <th className="font-medium px-4 py-3">Inspetor</th>
                      <th className="font-medium px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2A2A2E]">
                    {data.ultimasInspecoes.length > 0 ? (
                      data.ultimasInspecoes.map((row) => (
                        <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-zinc-300">{row.code}</td>
                          <td className="px-4 py-3 truncate max-w-[100px]">{row.obra || '-'}</td>
                          <td className="px-4 py-3 truncate max-w-[100px]">{row.modelo || '-'}</td>
                          <td className="px-4 py-3 truncate max-w-[100px]">{row.disciplina || '-'}</td>
                          <td className="px-4 py-3 truncate max-w-[100px]">{row.n1 || '-'}</td>
                          <td className="px-4 py-3 truncate max-w-[100px]">{row.n2 || '-'}</td>
                          <td className="px-4 py-3 truncate max-w-[100px]">{row.n3 || '-'}</td>
                          <td className="px-4 py-3">{row.inspetor || '-'}</td>
                          <td className="px-4 py-3">
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide border whitespace-nowrap" style={{
                               backgroundColor: row.status === 'Aceito' ? 'rgba(16,185,129,0.1)' : 
                                                row.status === 'Recusado' ? 'rgba(244,63,94,0.1)' : 'rgba(255,255,255,0.05)',
                               borderColor: row.status === 'Aceito' ? 'rgba(16,185,129,0.2)' : 
                                            row.status === 'Recusado' ? 'rgba(244,63,94,0.2)' : 'rgba(255,255,255,0.1)',
                               color: row.status === 'Aceito' ? '#34d399' : 
                                      row.status === 'Recusado' ? '#fb7185' : '#a1a1aa'
                            }}>
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} className="px-6 py-12 text-center text-zinc-500">
                          <Search className="mx-auto h-8 w-8 text-zinc-600 mb-3" />
                          Nenhum resultado encontrado para os filtros selecionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              {(data.hasMoreInspecoes || page > 1) && (
                <div className="flex items-center justify-between border-t border-[#2A2A2E] bg-[#1A1A1E] px-6 py-3 shrink-0">
                  <span className="text-xs text-zinc-500">
                    Mostrando página <strong className="text-zinc-300">{page}</strong> (Total: {data.totalInspecoesFiltradas} registros)
                  </span>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-1.5 rounded bg-[#2A2A2E] hover:bg-[#3A3A3E] text-zinc-300 disabled:opacity-30 disabled:hover:bg-[#2A2A2E] transition-colors"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button 
                      onClick={() => setPage(p => p + 1)}
                      disabled={!data.hasMoreInspecoes}
                      className="p-1.5 rounded bg-[#2A2A2E] hover:bg-[#3A3A3E] text-zinc-300 disabled:opacity-30 disabled:hover:bg-[#2A2A2E] transition-colors"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* --- VISÃO DE IMPRESSÃO (BOOK GERENCIAL MULTI-OBRAS) --- */}
      {reportsData.length > 0 && (
        <div className="hidden print-wrapper">
          
          {/* PÁGINA 1: CAPA EXECUTIVA */}
          <div className="page-container page-break">
            {/* Background Criativo Absoluto */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden bg-black z-0">
               <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
               <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-emerald-900/10 rounded-full blur-[120px] mix-blend-screen"></div>
               <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[60%] bg-blue-900/10 rounded-full blur-[100px] mix-blend-screen"></div>
            </div>

            <div className="relative z-10 w-full h-full flex flex-col justify-between p-[20mm]">
              <div className="flex-1"></div>
              {/* Centro de Gravidade: Logo e Título */}
              <div className="flex flex-col items-center justify-center flex-[2] w-full text-center mt-12">
                <img src="/logolongview.png" alt="LongView" className="w-[135mm] h-auto object-contain drop-shadow-2xl mb-16" />
                <h1 className="text-[12mm] font-black text-white tracking-[6px] uppercase leading-tight">
                  Relatório
                </h1>
                <p className="text-[6mm] font-light text-emerald-500 tracking-[10px] uppercase mt-4">
                  Quality Vision
                </p>
                <div className="mt-8 px-6 py-2 border border-white/20 rounded-full bg-white/5">
                  <p className="text-[3.5mm] text-zinc-300 font-medium tracking-widest">{reportsData.length} EMPREENDIMENTO{reportsData.length > 1 ? 'S' : ''} ANALISADO{reportsData.length > 1 ? 'S' : ''}</p>
                </div>
              </div>

              <div className="flex-1 flex flex-col justify-end">
                {/* Rodapé super discreto */}
                <div className="w-full border-t border-white/20 pt-4 flex justify-between items-end">
                  <div className="flex flex-col gap-1">
                    <p className="text-[3mm] text-zinc-500 tracking-wider">Período: <span className="text-zinc-300 font-medium">{new Date(startDate).toLocaleDateString('pt-BR')} a {new Date(endDate).toLocaleDateString('pt-BR')}</span></p>
                    <p className="text-[3mm] text-zinc-500 tracking-wider">Filtros: <span className="text-zinc-300 font-medium">{activeFilters}</span></p>
                  </div>
                  <div className="flex flex-col gap-1 text-right pr-6">
                    <p className="text-[3mm] text-zinc-500 tracking-wider">Impresso por: <span className="text-zinc-300 font-medium">{currentUser?.name || 'Sistema'}</span></p>
                    <p className="text-[3mm] text-zinc-500 tracking-wider">Emitido em: <span className="text-zinc-300 font-medium">{currentPrintDateTime}</span></p>
                  </div>
                </div>
              </div>
            </div>
            <div className="page-number">1/{reportsData.length + 2}</div>
          </div>

          {/* PÁGINAS DE DADOS (1 PÁGINA POR EMPREENDIMENTO) */}
          {reportsData.map((report, idx) => {
            const pageNum = idx + 2;
            const rData = report.data;
            
            // Calc stats for this specific obra
            const fMapeadas = rData.kpis.totalInspections || 0;
            const fRealizadas = rData.statusBreakdown['Aceito'] || 0;
            const pct = fMapeadas > 0 ? ((fRealizadas / fMapeadas) * 100).toFixed(1).replace('.', ',') : '0,0';
            
            // Format Chart Data
            const dData = Object.entries(rData.inspecoesPorDisciplina)
              .map(([disciplina, counts]) => ({
                disciplina,
                'Aceito': counts['Aceito'] || 0,
                'Agendado': counts['Agendado'] || 0,
                'Em Andamento': counts['Em Andamento'] || 0,
                'Pendente Aprovação': counts['Pendente Aprovação'] || 0,
                'Recusado': counts['Recusado'] || 0,
                total: counts.total
              }))
              .sort((a, b) => b.total - a.total)
              .slice(0, 10); // top 10

            // Pipeline Data
            const getPct = (val: number) => fMapeadas > 0 ? ((val / fMapeadas) * 100).toFixed(1) : '0';
            
            return (
              <div key={report.obra} className="page-container page-break">
                <div className="relative z-10 w-full h-full flex flex-col p-[12mm]">
                  
                  {/* Header */}
                  <div className="flex justify-between items-center mb-6 border-b border-white/20 pb-4 shrink-0 pr-6">
                    <div className="flex items-center gap-4">
                      <img src="/logolongview.png" alt="LongView" className="h-[7mm] w-auto" />
                      <div className="h-[7mm] w-px bg-white/20"></div>
                      <h2 className="text-white font-black tracking-wider text-[5.5mm] uppercase truncate max-w-[120mm]">
                        {report.obra}
                      </h2>
                    </div>
                    <div className="text-right">
                      <p className="text-zinc-500 text-[2.5mm] uppercase tracking-widest">{currentPrintDateTime}</p>
                    </div>
                  </div>

                  {/* Pipeline Operacional */}
                  <div className="mb-6 shrink-0 border border-white/10 rounded-xl bg-[#0a0a0c] p-4">
                    <h3 className="text-white font-bold text-[3.5mm] mb-3 uppercase tracking-wider">Pipeline Operacional</h3>
                    <div className="grid grid-cols-7 gap-3">
                      <PipelineBox label="Agendado" count={rData.statusBreakdown['Agendado'] || 0} percentage={getPct(rData.statusBreakdown['Agendado'] || 0)} color="#38bdf8" />
                      <PipelineBox label="Aceito" count={rData.statusBreakdown['Aceito'] || 0} percentage={getPct(rData.statusBreakdown['Aceito'] || 0)} color="#34d399" />
                      <PipelineBox label="Em Andam." count={rData.statusBreakdown['Em Andamento'] || 0} percentage={getPct(rData.statusBreakdown['Em Andamento'] || 0)} color="#fbbf24" />
                      <PipelineBox label="Recusado" count={rData.statusBreakdown['Recusado'] || 0} percentage={getPct(rData.statusBreakdown['Recusado'] || 0)} color="#f43f5e" />
                      <PipelineBox label="P. Aprov." count={rData.statusBreakdown['Pendente Aprovação'] || 0} percentage={getPct(rData.statusBreakdown['Pendente Aprovação'] || 0)} color="#d946ef" />
                      <PipelineBox label="P. Reins." count={rData.statusBreakdown['Pendente Reinspeção'] || 0} percentage={getPct(rData.statusBreakdown['Pendente Reinspeção'] || 0)} color="#f43f5e" />
                      <PipelineBox label="Sem status" count={rData.statusBreakdown['Sem status'] || 0} percentage={getPct(rData.statusBreakdown['Sem status'] || 0)} color="#94a3b8" />
                    </div>
                  </div>

                  <div className="flex gap-6 flex-1 min-h-0">
                    {/* Left Col: KPIs */}
                    <div className="w-[65mm] flex flex-col gap-4 shrink-0">
                      <KpiCard title="Total Mapeado" value={fMapeadas} subtitle="Registros na obra" />
                      <KpiCard title="Total Aprovado" value={fRealizadas} subtitle="Status 'Aceito'" />
                      <div className="flex-1 flex flex-col justify-center items-center border border-emerald-500/30 rounded-xl bg-emerald-500/10 p-4">
                        <p className="text-emerald-400 text-[10px] font-semibold tracking-wider uppercase mb-1">Taxa Conclusão</p>
                        <p className="font-bold text-emerald-300 text-4xl tracking-tight">{pct}%</p>
                      </div>
                    </div>

                    {/* Right Col: Gráfico */}
                    <div className="flex-1 border border-white/10 bg-[#0a0a0c] rounded-xl p-6 flex flex-col min-h-0">
                      <h3 className="text-white font-bold text-[4mm] mb-4 uppercase tracking-wider">Distribuição por Disciplina</h3>
                      <div className="flex gap-4 mb-4 text-[3mm] font-medium items-center flex-wrap w-full">
                        <div className="flex items-center gap-1.5 text-zinc-300"><div className="w-2 h-2 rounded-full bg-[#0ea5e9]"></div> Mapeadas</div>
                        <div className="flex items-center gap-1.5 text-zinc-300"><div className="w-2 h-2 rounded-full bg-[#34d399]"></div> Aceita</div>
                        <div className="flex items-center gap-1.5 text-zinc-300"><div className="w-2 h-2 rounded-full bg-[#38bdf8]"></div> Agendada</div>
                        <div className="flex items-center gap-1.5 text-zinc-300"><div className="w-2 h-2 rounded-full bg-[#fbbf24]"></div> Em Andamento</div>
                        <div className="flex items-center gap-1.5 text-zinc-300"><div className="w-2 h-2 rounded-full bg-[#f43f5e]"></div> Pendente</div>
                      </div>
                      <div className="flex-1 w-full min-h-0 -ml-4">
                        <BarChart width={750} height={200} data={dData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }} barGap={0} barCategoryGap="20%">
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={GRID_COLOR} />
                          <XAxis type="number" tick={{ fill: '#a1a1aa', fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis dataKey="disciplina" type="category" tick={{ fill: '#d4d4d8', fontSize: 9 }} axisLine={false} tickLine={false} width={180} />
                          <Bar dataKey="total" name="Mapeadas" fill="#0ea5e9" barSize={5} />
                          <Bar dataKey="Aceito" name="Aceita" fill="#34d399" barSize={5} />
                          <Bar dataKey="Agendado" name="Agendada" fill="#38bdf8" barSize={5} />
                          <Bar dataKey="Em Andamento" name="Em Andamento" fill="#fbbf24" barSize={5} />
                          <Bar dataKey="Pendente Aprovação" name="Pendente" fill="#f43f5e" barSize={5} />
                        </BarChart>
                      </div>
                    </div>
                  </div>

                </div>
                {/* Numerador Exato da Página */}
                <div className="page-number">{pageNum}/{reportsData.length + 2}</div>
              </div>
            );
          })}

          {/* ÚLTIMA PÁGINA: CONTRA-CAPA */}
          <div className="page-container flex items-center justify-center bg-black">
            <img src="/logolongview.png" alt="LongView" className="w-[80mm] h-auto opacity-30 grayscale mix-blend-screen" />
            <div className="page-number">{reportsData.length + 2}/{reportsData.length + 2}</div>
          </div>

        </div>
      )}
    </>
  )
}
