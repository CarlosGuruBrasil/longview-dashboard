'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { RefreshCw, ArrowLeft, SlidersHorizontal, X, Search } from 'lucide-react';
import Link from 'next/link';
import { Task, Project } from '@/lib/db';
import TaskDrawer from '@/components/TaskDrawer';

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSector, setFilterSector] = useState('Todos');
  const [filterResp, setFilterResp] = useState('Todos');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [filterUrgencia, setFilterUrgencia] = useState('Todos');
  const [filterContratacao, setFilterContratacao] = useState('Todos');

  const fetchData = async () => {
    setLoading(true);
    try {
      const resP = await fetch('/api/projects');
      const projects: Project[] = (await resP.json()).projects || [];
      const found = projects.find(p => p.id === id);
      setProject(found || null);
      if (found) {
        const resT = await fetch(`/api/tasks?project=${encodeURIComponent(found.name)}`);
        setTasks((await resT.json()).tasks || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => { fetchData(); });
  }, [id]);

  // Opções únicas para filtros
  const sectors = ['Todos', ...Array.from(new Set(tasks.map(t => t.sector).filter(Boolean))).sort()];
  const responsibles = ['Todos', ...Array.from(new Set(tasks.map(t => t.responsible).filter(r => r && r !== 'Não atribuído' && r !== '-'))).sort()];
  const contratacoes = ['Todos', ...Array.from(new Set(tasks.map(t => t.statusContratacao).filter(Boolean))).sort()];

  const hasFilters = searchQuery || filterSector !== 'Todos' || filterResp !== 'Todos' || filterStatus !== 'Todos' || filterUrgencia !== 'Todos' || filterContratacao !== 'Todos';

  const clearFilters = () => {
    setSearchQuery('');
    setFilterSector('Todos');
    setFilterResp('Todos');
    setFilterStatus('Todos');
    setFilterUrgencia('Todos');
    setFilterContratacao('Todos');
  };

  // Aplicar filtros
  const filteredTasks = tasks.filter(task => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || task.subject.toLowerCase().includes(q) || task.id.toLowerCase().includes(q) ||
      task.responsible.toLowerCase().includes(q) || task.sector.toLowerCase().includes(q) ||
      (task.situacao || '').toLowerCase().includes(q) || (task.observacoesRotinas || '').toLowerCase().includes(q);
    const matchSector = filterSector === 'Todos' || task.sector === filterSector;
    const matchResp = filterResp === 'Todos' || task.responsible === filterResp;
    const matchStatus = filterStatus === 'Todos' || task.statusAndamento === filterStatus;
    const matchUrg = filterUrgencia === 'Todos' || task.urgencia === filterUrgencia;
    const matchCont = filterContratacao === 'Todos' || task.statusContratacao === filterContratacao;
    return matchSearch && matchSector && matchResp && matchStatus && matchUrg && matchCont;
  });

  if (loading) {
    return (
      <div className="flex-1 w-full p-4 md:p-6 lg:px-6 lg:py-4">
        <div className="py-20 text-center text-zinc-500">Carregando...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex-1 w-full p-4 md:p-6 lg:px-6 lg:py-4">
        <div className="py-20 text-center text-zinc-500">
          <p className="text-lg font-semibold">Empreendimento não encontrado</p>
          <Link href="/project-vision/projects" className="text-sm text-zinc-400 hover:text-white mt-2 inline-block underline">Voltar</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full space-y-6 p-4 md:p-6 lg:px-6 lg:py-4">

      <header className="flex items-center gap-3 border-b border-[#1C1C1E] pb-4">
        <Link href="/project-vision/projects" className="text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="ml-auto">
          <button onClick={fetchData} className="p-2.5 bg-[#121214] hover:bg-[#18181B] border border-[#1E1E22] text-zinc-400 hover:text-white rounded-lg transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#121214]/40 border border-[#1E1E22] rounded-xl p-4">
          <p className="text-[11px] uppercase font-bold text-zinc-500 tracking-wider">Total</p>
          <p className="text-2xl font-bold text-white mt-1">{tasks.length}</p>
        </div>
        <div className="bg-[#121214]/40 border border-[#1E1E22] rounded-xl p-4">
          <p className="text-[11px] uppercase font-bold text-zinc-500 tracking-wider">Concluídas</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{tasks.filter(t => t.statusAndamento === 'Finalizado').length}</p>
        </div>
        <div className="bg-[#121214]/40 border border-[#1E1E22] rounded-xl p-4">
          <p className="text-[11px] uppercase font-bold text-zinc-500 tracking-wider">Em Andamento</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{tasks.filter(t => t.statusAndamento === 'Em andamento').length}</p>
        </div>
        <div className="bg-[#121214]/40 border border-[#1E1E22] rounded-xl p-4">
          <p className="text-[11px] uppercase font-bold text-zinc-500 tracking-wider">Não Iniciadas</p>
          <p className="text-2xl font-bold text-zinc-400 mt-1">{tasks.filter(t => t.statusAndamento === 'Não iniciado').length}</p>
        </div>
      </div>

      {/* Painel de Filtros */}
      <section className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400">
            <SlidersHorizontal size={14} />
            <span>Filtros</span>
            {filteredTasks.length !== tasks.length && (
              <span className="text-zinc-500 font-normal">({filteredTasks.length} de {tasks.length} tarefas)</span>
            )}
          </div>
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-white transition-colors">
              <X size={12} /> Limpar
            </button>
          )}
        </div>

        {/* Busca */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-2.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar por assunto, ID, responsável, situação..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-[#0A0A0B] border border-[#1E1E22] rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-zinc-700"
          />
        </div>

        {/* Selects */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Geral/Setor */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase font-bold text-zinc-500 tracking-wider">Geral / Setor</span>
            <select value={filterSector} onChange={e => setFilterSector(e.target.value)}
              className="bg-[#0A0A0B] border border-[#1E1E22] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none">
              {sectors.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Responsável */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase font-bold text-zinc-500 tracking-wider">Responsável pela Execução</span>
            <select value={filterResp} onChange={e => setFilterResp(e.target.value)}
              className="bg-[#0A0A0B] border border-[#1E1E22] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none">
              {responsibles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Status Andamento */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase font-bold text-zinc-500 tracking-wider">Status Andamento</span>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="bg-[#0A0A0B] border border-[#1E1E22] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none">
              {['Todos', 'Não iniciado', 'Em andamento', 'Aguardando', 'Em análise', 'Finalizado'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Urgência */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase font-bold text-zinc-500 tracking-wider">Urgência ?!</span>
            <select value={filterUrgencia} onChange={e => setFilterUrgencia(e.target.value)}
              className="bg-[#0A0A0B] border border-[#1E1E22] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none">
              {['Todos', 'Baixa', 'Média', 'Alta', 'Crítica', 'Emergencial'].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>

          {/* Status Contratação */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase font-bold text-zinc-500 tracking-wider">Status da Contratação</span>
            <select value={filterContratacao} onChange={e => setFilterContratacao(e.target.value)}
              className="bg-[#0A0A0B] border border-[#1E1E22] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none">
              {contratacoes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* Tabela */}
      <div className="bg-[#121214]/40 border border-[#1E1E22] rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          {filteredTasks.length === 0 ? (
            <div className="py-16 text-center text-zinc-500">
              <p className="text-sm">Nenhuma tarefa corresponde aos filtros aplicados.</p>
              <button onClick={clearFilters} className="mt-3 text-xs text-white bg-zinc-800 hover:bg-zinc-700 px-3.5 py-2 rounded-lg border border-zinc-700 transition-colors">
                Limpar Filtros
              </button>
            </div>
          ) : (
            <table className="w-full text-left" style={{ minWidth: '1400px' }}>
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-[#1C1C1E] bg-[#0E0E10] text-[11px] uppercase font-bold text-zinc-300 tracking-wider">
                  <th className="py-3 px-4 whitespace-nowrap">ID</th>
                  <th className="py-3 px-4 whitespace-nowrap">Geral</th>
                  <th className="py-3 px-4 whitespace-nowrap">Assunto</th>
                  <th className="py-3 px-4 whitespace-nowrap">Responsável pela Execução</th>
                  <th className="py-3 px-4 whitespace-nowrap">Status da Contratação</th>
                  <th className="py-3 px-4 whitespace-nowrap">?!</th>
                  <th className="py-3 px-4 whitespace-nowrap">Situação</th>
                  <th className="py-3 px-4 whitespace-nowrap">Status Andamento</th>
                  <th className="py-3 px-4 whitespace-nowrap">Início</th>
                  <th className="py-3 px-4 whitespace-nowrap">Previsão de Entrega</th>
                  <th className="py-3 px-4 whitespace-nowrap">Entrega Efetiva</th>
                  <th className="py-3 px-4 whitespace-nowrap">Observações e Rotinas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1C1C1E]">
                {filteredTasks.map(task => (
                  <tr key={task.id} onClick={() => setSelectedTaskId(task.id)} className="hover:bg-[#17171A] cursor-pointer transition-colors">
                    <td className="py-3 px-4 font-mono text-xs text-zinc-400 whitespace-nowrap">{task.id}</td>
                    <td className="py-3 px-4 text-xs text-zinc-300 whitespace-nowrap">{task.sector}</td>
                    <td className="py-3 px-4 text-xs text-white font-medium" style={{ maxWidth: '240px' }}>
                      <span className="block truncate" title={task.subject}>{task.subject}</span>
                    </td>
                    <td className="py-3 px-4 text-xs text-zinc-300 whitespace-nowrap">{task.responsible || '—'}</td>
                    <td className="py-3 px-4 text-xs whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                        task.statusContratacao?.toLowerCase().includes('contratado') && !task.statusContratacao?.toLowerCase().includes('não')
                          ? 'text-blue-400 border-blue-500/20 bg-blue-500/10'
                          : task.statusContratacao?.toLowerCase().includes('não será')
                          ? 'text-zinc-500 border-zinc-600/20 bg-zinc-600/10'
                          : task.statusContratacao?.toLowerCase().includes('andamento')
                          ? 'text-amber-400 border-amber-500/20 bg-amber-500/10'
                          : 'text-zinc-400 border-zinc-500/20 bg-zinc-500/10'
                      }`}>{task.statusContratacao || '—'}</span>
                    </td>
                    <td className="py-3 px-4 text-xs whitespace-nowrap">
                      {task.urgencia && task.urgencia !== 'Baixa' ? (
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                          task.urgencia === 'Emergencial' ? 'text-red-300 border-red-400/20 bg-red-500/10' :
                          task.urgencia === 'Crítica' ? 'text-red-400 border-red-500/20 bg-red-500/10' :
                          task.urgencia === 'Alta' ? 'text-orange-400 border-orange-500/20 bg-orange-500/10' :
                          'text-yellow-400 border-yellow-500/20 bg-yellow-500/10'
                        }`}>{task.urgencia}</span>
                      ) : <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="py-3 px-4 text-xs text-zinc-400" style={{ maxWidth: '200px' }}>
                      {task.situacao ? <span className="block truncate" title={task.situacao}>{task.situacao.split('\n')[0]}</span> : '—'}
                    </td>
                    <td className="py-3 px-4 text-xs whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                        task.statusAndamento === 'Finalizado' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10' :
                        task.statusAndamento === 'Em andamento' ? 'text-amber-400 border-amber-500/20 bg-amber-500/10' :
                        task.statusAndamento === 'Aguardando' ? 'text-blue-400 border-blue-500/20 bg-blue-500/10' :
                        task.statusAndamento === 'Em análise' ? 'text-purple-400 border-purple-500/20 bg-purple-500/10' :
                        'text-zinc-400 border-zinc-500/20 bg-zinc-500/10'
                      }`}>{task.statusAndamento}</span>
                    </td>
                    <td className="py-3 px-4 text-xs text-zinc-300 whitespace-nowrap font-mono">{task.inicio || '—'}</td>
                    <td className="py-3 px-4 text-xs whitespace-nowrap font-mono">
                      <span className={(() => {
                        if (!task.previsaoEntrega) return 'text-zinc-600';
                        const parts = task.previsaoEntrega.split('/');
                        if (parts.length === 3) {
                          let y = parseInt(parts[2]); if (y < 100) y += 2000;
                          const d = new Date(y, parseInt(parts[1]) - 1, parseInt(parts[0]));
                          return d < new Date() && task.statusAndamento !== 'Finalizado' ? 'text-red-400 font-semibold' : 'text-zinc-300';
                        }
                        return 'text-zinc-300';
                      })()}>{task.previsaoEntrega || '—'}</span>
                    </td>
                    <td className="py-3 px-4 text-xs text-zinc-300 whitespace-nowrap font-mono">{task.entregaEfetiva || '—'}</td>
                    <td className="py-3 px-4 text-xs text-zinc-400" style={{ maxWidth: '220px' }}>
                      {task.observacoesRotinas ? <span className="block truncate" title={task.observacoesRotinas}>{task.observacoesRotinas}</span> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <TaskDrawer taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} onUpdate={fetchData} />
    </div>
  );
}
