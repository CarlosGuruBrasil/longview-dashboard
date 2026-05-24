'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Download, 
  FileSpreadsheet, 
  FileText, 
  SlidersHorizontal,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Send,
  Printer
} from 'lucide-react';
import { Task, Project } from '@/lib/db';
import { useUser } from '@/context/UserContext';

export default function ReportsPage() {
  const { currentUser } = useUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros de Relatórios
  const [reportType, setReportType] = useState<'executivo' | 'empreendimento' | 'produtividade' | 'pendencias'>('executivo');
  const [selectedProject, setSelectedProject] = useState('Todos');

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
    Promise.resolve().then(() => {
      fetchData();
    });
  }, []);

  // Filtra tarefas com base no projeto selecionado
  const filteredTasks = selectedProject === 'Todos' 
    ? tasks 
    : tasks.filter(t => t.project.toLowerCase() === selectedProject.toLowerCase());

  // Métricas do Relatório
  const total = filteredTasks.length;
  const finalizadas = filteredTasks.filter(t => t.statusAndamento === 'Finalizado').length;
  const emAndamento = filteredTasks.filter(t => t.statusAndamento === 'Em andamento').length;
  const emAnalise = filteredTasks.filter(t => t.statusAndamento === 'Em análise').length;
  const aguardando = filteredTasks.filter(t => t.statusAndamento === 'Aguardando').length;
  const naoIniciadas = filteredTasks.filter(t => t.statusAndamento === 'Não iniciado').length;

  const SIMULATED_NOW = new Date('2026-05-23');
  const atrasadas = filteredTasks.filter(t => {
    if (t.statusAndamento === 'Finalizado' || !t.previsaoEntrega) return false;
    const parts = t.previsaoEntrega.split('/');
    if (parts.length === 3) {
      let year = parseInt(parts[2]);
      if (year < 100) year += 2000;
      const prevDate = new Date(year, parseInt(parts[1]) - 1, parseInt(parts[0]));
      return prevDate < SIMULATED_NOW;
    }
    return false;
  }).length;

  const criticas = filteredTasks.filter(t => 
    (t.urgencia === 'Crítica' || t.urgencia === 'Emergencial') && 
    t.statusAndamento !== 'Finalizado'
  ).length;

  const percentConclusao = total > 0 ? Math.round((finalizadas / total) * 100) : 0;

  // Exportação Real para Excel (CSV Formatado)
  const handleExportExcel = () => {
    if (filteredTasks.length === 0) return;

    // Cabeçalho CSV idêntico à planilha de exemplo original (Andamentos Projetos - LONGVIEW - GERAL.csv)
    const headers = [
      'EMPREENDIMENTO',
      'Responsável pela execução',
      'Geral',
      'Assunto',
      'Status da Contratação',
      '?!',
      'Situação',
      'Status Andamento',
      'Início',
      'Previsão de entrega',
      'Entrega Efetiva',
      'Observações e Rotinas'
    ];

    const escapeCSVValue = (val: string) => {
      if (val === null || val === undefined) return '';
      const s = String(val);
      // Se tiver aspas, ponto-e-vírgula ou quebras de linha, envolve em aspas e duplica as aspas internas
      if (s.includes('"') || s.includes(';') || s.includes('\n') || s.includes('\r')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const rows = filteredTasks.map(t => {
      // Reconstrói o responsável completo (principal + secundários)
      const primary = t.responsible || '';
      const secondaries = t.secondaryResponsibles || [];
      const fullResponsible = [primary, ...secondaries]
        .filter(r => r && r !== 'Não atribuído' && r !== '-')
        .join(' / ');

      // Remapeia urgência ?! para os símbolos originais (!, ? ou vazio)
      let rawUrgencia = '';
      if (t.urgencia === 'Crítica' || t.urgencia === 'Emergencial') {
        rawUrgencia = '!';
      } else if (t.urgencia === 'Média') {
        rawUrgencia = '?';
      }

      return [
        escapeCSVValue(t.project),
        escapeCSVValue(fullResponsible || '-'),
        escapeCSVValue(t.sector),
        escapeCSVValue(t.subject),
        escapeCSVValue(t.statusContratacao),
        escapeCSVValue(rawUrgencia),
        escapeCSVValue(t.situacao),
        escapeCSVValue(t.statusAndamento),
        escapeCSVValue(t.inicio),
        escapeCSVValue(t.previsaoEntrega),
        escapeCSVValue(t.entregaEfetiva),
        escapeCSVValue(t.observacoesRotinas)
      ].join(';');
    });

    const csvContent = '\uFEFF' // BOM para garantir suporte a acentos no Excel/Numbers
      + [headers.join(';'), ...rows].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Relatorio_LongView_${reportType}_${selectedProject.replace(/ /g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="flex-1 p-6 lg:p-10 space-y-6 max-w-7xl mx-auto w-full print:p-0">
      
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#1C1C1E] pb-6 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-400">
              Gerador Executivo
            </span>
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-white mt-1">Central de Relatórios</h2>
          <p className="text-sm text-zinc-400 mt-0.5">Exporte dados operacionais consolidados estruturados para relatórios.</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={fetchData}
            className="p-2.5 bg-[#121214] hover:bg-[#18181B] border border-[#1E1E22] text-zinc-400 hover:text-white rounded-lg transition-colors flex items-center gap-1.5 text-xs"
            title="Atualizar dados"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* Painel de Filtros e Opções (Escondido na impressão para PDF limpo!) */}
      <section className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-4.5 space-y-4 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          {/* Tipo de Relatório */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Tipo de Relatório</span>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as typeof reportType)}
              className="bg-[#0A0A0B] border border-[#1E1E22] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
            >
              <option value="executivo">Relatório Executivo Geral</option>
              <option value="empreendimento">Relatório por Empreendimento</option>
              <option value="produtividade">Métricas de Produtividade</option>
              <option value="pendencias">Resumo de Pendências e Atrasos</option>
            </select>
          </div>

          {/* Filtro Empreendimento */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Empreendimento</span>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="bg-[#0A0A0B] border border-[#1E1E22] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
            >
              <option value="Todos">Todos os Empreendimentos</option>
              {projects.map(p => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Ações de Exportação */}
          <div className="flex items-end gap-2.5">
            <button 
              onClick={handleExportExcel}
              className="flex-1 bg-[#121214] hover:bg-[#18181B] border border-[#1E1E22] text-white py-2 px-3.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <FileSpreadsheet size={14} className="text-emerald-400" />
              <span>Exportar Excel</span>
            </button>
            <button 
              onClick={handlePrintPdf}
              className="flex-1 bg-white hover:bg-zinc-200 text-black py-2 px-3.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Printer size={14} />
              <span>Imprimir / PDF</span>
            </button>
          </div>

        </div>
      </section>

      {/* Preview de Relatório Premium de Alta Fidelidade (Imprimível) */}
      <section className="bg-[#121214]/60 border border-[#1E1E22] rounded-2xl p-8 space-y-6 shadow-2xl print:bg-white print:text-black print:border-none print:shadow-none">
        
        {/* Topo do Preview */}
        <div className="flex justify-between items-start border-b border-[#1C1C1E] print:border-zinc-300 pb-5">
          <div>
            <span className="text-[9px] uppercase font-black text-zinc-500 tracking-wider">Documento Oficial de Auditoria</span>
            <h3 className="text-xl font-bold text-white print:text-black mt-1">
              {reportType === 'executivo' ? 'Relatório Executivo Geral' :
               reportType === 'empreendimento' ? `Relatório de Empreendimento - ${selectedProject}` :
               reportType === 'produtividade' ? 'Análise de Produtividade' :
               'Relatório de Risco, Pendências e Atrasos'}
            </h3>
            <p className="text-xs text-zinc-400 print:text-zinc-600 mt-1">Empreendimento selecionado: {selectedProject}</p>
          </div>
          <div className="text-right">
            <h4 className="text-xs font-bold text-white print:text-black font-mono">LongView Manager</h4>
            <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Emissão: 23/05/2026</p>
          </div>
        </div>

        {/* Resumo de Metadados em Bloco */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-black/25 print:bg-zinc-100 p-4 rounded-xl border border-[#1C1C1E] print:border-zinc-300">
          <div>
            <span className="block text-[8px] font-bold text-zinc-500 uppercase tracking-wide">Volume de Tarefas</span>
            <span className="text-lg font-black text-white print:text-black font-mono">{total}</span>
          </div>
          <div>
            <span className="block text-[8px] font-bold text-zinc-500 uppercase tracking-wide">Taxa de Conclusão</span>
            <span className="text-lg font-black text-emerald-400 font-mono">{percentConclusao}%</span>
          </div>
          <div>
            <span className="block text-[8px] font-bold text-zinc-500 uppercase tracking-wide">Volume Atrasado</span>
            <span className="text-lg font-black text-red-400 font-mono">{atrasadas}</span>
          </div>
          <div>
            <span className="block text-[8px] font-bold text-zinc-500 uppercase tracking-wide">Urgência Crítica</span>
            <span className="text-lg font-black text-orange-400 font-mono">{criticas}</span>
          </div>
        </div>

        {/* Seção 2: Tabela de Tarefas e Andamento */}
        <div className="space-y-3.5">
          <h4 className="text-xs font-bold text-white print:text-black uppercase tracking-wider">Listagem Detalhada de Processos</h4>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-xs border-collapse min-w-[1400px]">
              <thead>
                <tr className="border-b border-[#1C1C1E] print:border-zinc-300 bg-[#0E0E10]/50 print:bg-zinc-200 text-zinc-400 print:text-zinc-700 font-bold uppercase text-[9px] tracking-wide">
                  <th className="py-2.5 px-3">Empreendimento</th>
                  <th className="py-2.5 px-3">Responsável pela execução</th>
                  <th className="py-2.5 px-3">Geral</th>
                  <th className="py-2.5 px-3">Assunto</th>
                  <th className="py-2.5 px-3">Status da Contratação</th>
                  <th className="py-2.5 px-3 text-center">?!</th>
                  <th className="py-2.5 px-3">Situação</th>
                  <th className="py-2.5 px-3">Status Andamento</th>
                  <th className="py-2.5 px-3">Início</th>
                  <th className="py-2.5 px-3">Previsão de entrega</th>
                  <th className="py-2.5 px-3">Entrega Efetiva</th>
                  <th className="py-2.5 px-3">Observações e Rotinas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1C1C1E] print:divide-zinc-200 text-zinc-300 print:text-zinc-800">
                {filteredTasks.slice(0, 15).map((t) => {
                  const primary = t.responsible || '';
                  const secondaries = t.secondaryResponsibles || [];
                  const fullResponsible = [primary, ...secondaries]
                    .filter(r => r && r !== 'Não atribuído' && r !== '-')
                    .join(' / ');

                  let rawUrgencia = '';
                  let urgenciaColor = '';
                  if (t.urgencia === 'Crítica' || t.urgencia === 'Emergencial') {
                    rawUrgencia = '!';
                    urgenciaColor = 'text-red-400 bg-red-500/10 border border-red-500/20 font-bold px-1.5 py-0.5 rounded';
                  } else if (t.urgencia === 'Média') {
                    rawUrgencia = '?';
                    urgenciaColor = 'text-orange-400 bg-orange-500/10 border border-orange-500/20 font-bold px-1.5 py-0.5 rounded';
                  }

                  let statusColor = 'text-zinc-400 bg-zinc-500/10 border border-zinc-500/20';
                  if (t.statusAndamento === 'Finalizado') {
                    statusColor = 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20';
                  } else if (t.statusAndamento === 'Em andamento') {
                    statusColor = 'text-blue-400 bg-blue-500/10 border border-blue-500/20';
                  } else if (t.statusAndamento === 'Em análise') {
                    statusColor = 'text-purple-400 bg-purple-500/10 border border-purple-500/20';
                  } else if (t.statusAndamento === 'Aguardando') {
                    statusColor = 'text-amber-400 bg-amber-500/10 border border-amber-500/20';
                  }

                  return (
                    <tr key={t.id} className="hover:bg-white/[0.01] transition-colors">
                      <td className="py-2.5 px-3 font-bold text-white print:text-black">{t.project}</td>
                      <td className="py-2.5 px-3 text-zinc-300 print:text-zinc-800">{fullResponsible || '-'}</td>
                      <td className="py-2.5 px-3 text-zinc-400">{t.sector}</td>
                      <td className="py-2.5 px-3 font-medium max-w-[180px] truncate" title={t.subject}>{t.subject}</td>
                      <td className="py-2.5 px-3 text-zinc-400">{t.statusContratacao || '-'}</td>
                      <td className="py-2.5 px-3 text-center">
                        {rawUrgencia ? <span className={urgenciaColor}>{rawUrgencia}</span> : '-'}
                      </td>
                      <td className="py-2.5 px-3 max-w-[150px] truncate text-zinc-400" title={t.situacao}>{t.situacao || '-'}</td>
                      <td className="py-2.5 px-3">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${statusColor}`}>
                          {t.statusAndamento}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-zinc-500">{t.inicio || '-'}</td>
                      <td className="py-2.5 px-3 font-mono text-zinc-500">{t.previsaoEntrega || '-'}</td>
                      <td className="py-2.5 px-3 font-mono text-zinc-500">{t.entregaEfetiva || '-'}</td>
                      <td className="py-2.5 px-3 max-w-[200px] truncate text-zinc-400" title={t.observacoesRotinas}>{t.observacoesRotinas || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredTasks.length > 15 && (
              <p className="text-[10px] text-zinc-500 italic mt-3.5 text-center">
                * Exibindo as primeiras 15 tarefas no preview. Use a exportação para Excel para obter a lista completa de {total} itens.
              </p>
            )}
          </div>
        </div>

        {/* Rodapé da Assinatura Corporativa (Somente para a impressão) */}
        <div className="hidden print:flex justify-between items-end pt-12 text-[10px] text-zinc-600 border-t border-zinc-200">
          <div>
            <p className="font-semibold">Responsável pela Emissão:</p>
            <p className="mt-4 font-mono">{currentUser.name} ({currentUser.role})</p>
          </div>
          <div className="text-right">
            <p>Auditor de Operações</p>
            <p className="mt-4 border-t border-zinc-400 pt-1 px-8">Assinatura Executiva LongView</p>
          </div>
        </div>

      </section>

    </div>
  );
}
