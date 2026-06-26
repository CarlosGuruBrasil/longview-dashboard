'use client';

import React, { useState, useEffect } from 'react';
import {
  SlidersHorizontal,
  RefreshCw,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Calendar
} from 'lucide-react';
import { Task, Project } from '@/lib/db';
import { useUser } from '@/context/UserContext';
import TaskDrawer from '@/components/TaskDrawer';
import ResponsibleModal from '@/components/ResponsibleModal';

export default function TimelinePage() {
  const { currentUser } = useUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState('Todos');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedRespName, setSelectedRespName] = useState<string | null>(null);
  // Navegação de meses (0 = mês atual)
  const [monthOffset, setMonthOffset] = useState(0);

  // Janela dinâmica: 2 meses a partir do offset
  const _today = new Date();
  const START_DATE = new Date(_today.getFullYear(), _today.getMonth() + monthOffset, 1);
  const END_DATE = new Date(_today.getFullYear(), _today.getMonth() + monthOffset + 2, 0);
  const TOTAL_DAYS = Math.round((END_DATE.getTime() - START_DATE.getTime()) / (24 * 60 * 60 * 1000)) + 1;

  // Labels dinâmicos para a régua
  const _month1 = new Date(_today.getFullYear(), _today.getMonth() + monthOffset, 1);
  const _month2 = new Date(_today.getFullYear(), _today.getMonth() + monthOffset + 1, 1);
  const _daysInMonth1 = new Date(_today.getFullYear(), _today.getMonth() + monthOffset + 1, 0).getDate();
  const _widthPct1 = Math.round((_daysInMonth1 / TOTAL_DAYS) * 100);
  const _labelMonth1 = _month1.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
  const _labelMonth2 = _month2.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

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
      console.error('Erro ao carregar dados da Timeline:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchData();
    });
  }, []);

  // Helper para fazer o parse das datas do CSV
  const parseDate = (dateStr: string): Date | null => {
    if (!dateStr || dateStr === '-') return null;
    
    // Tratamento básico para formatos informais como "JUNHO"
    if (dateStr.toLowerCase().includes('junho')) {
      return new Date('2026-06-15');
    }
    if (dateStr.toLowerCase().includes('maio')) {
      return new Date('2026-05-15');
    }

    const parts = dateStr.split('/');
    if (parts.length === 3) {
      let year = parseInt(parts[2]);
      if (year < 100) year += 2000;
      const month = parseInt(parts[1]) - 1;
      const day = parseInt(parts[0]);
      return new Date(year, month, day);
    }
    return null;
  };

  // Calcula posicionamento e largura na timeline
  const calculateBarPosition = (inicioStr: string, previsaoStr: string) => {
    const defaultPosition = { left: '15%', width: '40%', isEstimated: true };
    
    const dateInicio = parseDate(inicioStr);
    const datePrevisao = parseDate(previsaoStr);

    if (!dateInicio && !datePrevisao) {
      return defaultPosition;
    }

    // Se só tem a previsão de entrega, assume que iniciou 10 dias antes
    const actualInicio = dateInicio || (datePrevisao ? new Date(datePrevisao.getTime() - 10 * 24 * 60 * 60 * 1000) : START_DATE);
    const actualPrevisao = datePrevisao || (dateInicio ? new Date(dateInicio.getTime() + 10 * 24 * 60 * 60 * 1000) : END_DATE);

    // Limita datas dentro da janela da timeline para renderização correta
    const plotStart = actualInicio < START_DATE ? START_DATE : actualInicio;
    const plotEnd = actualPrevisao > END_DATE ? END_DATE : actualPrevisao;

    if (plotEnd < plotStart) {
      return defaultPosition;
    }

    const diffStartMs = plotStart.getTime() - START_DATE.getTime();
    const diffDurationMs = plotEnd.getTime() - plotStart.getTime();

    const leftPercent = (diffStartMs / (TOTAL_DAYS * 24 * 60 * 60 * 1000)) * 100;
    const widthPercent = (diffDurationMs / (TOTAL_DAYS * 24 * 60 * 60 * 1000)) * 100;

    // Garante limites visuais mínimos
    return {
      left: `${Math.max(0, Math.min(95, leftPercent))}%`,
      width: `${Math.max(8, Math.min(100 - leftPercent, widthPercent))}%`,
      isEstimated: !dateInicio || !datePrevisao
    };
  };

  // Determinar a cor da barra do Gantt conforme regras de status do prompt
  const getBarColor = (task: Task) => {
    if (task.statusAndamento === 'Finalizado') {
      return 'bg-emerald-500 hover:bg-emerald-400 border border-emerald-400/20'; // verde = finalizado
    }
    
    const datePrevisao = parseDate(task.previsaoEntrega);
    if (datePrevisao && datePrevisao < new Date()) {
      return 'bg-red-500 hover:bg-red-400 border border-red-400/20'; // vermelho = atrasado
    }

    if (task.statusAndamento === 'Em andamento') {
      return 'bg-amber-500 hover:bg-amber-400 border border-amber-400/20'; // amarelo = andamento
    }

    return 'bg-zinc-600 hover:bg-zinc-500 border border-zinc-500/20'; // cinza = não iniciado ou aguardando
  };

  // Filtros
  const filteredTasks = tasks.filter(task => {
    const matchesProject = selectedProject === 'Todos' || task.project.toLowerCase() === selectedProject.toLowerCase();
    
    // Regra RBAC para parceiro
    let isAuthorized = true;
    if (currentUser.role === 'Parceiro') {
      isAuthorized = task.responsible.toLowerCase().includes(currentUser.name.toLowerCase()) ||
                     task.secondaryResponsibles?.some(r => r.toLowerCase().includes(currentUser.name.toLowerCase())) ||
                     task.responsible === 'Não atribuído' || task.responsible === '-';
    }

    // Filtra tarefas que possuam previsão ou início para não poluir o Gantt com itens não-planejados
    const hasTimeline = task.inicio || task.previsaoEntrega;

    return matchesProject && isAuthorized && hasTimeline;
  });

  return (
    <div className="flex-1 w-full space-y-6 p-4 md:p-6 lg:px-6 lg:py-4 flex flex-col min-h-screen">
      <header className="flex justify-end gap-3 border-b border-[#1C1C1E] pb-4 shrink-0">
          <button 
            onClick={fetchData}
            className="p-2.5 bg-[#121214] hover:bg-[#18181B] border border-[#1E1E22] text-zinc-400 hover:text-white rounded-lg transition-colors flex items-center gap-1.5 text-xs"
            title="Atualizar dados"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
      </header>

      {/* Filtros + Navegação */}
      <section className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-4 space-y-3 shrink-0">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400">
            <SlidersHorizontal size={14} />
            <span>Filtro:</span>
          </div>

          <div className="w-56">
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full bg-[#0A0A0B] border border-[#1E1E22] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
            >
              <option value="Todos">Todos os Empreendimentos</option>
              {projects.map(p => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Navegação de meses */}
          <div className="flex items-center gap-2 ml-2">
            <button
              onClick={() => setMonthOffset(o => o - 1)}
              className="p-1.5 bg-[#0A0A0B] border border-[#1E1E22] rounded-lg text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
              title="Mês anterior"
            >
              <ChevronLeft size={14} />
            </button>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A0A0B] border border-[#1E1E22] rounded-lg text-xs text-white font-semibold min-w-48 justify-center">
              <Calendar size={12} className="text-zinc-400" />
              <span>{_labelMonth1} → {_labelMonth2}</span>
            </div>
            <button
              onClick={() => setMonthOffset(o => o + 1)}
              className="p-1.5 bg-[#0A0A0B] border border-[#1E1E22] rounded-lg text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
              title="Próximo mês"
            >
              <ChevronRight size={14} />
            </button>
            {monthOffset !== 0 && (
              <button
                onClick={() => setMonthOffset(0)}
                className="text-[10px] text-zinc-500 hover:text-white transition-colors px-2 py-1 border border-[#1E1E22] rounded-lg bg-[#0A0A0B]"
              >
                Hoje
              </button>
            )}
          </div>

          {/* Legenda de cores */}
          <div className="flex flex-wrap items-center gap-3 text-[10px] uppercase font-bold text-zinc-400 tracking-wider ml-auto">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-emerald-500" />
              <span>Finalizado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-amber-500" />
              <span>Em Andamento</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-red-500" />
              <span>Atrasado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-zinc-600" />
              <span>Não Iniciado</span>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        {!loading && (
          <div className="flex items-center gap-4 text-[10px] text-zinc-500 border-t border-[#1C1C1E] pt-3">
            <span className="font-bold text-zinc-400">{filteredTasks.length} tarefas com cronograma planejado</span>
            <span>·</span>
            <span className="text-emerald-400 font-semibold">{filteredTasks.filter(t => t.statusAndamento === 'Finalizado').length} finalizadas</span>
            <span className="text-amber-400 font-semibold">{filteredTasks.filter(t => t.statusAndamento === 'Em andamento').length} em andamento</span>
            <span className="text-red-400 font-semibold">{filteredTasks.filter(t => {
              if (t.statusAndamento === 'Finalizado' || !t.previsaoEntrega) return false;
              const p = t.previsaoEntrega.split('/');
              if (p.length !== 3) return false;
              let y = parseInt(p[2]); if (y < 100) y += 2000;
              return new Date(y, parseInt(p[1]) - 1, parseInt(p[0])) < new Date();
            }).length} atrasadas</span>
          </div>
        )}
      </section>

      {/* Gantt Container */}
      <section className="flex-1 bg-[#121214]/60 border border-[#1E1E22] rounded-xl overflow-hidden flex flex-col shadow-2xl">
        
        {/* Régua da Linha do Tempo (Meses e Dias) */}
        <div className="flex border-b border-[#1C1C1E] bg-[#0E0E10]/90 shrink-0 select-none">
          {/* Coluna de Identificadores das tarefas */}
          <div className="w-72 border-r border-[#1C1C1E] p-3 text-[10px] uppercase font-bold text-zinc-400 tracking-wider shrink-0">
            Tarefa / Empreendimento
          </div>
          
          {/* Régua Temporal */}
          <div className="flex-1 relative flex">
            <div style={{ width: `${_widthPct1}%` }} className="border-r border-[#1C1C1E] py-2 text-center text-xs font-bold text-white uppercase tracking-wider">
              {_labelMonth1}
            </div>
            <div style={{ width: `${100 - _widthPct1}%` }} className="py-2 text-center text-xs font-bold text-white uppercase tracking-wider">
              {_labelMonth2}
            </div>

            {/* Linhas de Grade de fundo (semanas) */}
            <div className="absolute inset-0 flex pointer-events-none opacity-10 pt-8">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="flex-1 border-r border-white h-96" />
              ))}
            </div>
          </div>
        </div>

        {/* Linhas do Gantt */}
        <div className="flex-1 overflow-y-auto max-h-[calc(100vh-280px)] divide-y divide-[#1C1C1E]">
          {loading ? (
            <div className="py-20 text-center text-zinc-500 flex flex-col items-center justify-center gap-2">
              <RefreshCw size={24} className="animate-spin text-zinc-400" />
              <p className="text-sm">Carregando cronograma...</p>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="py-20 text-center text-zinc-500">
              Nenhuma tarefa com cronograma planejado atende a esses critérios.
            </div>
          ) : (
            filteredTasks.map((task) => {
              const position = calculateBarPosition(task.inicio, task.previsaoEntrega);
              
              return (
                <div key={task.id} className="flex items-center hover:bg-white/[0.01] transition-colors group">
                  {/* Informações da Tarefa */}
                  <div className="w-72 border-r border-[#1C1C1E] p-3 shrink-0 overflow-hidden flex flex-col justify-center">
                    <span className="text-[9px] font-mono text-zinc-500">{task.id}</span>
                    <span 
                      onClick={() => setSelectedTaskId(task.id)}
                      className="text-xs font-semibold text-white truncate cursor-pointer hover:text-white/80 transition-colors"
                      title={task.subject}
                    >
                      {task.subject}
                    </span>
                    <div className="flex items-center gap-1.5 text-[9px] text-zinc-500 mt-1">
                      <span className="font-semibold text-zinc-400">{task.project}</span>
                      <span>•</span>
                      <span 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRespName(task.responsible);
                        }}
                        className="truncate hover:underline hover:text-white cursor-pointer font-medium"
                      >
                        {task.responsible}
                      </span>
                    </div>
                  </div>

                  {/* Espaço da Barra Temporal */}
                  <div className="flex-1 relative h-12 flex items-center px-2">
                    {/* Barra do Gantt */}
                    <div 
                      onClick={() => setSelectedTaskId(task.id)}
                      style={{ left: position.left, width: position.width }}
                      className={`
                        absolute h-6 rounded-md cursor-pointer transition-all duration-300 flex items-center justify-between px-2.5 text-[9px] font-bold text-white shadow-lg z-10
                        ${getBarColor(task)}
                      `}
                    >
                      <span className="truncate max-w-[80%]">
                        {task.inicio || 'Est.'} → {task.previsaoEntrega || 'Est.'}
                      </span>
                      {position.isEstimated && (
                        <span title="Datas estimadas pelo sistema">
                          <HelpCircle size={10} className="text-white/80" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
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
    </div>
  );
}
