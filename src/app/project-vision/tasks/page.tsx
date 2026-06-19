'use client';

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  SlidersHorizontal,
  ChevronDown,
  Building2,
  Calendar,
  AlertCircle,
  Clock,
  User,
  CheckCircle2,
  FileText,
  RefreshCw,
  FolderOpen,
  X
} from 'lucide-react';
import { Task, Project } from '@/lib/db';
import { useUser } from '@/context/UserContext';
import TaskDrawer from '@/components/TaskDrawer';
import ResponsibleModal from '@/components/ResponsibleModal';

export default function TasksPage() {
  const { currentUser } = useUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados dos filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState('Todos');
  const [selectedSector, setSelectedSector] = useState('Todos');
  const [selectedStatus, setSelectedStatus] = useState('Todos');
  const [selectedUrgencia, setSelectedUrgencia] = useState('Todos');
  const [selectedResponsible, setSelectedResponsible] = useState('Todos');
  const [selectedContratacao, setSelectedContratacao] = useState('Todos');

  // Estados dos modais / Drawers
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedRespName, setSelectedRespName] = useState<string | null>(null);

  // Formulário de Nova Tarefa
  const [newProject, setNewProject] = useState('Villa Alta');
  const [newSector, setNewSector] = useState('Projetos');
  const [newSubject, setNewSubject] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newResp, setNewResp] = useState('');
  const [newStatusContratacao, setNewStatusContratacao] = useState('Indefinido');
  const [newUrgencia, setNewUrgencia] = useState<'Baixa' | 'Média' | 'Alta' | 'Crítica' | 'Emergencial'>('Baixa');
  const [newInicio, setNewInicio] = useState('');
  const [newPrevisao, setNewPrevisao] = useState('');

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
      console.error('Erro ao carregar dados:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchData();
    });
  }, []);

  // Extrair opções únicas para os filtros
  const sectors = ['Todos', ...Array.from(new Set(tasks.map(t => t.sector).filter(Boolean)))];
  const responsibles = ['Todos', ...Array.from(new Set(tasks.map(t => t.responsible).filter(Boolean)))];
  const statuses = ['Todos', 'Não iniciado', 'Em andamento', 'Aguardando', 'Em análise', 'Finalizado'];
  const urgencies = ['Todos', 'Baixa', 'Média', 'Alta', 'Crítica', 'Emergencial'];
  const contratacoes = ['Todos', ...Array.from(new Set(tasks.map(t => t.statusContratacao).filter(Boolean)))];

  // Aplicar filtros localmente no cliente para velocidade extrema
  const filteredTasks = tasks.filter(task => {
    // Busca textual global
    const matchesSearch = !searchQuery ? true : (
      task.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.responsible.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.sector.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.project.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const matchesProject = selectedProject === 'Todos' || task.project.toLowerCase() === selectedProject.toLowerCase();
    const matchesSector = selectedSector === 'Todos' || task.sector.toLowerCase() === selectedSector.toLowerCase();
    const matchesStatus = selectedStatus === 'Todos' || task.statusAndamento.toLowerCase() === selectedStatus.toLowerCase();
    const matchesUrgencia = selectedUrgencia === 'Todos' || task.urgencia.toLowerCase() === selectedUrgencia.toLowerCase();
    const matchesResp = selectedResponsible === 'Todos' || task.responsible.toLowerCase() === selectedResponsible.toLowerCase();
    const matchesContratacao = selectedContratacao === 'Todos' || task.statusContratacao.toLowerCase() === selectedContratacao.toLowerCase();

    // Regra RBAC para Equipe Interna e Parceiros
    let isAuthorized = true;
    if (currentUser.role === 'Parceiro') {
      // Parceiros enxergam apenas as tarefas atribuídas a eles
      isAuthorized = task.responsible.toLowerCase().includes(currentUser.name.toLowerCase()) ||
                     task.secondaryResponsibles?.some(r => r.toLowerCase().includes(currentUser.name.toLowerCase())) ||
                     task.responsible === 'Não atribuído' || task.responsible === '-';
    }

    return matchesSearch && matchesProject && matchesSector && matchesStatus && matchesUrgencia && matchesResp && matchesContratacao && isAuthorized;
  });

  // Limpar Filtros
  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedProject('Todos');
    setSelectedSector('Todos');
    setSelectedStatus('Todos');
    setSelectedUrgencia('Todos');
    setSelectedResponsible('Todos');
    setSelectedContratacao('Todos');
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim()) return;

    const payload = {
      project: newProject,
      sector: newSector,
      subject: newSubject.trim(),
      description: newDesc.trim(),
      responsible: newResp.trim() || 'Não atribuído',
      statusContratacao: newStatusContratacao,
      statusAndamento: 'Não iniciado',
      urgencia: newUrgencia,
      inicio: newInicio,
      previsaoEntrega: newPrevisao,
      progress: 0,
      userName: currentUser.name
    };

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setCreateModalOpen(false);
        setNewSubject('');
        setNewDesc('');
        setNewResp('');
        setNewInicio('');
        setNewPrevisao('');
        fetchData();
        alert('Tarefa criada com sucesso!');
      }
    } catch (e) {
      console.error('Erro ao criar tarefa:', e);
    }
  };

  const getUrgenciaEmoji = (u: Task['urgencia']) => {
    switch (u) {
      case 'Emergencial': return '🔴 Emergencial';
      case 'Crítica': return '🟠 Crítica';
      case 'Alta': return '🟡 Alta';
      case 'Média': return '🔵 Média';
      case 'Baixa': return '⚪ Baixa';
    }
  };

  const getStatusColor = (s: Task['statusAndamento']) => {
    switch (s) {
      case 'Finalizado': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30';
      case 'Em andamento': return 'bg-amber-500/10 text-amber-400 border border-amber-500/30';
      case 'Em análise': return 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30';
      case 'Aguardando': return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30';
      default: return 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/30';
    }
  };

  return (
    <div className="flex-1 p-6 lg:p-10 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#1C1C1E] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-400">
              Dashboard Operacional
            </span>
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-white mt-1">Gestão de Tarefas</h2>
          <p className="text-sm text-zinc-400 mt-0.5">Visão tabular consolidada de todas as operações.</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={fetchData}
            className="p-2.5 bg-[#121214] hover:bg-[#18181B] border border-[#1E1E22] text-zinc-400 hover:text-white rounded-lg transition-colors flex items-center gap-1.5 text-xs"
            title="Atualizar dados"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          {(currentUser.role === 'Desenvolvedor' || currentUser.role === 'Diretoria' || currentUser.role === 'Operador' || currentUser.role === 'Gestor' || currentUser.permissions?.manageProjects) && (
            <button 
              onClick={() => setCreateModalOpen(true)}
              className="bg-white hover:bg-zinc-200 text-black px-4.5 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all duration-200"
            >
              <Plus size={16} />
              <span>Nova Tarefa</span>
            </button>
          )}
        </div>
      </header>

      {/* Painel de Filtros e Busca */}
      <section className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-4.5 space-y-4">
        {/* Linha 1: Busca e Ações Rápidas */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3.5 top-3.5 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Buscar por ID, assunto, responsável, setor, empreendimento..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0A0A0B] border border-[#1E1E22] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-zinc-700 transition-colors"
            />
          </div>
          {(selectedProject !== 'Todos' || selectedSector !== 'Todos' || selectedStatus !== 'Todos' || selectedUrgencia !== 'Todos' || selectedResponsible !== 'Todos' || selectedContratacao !== 'Todos' || searchQuery !== '') && (
            <button 
              onClick={handleClearFilters}
              className="px-4 py-2.5 text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg transition-all"
            >
              Limpar Filtros
            </button>
          )}
        </div>

        {/* Linha 2: Filtros Estruturados */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {/* Empreendimento */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Empreendimento</span>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="bg-[#0A0A0B] border border-[#1E1E22] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
            >
              <option value="Todos">Todos</option>
              {projects.map(p => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Setor */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Setor / Área</span>
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="bg-[#0A0A0B] border border-[#1E1E22] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
            >
              {sectors.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Status Andamento */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Andamento</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-[#0A0A0B] border border-[#1E1E22] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
            >
              {statuses.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Urgência */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Urgência ?!</span>
            <select
              value={selectedUrgencia}
              onChange={(e) => setSelectedUrgencia(e.target.value)}
              className="bg-[#0A0A0B] border border-[#1E1E22] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
            >
              {urgencies.map(u => (
                <option key={u} value={u}>{u === 'Todos' ? 'Todos' : getUrgenciaEmoji(u as Task['urgencia'])}</option>
              ))}
            </select>
          </div>

          {/* Responsável */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Responsável</span>
            <select
              value={selectedResponsible}
              onChange={(e) => setSelectedResponsible(e.target.value)}
              className="bg-[#0A0A0B] border border-[#1E1E22] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
            >
              {responsibles.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Contratação */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Contratação</span>
            <select
              value={selectedContratacao}
              onChange={(e) => setSelectedContratacao(e.target.value)}
              className="bg-[#0A0A0B] border border-[#1E1E22] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
            >
              {contratacoes.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Tabela de Tarefas */}
      <section className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          {loading ? (
            <div className="p-10 text-center text-zinc-500 flex flex-col items-center justify-center gap-3">
              <RefreshCw size={24} className="animate-spin text-zinc-400" />
              <p className="text-sm">Carregando banco de dados...</p>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="p-16 text-center text-zinc-500 flex flex-col items-center justify-center gap-3">
              <FolderOpen size={32} className="text-zinc-600" />
              <p className="text-sm font-medium">Nenhuma tarefa corresponde aos filtros aplicados.</p>
              <button 
                onClick={handleClearFilters}
                className="mt-2 text-xs font-semibold text-white bg-zinc-800 hover:bg-zinc-700 px-3.5 py-2 rounded-lg border border-zinc-700 transition-colors"
              >
                Limpar Filtros
              </button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse" style={{ minWidth: '1500px' }}>
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-[#1C1C1E] bg-[#0E0E10] text-[10px] uppercase font-bold text-zinc-300 tracking-wider">
                  <th className="py-3.5 px-4 whitespace-nowrap">ID</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Empreendimento</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Geral</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Assunto</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Responsável pela Execução</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Status da Contratação</th>
                  <th className="py-3.5 px-4 whitespace-nowrap text-center">?!</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Situação</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Status Andamento</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Início</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Previsão de Entrega</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Entrega Efetiva</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Observações e Rotinas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1C1C1E]">
                {filteredTasks.map((task) => {
                  const isLate = (() => {
                    if (task.statusAndamento === 'Finalizado' || !task.previsaoEntrega) return false;
                    const p = task.previsaoEntrega.split('/');
                    if (p.length !== 3) return false;
                    let y = parseInt(p[2]); if (y < 100) y += 2000;
                    return new Date(y, parseInt(p[1]) - 1, parseInt(p[0])) < new Date();
                  })();
                  return (
                    <tr
                      key={task.id}
                      onClick={() => setSelectedTaskId(task.id)}
                      className="hover:bg-white/[0.02] cursor-pointer transition-colors duration-150 group"
                    >
                      <td className="py-3 px-4 font-mono text-xs font-bold text-zinc-400 whitespace-nowrap group-hover:text-zinc-200">{task.id}</td>
                      <td className="py-3 px-4 text-xs font-bold text-white whitespace-nowrap">{task.project}</td>
                      <td className="py-3 px-4 text-xs text-zinc-300 whitespace-nowrap">{task.sector}</td>
                      <td className="py-3 px-4 text-xs text-white font-medium" style={{ maxWidth: '220px' }}>
                        <span className="block truncate" title={task.subject}>{task.subject}</span>
                      </td>
                      <td
                        onClick={(e) => { e.stopPropagation(); setSelectedRespName(task.responsible); }}
                        className="py-3 px-4 text-xs text-zinc-300 hover:text-white hover:underline cursor-pointer font-semibold whitespace-nowrap"
                      >{task.responsible}</td>
                      <td className="py-3 px-4 text-xs whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border ${
                          task.statusContratacao?.toLowerCase().includes('contratado') && !task.statusContratacao?.toLowerCase().includes('não')
                            ? 'text-blue-400 border-blue-500/20 bg-blue-500/10'
                            : task.statusContratacao?.toLowerCase().includes('não será')
                            ? 'text-zinc-500 border-zinc-600/20 bg-zinc-600/10'
                            : task.statusContratacao?.toLowerCase().includes('andamento')
                            ? 'text-amber-400 border-amber-500/20 bg-amber-500/10'
                            : 'text-zinc-400 border-zinc-500/20 bg-zinc-500/10'
                        }`}>{task.statusContratacao || '—'}</span>
                      </td>
                      <td className="py-3 px-4 text-center text-xs whitespace-nowrap">
                        {task.urgencia !== 'Baixa' ? (
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-semibold border ${
                            task.urgencia === 'Emergencial' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                            task.urgencia === 'Crítica' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                            task.urgencia === 'Alta' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                            'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          }`}>{task.urgencia}</span>
                        ) : <span className="text-zinc-600 text-xs">—</span>}
                      </td>
                      <td className="py-3 px-4 text-xs text-zinc-400" style={{ maxWidth: '180px' }}>
                        {task.situacao ? <span className="block truncate" title={task.situacao}>{task.situacao.split('\n')[0]}</span> : '—'}
                      </td>
                      <td className="py-3 px-4 text-xs whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase ${getStatusColor(task.statusAndamento)}`}>
                          {task.statusAndamento}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-zinc-400 whitespace-nowrap">{task.inicio || '—'}</td>
                      <td className={`py-3 px-4 text-xs font-mono whitespace-nowrap font-semibold ${isLate ? 'text-red-400' : 'text-zinc-400'}`}>
                        {task.previsaoEntrega || '—'}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-zinc-400 whitespace-nowrap">{task.entregaEfetiva || '—'}</td>
                      <td className="py-3 px-4 text-xs text-zinc-400" style={{ maxWidth: '200px' }}>
                        {task.observacoesRotinas ? <span className="block truncate" title={task.observacoesRotinas}>{task.observacoesRotinas}</span> : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Drawer de Detalhes da Tarefa */}
      <TaskDrawer 
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onUpdate={fetchData}
      />

      {/* Modal de Detalhes do Responsável */}
      <ResponsibleModal 
        responsibleName={selectedRespName}
        onClose={() => setSelectedRespName(null)}
        onSelectTask={(id) => setSelectedTaskId(id)}
      />

      {/* Modal de Criação de Tarefa (RBAC Diretoria) */}
      {createModalOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in" onClick={() => setCreateModalOpen(false)} />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-50 animate-in zoom-in-95 duration-200">
            <div className="bg-[#09090B] border border-[#1E1E22] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col justify-between">
              
              <div className="p-5 border-b border-[#1C1C1E] flex justify-between items-center bg-[#121214]/60">
                <h3 className="text-base font-bold text-white">Criar Nova Tarefa Operacional</h3>
                <button onClick={() => setCreateModalOpen(false)} className="p-1 hover:bg-white/5 text-zinc-400 hover:text-white rounded-lg">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateTask} className="p-6 space-y-4 overflow-y-auto max-h-[480px]">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Empreendimento</label>
                    <select
                      value={newProject}
                      onChange={(e) => setNewProject(e.target.value)}
                      className="bg-[#121214] border border-[#1E1E22] rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                    >
                      {projects.map(p => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Setor / Área</label>
                    <select
                      value={newSector}
                      onChange={(e) => setNewSector(e.target.value)}
                      className="bg-[#121214] border border-[#1E1E22] rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                    >
                      <option value="Projetos">Projetos</option>
                      <option value="Processos">Processos</option>
                      <option value="Documentação">Documentação</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Ambiental">Ambiental</option>
                      <option value="Comercial">Comercial</option>
                      <option value="Gestão">Gestão</option>
                      <option value="Obra">Obra</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider font-semibold">Assunto / Assunto</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Obtenção de Licença Ambiental de Instalação (LAI)..."
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    className="bg-[#121214] border border-[#1E1E22] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-700"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Descrição / Escopo</label>
                  <textarea
                    rows={3}
                    placeholder="Detalhamento operacional da atividade..."
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="bg-[#121214] border border-[#1E1E22] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-700 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Responsável Execução</label>
                    <input
                      type="text"
                      placeholder="Ex: Margarete / Carol"
                      value={newResp}
                      onChange={(e) => setNewResp(e.target.value)}
                      className="bg-[#121214] border border-[#1E1E22] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-700"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Urgência ?!</label>
                    <select
                      value={newUrgencia}
                      onChange={(e) => setNewUrgencia(e.target.value as typeof newUrgencia)}
                      className="bg-[#121214] border border-[#1E1E22] rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                    >
                      <option value="Baixa">⚪ Baixa</option>
                      <option value="Média">🔵 Média</option>
                      <option value="Alta">🟡 Alta</option>
                      <option value="Crítica">🟠 Crítica</option>
                      <option value="Emergencial">🔴 Emergencial</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Início</label>
                    <input
                      type="text"
                      placeholder="DD/MM/AAAA"
                      value={newInicio}
                      onChange={(e) => setNewInicio(e.target.value)}
                      className="bg-[#121214] border border-[#1E1E22] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-700"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Previsão Entrega</label>
                    <input
                      type="text"
                      placeholder="DD/MM/AAAA"
                      value={newPrevisao}
                      onChange={(e) => setNewPrevisao(e.target.value)}
                      className="bg-[#121214] border border-[#1E1E22] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-700"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-[#1C1C1E]">
                  <button 
                    type="button" 
                    onClick={() => setCreateModalOpen(false)}
                    className="bg-transparent hover:bg-white/5 border border-zinc-700 text-zinc-300 px-4 py-2 rounded-lg text-xs font-semibold"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="bg-white hover:bg-zinc-200 text-black px-4.5 py-2 rounded-lg text-xs font-semibold"
                  >
                    Criar Tarefa
                  </button>
                </div>
              </form>

            </div>
          </div>
        </>
      )}

    </div>
  );
}
