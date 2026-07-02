'use client';

import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  SlidersHorizontal,
  RefreshCw,
  Printer,
  User
} from 'lucide-react';
import Image from 'next/image';
import { Task, Project } from '@/lib/db';
import { useUser } from '@/context/UserContext';

export default function ReportsPage() {
  const { currentUser } = useUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const [reportType, setReportType] = useState<'executivo' | 'empreendimento' | 'produtividade' | 'pendencias'>('executivo');
  const [selectedProject, setSelectedProject] = useState('Todos');
  const [selectedResponsible, setSelectedResponsible] = useState('Todos');

  const fetchData = async () => {
    setLoading(true);
    try {
      const resTasks = await fetch('/api/tasks');
      const dataTasks = await resTasks.json();
      const resProj = await fetch('/api/projects');
      const dataProj = await resProj.json();
      setTasks(dataTasks.tasks || []);
      setProjects(dataProj.projects || []);
    } catch (e) {
      console.error('Erro ao buscar dados de relatórios:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => { fetchData(); });
  }, []);

  // Lista de responsáveis únicos para o filtro
  const allResponsibles = Array.from(
    new Set(
      tasks
        .map(t => t.responsible)
        .filter(r => r && r !== 'Não atribuído' && r !== '-')
    )
  ).sort();

  // Filtro duplo: empreendimento + responsável
  const filteredTasks = tasks.filter(t => {
    const matchProject = selectedProject === 'Todos' || t.project.toLowerCase() === selectedProject.toLowerCase();
    const matchResp = selectedResponsible === 'Todos' || t.responsible === selectedResponsible ||
      t.secondaryResponsibles?.includes(selectedResponsible);
    return matchProject && matchResp;
  });

  const total = filteredTasks.length;
  const finalizadas = filteredTasks.filter(t => t.statusAndamento === 'Finalizado').length;
  const emAndamento = filteredTasks.filter(t => t.statusAndamento === 'Em andamento').length;

  const NOW = new Date();
  const atrasadas = filteredTasks.filter(t => {
    if (t.statusAndamento === 'Finalizado' || !t.previsaoEntrega) return false;
    const parts = t.previsaoEntrega.split('/');
    if (parts.length === 3) {
      let y = parseInt(parts[2]); if (y < 100) y += 2000;
      return new Date(y, parseInt(parts[1]) - 1, parseInt(parts[0])) < NOW;
    }
    return false;
  }).length;

  const criticas = filteredTasks.filter(t =>
    (t.urgencia === 'Crítica' || t.urgencia === 'Emergencial') && t.statusAndamento !== 'Finalizado'
  ).length;

  const percentConclusao = total > 0 ? Math.round((finalizadas / total) * 100) : 0;

  const handleExportExcel = () => {
    if (filteredTasks.length === 0) return;
    const headers = ['EMPREENDIMENTO','Responsável pela execução','Geral','Assunto','Status da Contratação','?!','Situação','Status Andamento','Início','Previsão de entrega','Entrega Efetiva','Observações e Rotinas'];
    const esc = (val: string) => {
      const s = String(val ?? '');
      return (s.includes('"') || s.includes(';') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = filteredTasks.map(t => {
      const fullResp = [t.responsible, ...(t.secondaryResponsibles || [])].filter(r => r && r !== 'Não atribuído' && r !== '-').join(' / ');
      const rawUrg = t.urgencia === 'Crítica' || t.urgencia === 'Emergencial' ? '!' : t.urgencia === 'Média' ? '?' : '';
      return [t.project, fullResp || '-', t.sector, t.subject, t.statusContratacao, rawUrg, t.situacao, t.statusAndamento, t.inicio, t.previsaoEntrega, t.entregaEfetiva, t.observacoesRotinas].map(esc).join(';');
    });
    const csv = '﻿' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Relatorio_LongView_${reportType}_${selectedProject.replace(/ /g, '_')}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handlePrint = () => { window.print(); };

  const reportTitle =
    reportType === 'executivo' ? 'Relatório Executivo Geral' :
    reportType === 'empreendimento' ? `Relatório de Empreendimento — ${selectedProject}` :
    reportType === 'produtividade' ? 'Análise de Produtividade' :
    'Relatório de Riscos, Pendências e Atrasos';

  return (
    <>
      {/* Estilos globais de impressão */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 12mm 10mm; }
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; inset: 0; }
          .no-print { display: none !important; }
          table { border-collapse: collapse; font-size: 8pt; }
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; }
          th, td { border: 1px solid #d1d5db; padding: 4px 6px; }
          th { background: #f3f4f6 !important; color: #111 !important; font-weight: 700; }
          td { color: #222 !important; }
          .badge-print { border: 1px solid #aaa; border-radius: 4px; padding: 1px 4px; font-size: 7pt; font-weight: 700; }
        }
      `}</style>

      <div className="flex-1 w-full space-y-6 p-4 md:p-6 lg:px-6 lg:py-4">

        <header className="no-print flex justify-end border-b border-[#1C1C1E] pb-4">
          <button onClick={fetchData} className="p-2.5 bg-[#121214] hover:bg-[#18181B] border border-[#1E1E22] text-zinc-400 hover:text-white rounded-lg transition-colors" title="Atualizar">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </header>

        {/* Filtros — ocultos na impressão */}
        <section className="no-print bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400">
            <SlidersHorizontal size={14} />
            <span>Filtros do Relatório</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Tipo */}
            <div className="flex flex-col gap-1">
              <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Tipo de Relatório</span>
              <select value={reportType} onChange={e => setReportType(e.target.value as typeof reportType)}
                className="bg-[#0A0A0B] border border-[#1E1E22] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none">
                <option value="executivo">Relatório Executivo Geral</option>
                <option value="empreendimento">Relatório por Empreendimento</option>
                <option value="produtividade">Métricas de Produtividade</option>
                <option value="pendencias">Resumo de Pendências e Atrasos</option>
              </select>
            </div>
            {/* Empreendimento */}
            <div className="flex flex-col gap-1">
              <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Empreendimento</span>
              <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)}
                className="bg-[#0A0A0B] border border-[#1E1E22] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none">
                <option value="Todos">Todos os Empreendimentos</option>
                {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            {/* Responsável */}
            <div className="flex flex-col gap-1">
              <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider flex items-center gap-1">
                <User size={10} /> Responsável pela Execução
              </span>
              <select value={selectedResponsible} onChange={e => setSelectedResponsible(e.target.value)}
                className="bg-[#0A0A0B] border border-[#1E1E22] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none">
                <option value="Todos">Todos os Responsáveis</option>
                {allResponsibles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            {/* Ações */}
            <div className="flex items-end gap-2">
              <button onClick={handleExportExcel}
                className="flex-1 bg-[#121214] hover:bg-[#18181B] border border-[#1E1E22] text-white py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors">
                <FileSpreadsheet size={14} className="text-emerald-400" />
                Exportar Excel
              </button>
              <button onClick={handlePrint}
                className="flex-1 bg-white hover:bg-zinc-200 text-black py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors">
                <Printer size={14} />
                Imprimir / PDF
              </button>
            </div>
          </div>
        </section>

        {/* ÁREA IMPRIMÍVEL */}
        <section id="print-area" className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-8 space-y-6 shadow-2xl print:bg-white print:border-none print:shadow-none print:p-0 print:rounded-none">

          {/* Cabeçalho do documento */}
          <div className="flex justify-between items-start border-b border-[#1C1C1E] print:border-zinc-300 pb-5">
            <div className="flex items-center gap-4">
              {/* Logo LongView */}
              <div className="relative w-32 h-10 print:w-28 print:h-9">
                <Image
                  src="/logolongview.png"
                  alt="LongView"
                  fill
                  style={{ objectFit: 'contain', objectPosition: 'left' }}
                  priority
                />
              </div>
              <div className="border-l border-[#1C1C1E] print:border-zinc-300 pl-4">
                <span className="block text-[9px] uppercase font-black text-zinc-500 tracking-wider">Documento Oficial de Auditoria</span>
                <h3 className="text-lg font-bold text-white print:text-black mt-0.5">{reportTitle}</h3>
                <p className="text-xs text-zinc-400 print:text-zinc-600 mt-0.5">
                  {selectedProject !== 'Todos' ? selectedProject : 'Todos os Empreendimentos'}
                  {selectedResponsible !== 'Todos' ? ` · ${selectedResponsible}` : ''}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] text-zinc-500 font-mono">Emissão: {NOW.toLocaleDateString('pt-BR')}</p>
              <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Emitido por: {currentUser.name}</p>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 bg-black/20 print:bg-zinc-100 p-4 rounded-xl border border-[#1C1C1E] print:border-zinc-300">
            {[
              { label: 'Total de Tarefas', value: total, color: 'text-white print:text-black' },
              { label: 'Taxa de Conclusão', value: `${percentConclusao}%`, color: 'text-emerald-400' },
              { label: 'Finalizadas', value: finalizadas, color: 'text-emerald-400' },
              { label: 'Em Andamento', value: emAndamento, color: 'text-amber-400' },
              { label: 'Volume Atrasado', value: atrasadas, color: 'text-red-400' },
              { label: 'Urgência Crítica', value: criticas, color: 'text-orange-400' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <span className="block text-[8px] font-bold text-zinc-500 uppercase tracking-wide">{label}</span>
                <span className={`text-xl font-black font-mono ${color}`}>{value}</span>
              </div>
            ))}
          </div>

          {/* Tabela */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-white print:text-black uppercase tracking-wider">
              Listagem Detalhada de Processos
              <span className="ml-2 text-zinc-500 font-normal normal-case">({total} registros)</span>
            </h4>

            {/* Wrapper: scrollável na tela, tudo visível na impressão */}
            <div className="overflow-x-auto max-h-[520px] overflow-y-auto print:max-h-none print:overflow-visible">
              <table className="w-full text-left border-collapse" style={{ minWidth: '1400px' }}>
                <thead className="sticky top-0 z-10 print:static">
                  <tr className="bg-[#0E0E10] print:bg-zinc-200 text-zinc-400 print:text-zinc-800 font-bold uppercase text-[9px] tracking-wide border-b border-[#1C1C1E] print:border-zinc-400">
                    <th className="py-2.5 px-3 whitespace-nowrap">Empreendimento</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Responsável pela Execução</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Geral</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Assunto</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Status da Contratação</th>
                    <th className="py-2.5 px-3 whitespace-nowrap text-center">?!</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Situação</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Status Andamento</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Início</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Previsão de Entrega</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Entrega Efetiva</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Observações e Rotinas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1C1C1E] print:divide-zinc-300 text-zinc-300 print:text-zinc-800">
                  {filteredTasks.map(t => {
                    const fullResp = [t.responsible, ...(t.secondaryResponsibles || [])]
                      .filter(r => r && r !== 'Não atribuído' && r !== '-').join(' / ');

                    const rawUrg = t.urgencia === 'Crítica' || t.urgencia === 'Emergencial' ? '!' : t.urgencia === 'Média' ? '?' : '';
                    const urgClass = rawUrg === '!' ? 'text-red-400 bg-red-500/10 border border-red-500/30 badge-print' :
                                     rawUrg === '?' ? 'text-orange-400 bg-orange-500/10 border border-orange-500/30 badge-print' : '';

                    const statusClass =
                      t.statusAndamento === 'Finalizado' ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 badge-print' :
                      t.statusAndamento === 'Em andamento' ? 'text-amber-400 bg-amber-500/10 border border-amber-500/30 badge-print' :
                      t.statusAndamento === 'Aguardando' ? 'text-blue-400 bg-blue-500/10 border border-blue-500/30 badge-print' :
                      t.statusAndamento === 'Em análise' ? 'text-purple-400 bg-purple-500/10 border border-purple-500/30 badge-print' :
                      'text-zinc-400 bg-zinc-500/10 border border-zinc-500/30 badge-print';

                    const isLate = (() => {
                      if (t.statusAndamento === 'Finalizado' || !t.previsaoEntrega) return false;
                      const p = t.previsaoEntrega.split('/');
                      if (p.length !== 3) return false;
                      let y = parseInt(p[2]); if (y < 100) y += 2000;
                      return new Date(y, parseInt(p[1]) - 1, parseInt(p[0])) < NOW;
                    })();

                    return (
                      <tr key={t.id} className="hover:bg-white/[0.01] transition-colors print:hover:bg-transparent">
                        <td className="py-2 px-3 font-semibold text-white print:text-black whitespace-nowrap text-xs">{t.project}</td>
                        <td className="py-2 px-3 text-xs whitespace-nowrap">{fullResp || '—'}</td>
                        <td className="py-2 px-3 text-xs whitespace-nowrap text-zinc-400 print:text-zinc-700">{t.sector}</td>
                        <td className="py-2 px-3 text-xs" style={{ maxWidth: 200 }}>
                          <span className="block truncate font-medium text-white print:text-black" title={t.subject}>{t.subject}</span>
                        </td>
                        <td className="py-2 px-3 text-xs whitespace-nowrap text-zinc-400 print:text-zinc-700">{t.statusContratacao || '—'}</td>
                        <td className="py-2 px-3 text-center">
                          {rawUrg ? <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${urgClass}`}>{rawUrg}</span> : <span className="text-zinc-700">—</span>}
                        </td>
                        <td className="py-2 px-3 text-xs text-zinc-400 print:text-zinc-700" style={{ maxWidth: 160 }}>
                          <span className="block truncate" title={t.situacao}>{t.situacao ? t.situacao.split('\n')[0] : '—'}</span>
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${statusClass}`}>
                            {t.statusAndamento}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-xs font-mono text-zinc-500 print:text-zinc-700 whitespace-nowrap">{t.inicio || '—'}</td>
                        <td className={`py-2 px-3 text-xs font-mono whitespace-nowrap font-semibold ${isLate ? 'text-red-400' : 'text-zinc-500 print:text-zinc-700'}`}>
                          {t.previsaoEntrega || '—'}
                        </td>
                        <td className="py-2 px-3 text-xs font-mono text-zinc-500 print:text-zinc-700 whitespace-nowrap">{t.entregaEfetiva || '—'}</td>
                        <td className="py-2 px-3 text-xs text-zinc-400 print:text-zinc-700" style={{ maxWidth: 180 }}>
                          <span className="block truncate" title={t.observacoesRotinas}>{t.observacoesRotinas || '—'}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Rodapé — somente na impressão */}
          <div className="hidden print:flex justify-between items-end pt-8 text-[9pt] text-zinc-600 border-t border-zinc-300">
            <div className="flex items-end gap-6">
              <div className="relative w-24 h-8">
                <Image src="/logolongview.png" alt="LongView" fill style={{ objectFit: 'contain', objectPosition: 'left' }} />
              </div>
              <div>
                <p className="font-semibold">LongView Manager — Sistema de Gestão de Projetos</p>
                <p className="mt-0.5">Documento gerado em {NOW.toLocaleDateString('pt-BR')} · {NOW.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold">{currentUser.name}</p>
              <p>{currentUser.role}</p>
              <p className="mt-3 border-t border-zinc-400 pt-1 px-6">Assinatura</p>
            </div>
          </div>

        </section>

      </div>
    </>
  );
}
