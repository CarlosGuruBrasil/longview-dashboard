'use client';

import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  MessageSquare,
  SlidersHorizontal,
  RefreshCw
} from 'lucide-react';
import { Task, Project } from '@/lib/db';
import { useUser } from '@/context/UserContext';
import LogoLoader from '@/components/ui/LogoLoader';
import TaskDrawer from '../components/TaskDrawer';
import ResponsibleModal from '../components/ResponsibleModal';
import logger from '@/lib/logger'

export default function KanbanPage() {
  const { currentUser } = useUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [selectedProject, setSelectedProject] = useState('Todos');
  const [selectedUrgencia, setSelectedUrgencia] = useState('Todos');
  const [selectedResp, setSelectedResp] = useState('Todos');

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [selectedRespName, setSelectedRespName] = useState<string | null>(null);

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
      logger.error({ e }, 'Erro ao carregar dados do Kanban:');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchData();
    });
  }, []);

  const responsibles = ['Todos', ...Array.from(new Set(tasks.map(t => t.responsible).filter(Boolean)))];
  const columns: { id: Task['statusAndamento']; title: string; color: string }[] = [
    { id: 'Não iniciado', title: 'Não Iniciado', color: 'border-zinc-700 bg-zinc-900/40 text-zinc-400' },
    { id: 'Em andamento', title: 'Em Andamento', color: 'border-amber-500/20 bg-amber-500/5 text-amber-400' },
    { id: 'Aguardando', title: 'Aguardando', color: 'border-indigo-500/20 bg-indigo-500/5 text-indigo-400' },
    { id: 'Em análise', title: 'Em Análise', color: 'border-cyan-500/20 bg-cyan-500/5 text-cyan-400' },
    { id: 'Finalizado', title: 'Finalizado', color: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400' }
  ];

  // RBAC: Equipe e Parceiros veem apenas as tarefas autorizadas
  const filteredTasks = tasks.filter(task => {
    const matchesProject = selectedProject === 'Todos' || task.projectId === selectedProject;
    const matchesUrgencia = selectedUrgencia === 'Todos' || task.urgencia.toLowerCase() === selectedUrgencia.toLowerCase();
    const matchesResp = selectedResp === 'Todos' || task.responsible.toLowerCase() === selectedResp.toLowerCase();

    let isAuthorized = true;
    if (currentUser.role === 'Parceiro') {
      isAuthorized = task.responsible.toLowerCase().includes(currentUser.name.toLowerCase()) ||
                     task.secondaryResponsibles?.some(r => r.toLowerCase().includes(currentUser.name.toLowerCase())) ||
                     task.responsible === 'Não atribuído' || task.responsible === '-';
    }

    return matchesProject && matchesUrgencia && matchesResp && isAuthorized;
  });

  // Funções de Drag & Drop
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggingTaskId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    setDragOverCol(colId);
  };

  const handleDragLeave = () => {
    setDragOverCol(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: Task['statusAndamento']) => {
    e.preventDefault();
    setDragOverCol(null);
    const id = e.dataTransfer.getData('text/plain') || draggingTaskId;
    
    if (!id) return;

    // RBAC check: Parceiro/Equipe só podem mover tarefas se forem os responsáveis
    const draggedTask = tasks.find(t => t.id === id);
    if (!draggedTask) return;

    const isResponsible = draggedTask.responsible.toLowerCase().includes(currentUser.name.toLowerCase()) ||
                          draggedTask.secondaryResponsibles?.some(r => r.toLowerCase().includes(currentUser.name.toLowerCase()));
    
    const canMove = currentUser.role === 'Desenvolvedor' || currentUser.role === 'Diretoria' || currentUser.role === 'Gestor' || (currentUser.role === 'Parceiro' && isResponsible);
    
    if (!canMove) {
      alert('Você não tem permissão para alterar o status desta tarefa.');
      return;
    }

    // Otimização no cliente (Mudar estado antes de bater na API para efeito ultra-rápido)
    setTasks(prev => prev.map(t => t.id === id ? { ...t, statusAndamento: targetStatus, progress: targetStatus === 'Finalizado' ? 100 : t.progress } : t));

    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          statusAndamento: targetStatus,
          currentUser
        })
      });
      if (!res.ok) {
        // Reverte se der erro
        fetchData();
      }
    } catch (e) {
      logger.error({ e }, 'Erro ao atualizar status do Kanban:');
      fetchData();
    }
  };

  const getUrgenciaDot = (u: Task['urgencia']) => {
    switch (u) {
      case 'Emergencial': return '🔴';
      case 'Crítica': return '🟠';
      case 'Alta': return '🟡';
      case 'Média': return '🔵';
      case 'Baixa': return '⚪';
    }
  };

  return (
    <div className="flex-1 w-full min-h-screen space-y-6 p-4 md:p-6 lg:px-6 lg:py-4 flex flex-col">
      <header className="flex justify-end gap-3 border-b border-[#1C1C1E] pb-4 shrink-0">
          <button 
            onClick={fetchData}
            className="p-2.5 bg-[#121214] hover:bg-[#18181B] border border-[#1E1E22] text-zinc-400 hover:text-white rounded-lg transition-colors flex items-center gap-1.5 text-xs"
            title="Atualizar dados"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
      </header>

      {/* Barra de Filtros e Legenda */}
      <section className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-4 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4.5 shrink-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full xl:w-auto flex-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 shrink-0">
            <SlidersHorizontal size={14} />
            <span>Filtros:</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl">
            {/* Empreendimento */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wide">Empreendimento</span>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="bg-[#0A0A0B] border border-[#1E1E22] rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
              >
                <option value="Todos">Todos</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Urgência */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wide">Urgência</span>
              <select
                value={selectedUrgencia}
                onChange={(e) => setSelectedUrgencia(e.target.value)}
                className="bg-[#0A0A0B] border border-[#1E1E22] rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
              >
                <option value="Todos">Todos</option>
                <option value="Baixa">⚪ Baixa</option>
                <option value="Média">🔵 Média</option>
                <option value="Alta">🟡 Alta</option>
                <option value="Crítica">🟠 Crítica</option>
                <option value="Emergencial">🔴 Emergencial</option>
              </select>
            </div>

            {/* Responsável */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wide">Responsável</span>
              <select
                value={selectedResp}
                onChange={(e) => setSelectedResp(e.target.value)}
                className="bg-[#0A0A0B] border border-[#1E1E22] rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
              >
                {responsibles.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Legenda de Urgência (Bolinhas) */}
        <div className="flex flex-wrap items-center gap-2.5 text-[9px] uppercase font-bold text-zinc-400 tracking-wider">
          <span className="text-zinc-500 text-[8px] tracking-wide block w-full xl:w-auto">Urgência ?!</span>
          <div className="flex items-center gap-1.5 bg-black/35 border border-[#1C1C1E] px-2 py-1 rounded-md">
            <span>🔴</span> <span className="text-zinc-300">Emergencial</span>
          </div>
          <div className="flex items-center gap-1.5 bg-black/35 border border-[#1C1C1E] px-2 py-1 rounded-md">
            <span>🟠</span> <span className="text-zinc-300">Crítica</span>
          </div>
          <div className="flex items-center gap-1.5 bg-black/35 border border-[#1C1C1E] px-2 py-1 rounded-md">
            <span>🟡</span> <span className="text-zinc-300">Alta</span>
          </div>
          <div className="flex items-center gap-1.5 bg-black/35 border border-[#1C1C1E] px-2 py-1 rounded-md">
            <span>🔵</span> <span className="text-zinc-300">Média</span>
          </div>
          <div className="flex items-center gap-1.5 bg-black/35 border border-[#1C1C1E] px-2 py-1 rounded-md">
            <span>⚪</span> <span className="text-zinc-300">Baixa</span>
          </div>
        </div>
      </section>

      {/* Grid de Colunas Kanban */}
      <section className="flex-1 overflow-x-auto flex gap-4 pb-4 select-none scrollbar-thin">
        {loading ? (
          <div className="py-20 text-center flex flex-col items-center justify-center">
            <LogoLoader module="project" text="Carregando quadro..." />
          </div>
        ) : (
          columns.map((column) => {
            const colTasks = filteredTasks.filter(t => t.statusAndamento === column.id);
            const isDragOver = dragOverCol === column.id;

            return (
              <div 
                key={column.id}
                onDragOver={(e) => handleDragOver(e, column.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, column.id)}
                className={`
                  flex-1 min-w-[250px] max-w-[280px] rounded-xl flex flex-col h-full bg-[#121214]/30 border transition-all duration-200
                  ${isDragOver 
                    ? 'border-white bg-[#121214]/75 shadow-[0_0_20px_rgba(255,255,255,0.03)] scale-[1.01]' 
                    : 'border-[#1C1C1E]'
                  }
                `}
              >
                {/* Header da Coluna */}
                <div className={`p-3 border-b rounded-t-xl flex justify-between items-center ${column.color}`}>
                  <span className="text-[11px] font-bold uppercase tracking-wider">{column.title}</span>
                  <span className="text-[10px] font-mono font-bold bg-[#1C1C1E]/80 text-zinc-400 px-2 py-0.5 rounded-full border border-[#2B2B30]">
                    {colTasks.length}
                  </span>
                </div>

                {/* Área de Cartões */}
                <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 max-h-[calc(100vh-270px)] scrollbar-thin">
                  {colTasks.length === 0 ? (
                    <div className="py-8 text-center text-[10px] text-zinc-600 border border-dashed border-[#1C1C1E] rounded-lg">
                      Arraste itens aqui
                    </div>
                  ) : (
                    colTasks.map((task) => (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        onClick={() => setSelectedTaskId(task.id)}
                        className={`
                          bg-[#121214]/90 hover:bg-[#18181B] border border-[#1E1E22] p-3 rounded-lg cursor-grab active:cursor-grabbing hover:border-zinc-700 transition-all duration-200 space-y-2.5
                          ${task.urgencia === 'Emergencial' ? 'glow-white-sm border-red-500/20' : ''}
                        `}
                      >
                        {/* ID */}
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-mono text-zinc-500">{task.id}</span>
                          {task.urgencia !== 'Baixa' && (
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${
                              task.urgencia === 'Emergencial' ? 'text-red-300 bg-red-500/10 border-red-500/20' :
                              task.urgencia === 'Crítica' ? 'text-orange-400 bg-orange-500/10 border-orange-500/20' :
                              task.urgencia === 'Alta' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                              'text-blue-400 bg-blue-500/10 border-blue-500/20'
                            }`}>{task.urgencia}</span>
                          )}
                        </div>

                        {/* Empreendimento — destaque */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-white bg-white/10 border border-white/15 px-2 py-0.5 rounded-md tracking-wide">
                            {task.project}
                          </span>
                        </div>

                        {/* Título / Assunto */}
                        <p className="text-xs text-zinc-100 font-semibold line-clamp-2 leading-relaxed">
                          {task.subject}
                        </p>

                        {/* Progresso da Tarefa */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[9px] font-bold text-zinc-400">
                            <span>Progresso</span>
                            <span className="font-mono text-zinc-200">{task.progress}%</span>
                          </div>
                          <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
                            <div className={`h-1 rounded-full transition-all ${
                              task.progress === 100 ? 'bg-emerald-500' :
                              task.progress >= 60 ? 'bg-lime-500' :
                              task.progress >= 30 ? 'bg-amber-500' :
                              'bg-zinc-500'
                            }`} style={{ width: `${task.progress}%` }} />
                          </div>
                        </div>

                        {/* Metadados: Responsável, Comentários, Subtarefas */}
                        <div className="flex items-center justify-between border-t border-[#1C1C1E] pt-2.5">
                          {/* Responsável — destaque */}
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRespName(task.responsible);
                            }}
                            className="flex items-center gap-1 overflow-hidden max-w-[140px] cursor-pointer group/resp"
                          >
                            <div className="w-5 h-5 rounded-full bg-zinc-700 border border-zinc-600 flex items-center justify-center text-[8px] font-bold text-white shrink-0">
                              {task.responsible !== 'Não atribuído' ? task.responsible.charAt(0).toUpperCase() : '?'}
                            </div>
                            <span className="text-[10px] truncate text-zinc-200 group-hover/resp:text-white group-hover/resp:underline font-semibold">{task.responsible}</span>
                          </div>

                          {/* Urgência e Ícones */}
                          <div className="flex items-center gap-2 text-[9px] shrink-0">
                            {/* Comentários */}
                            {task.comments.length > 0 && (
                              <div className="flex items-center gap-0.5">
                                <MessageSquare size={9} />
                                <span>{task.comments.length}</span>
                              </div>
                            )}

                            {/* Subtarefas */}
                            {task.subtasks.length > 0 && (
                              <div className="flex items-center gap-0.5">
                                <CheckSquare size={9} />
                                <span>
                                  {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}
                                </span>
                              </div>
                            )}

                            {/* Urgência */}
                            <span title={`Urgência: ${task.urgencia}`}>
                              {getUrgenciaDot(task.urgencia)}
                            </span>
                          </div>

                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* Drawer de Visualização/Edição de Tarefa */}
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
    </div>
  );
}
