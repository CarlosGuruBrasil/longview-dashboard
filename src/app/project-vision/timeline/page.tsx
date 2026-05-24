'use client';

import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  CalendarRange, 
  SlidersHorizontal,
  RefreshCw,
  Clock,
  ArrowRight,
  HelpCircle
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

  // Escala da timeline: Maio/Junho de 2026 (foco principal dos dados do CSV)
  const START_DATE = new Date('2026-05-01');
  const END_DATE = new Date('2026-06-30');
  const TOTAL_DAYS = 61; // 31 em maio + 30 em junho

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
    
    // Verifica se está atrasada (não finalizada e previsao passou da data simulated)
    const SIMULATED_NOW = new Date('2026-05-23');
    const datePrevisao = parseDate(task.previsaoEntrega);
    if (datePrevisao && datePrevisao < SIMULATED_NOW) {
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
    <div className="flex-1 p-6 lg:p-10 space-y-6 max-w-7xl mx-auto w-full flex flex-col min-h-screen">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#1C1C1E] pb-6 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-400">
              Planejamento Temporal
            </span>
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-white mt-1">Timeline Operacional (Gantt)</h2>
          <p className="text-sm text-zinc-400 mt-0.5">Visualize prazos, marcos e atrasos ao longo do cronograma corporativo.</p>
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

      {/* Filtros */}
      <section className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-4 flex flex-wrap items-center gap-4 shrink-0">
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400">
          <SlidersHorizontal size={14} />
          <span>Filtro de Cronograma:</span>
        </div>

        <div className="w-64">
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

        {/* Legenda de cores */}
        <div className="flex flex-wrap items-center gap-4 text-[10px] uppercase font-bold text-zinc-400 tracking-wider ml-auto">
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
            {/* Mês de Maio */}
            <div className="w-[51%] border-r border-[#1C1C1E] py-2 text-center text-xs font-bold text-white uppercase tracking-wider">
              Maio 2026
            </div>
            {/* Mês de Junho */}
            <div className="w-[49%] py-2 text-center text-xs font-bold text-white uppercase tracking-wider">
              Junho 2026
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
