'use client';

import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Clock, 
  AlertOctagon, 
  CheckCircle2, 
  TrendingUp, 
  Users,
  Activity,
  Bell,
  ArrowRight,
  ShieldAlert,
  SlidersHorizontal,
  RefreshCw,
  FileCheck
} from 'lucide-react';
import { Task, Project } from '@/lib/db';
import Link from 'next/link';
import TaskDrawer from '@/components/TaskDrawer';
import ResponsibleModal from '@/components/ResponsibleModal';

// Componentes do Recharts importados dinamicamente para evitar erro de hidratação no Next.js
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  LineChart,
  Line,
  Legend
} from 'recharts';

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [selectedProjectFilter, setSelectedProjectFilter] = useState('Todos');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedRespName, setSelectedRespName] = useState<string | null>(null);

  // Notificações simuladas do sistema
  const [notifications, setNotifications] = useState<{ id: string; text: string; type: 'urgent' | 'info'; taskId?: string }[]>([]);

  const generateNotifications = (allTasks: Task[]) => {
    const list: typeof notifications = [];
    
    // Regra de urgência: SE urgência = emergencial -> Alerta imediato
    const emergencies = allTasks.filter(t => t.urgencia === 'Emergencial' && t.statusAndamento !== 'Finalizado');
    emergencies.forEach(t => {
      list.push({
        id: `notif-em-${t.id}`,
        text: `[DIRETORIA] ALERTA EMERGENCIAL: A tarefa "${t.subject}" do projeto "${t.project}" exige atenção imediata! Clique para abrir.`,
        type: 'urgent',
        taskId: t.id
      });
    });

    // Regra de urgência: SE urgência = crítica e prazo próximo (atrasada)
    const criticas = allTasks.filter(t => t.urgencia === 'Crítica' && t.statusAndamento !== 'Finalizado');
    criticas.forEach(t => {
      list.push({
        id: `notif-cr-${t.id}`,
        text: `Prazo Crítico: A tarefa "${t.subject}" está pendente. Clique para gerenciar.`,
        type: 'urgent',
        taskId: t.id
      });
    });

    // Notificação normal
    list.push({
      id: 'notif-welcome',
      text: `Bem-vindo ao painel. Base de dados atualizada de acordo com a planilha LongView.`,
      type: 'info'
    });

    setNotifications(list.slice(0, 5));
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const resTasks = await fetch('/api/tasks');
      const dataTasks = await resTasks.json();
      
      const resProj = await fetch('/api/projects');
      const dataProj = await resProj.json();

      setTasks(dataTasks.tasks || []);
      setProjects(dataProj.projects || []);

      // Simula a geração de notificações e alertas em tempo real do sistema
      generateNotifications(dataTasks.tasks || []);
    } catch (e) {
      console.error('Erro ao carregar dados do dashboard:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      setMounted(true);
      fetchData();
    });
  }, []);


  // Filtrar tarefas baseadas no filtro de projetos
  const filteredTasks = selectedProjectFilter === 'Todos' 
    ? tasks 
    : tasks.filter(t => t.project.toLowerCase() === selectedProjectFilter.toLowerCase());

  // KPIs
  const totalTasks = filteredTasks.length;
  const completedTasks = filteredTasks.filter(t => t.statusAndamento === 'Finalizado').length;
  const inProgressTasks = filteredTasks.filter(t => t.statusAndamento === 'Em andamento').length;
  const pendingContratações = filteredTasks.filter(t => 
    t.statusContratacao.toLowerCase().includes('orçamento') || 
    t.statusContratacao.toLowerCase().includes('indefinido')
  ).length;
  
  // Cálculo de tarefas atrasadas (não finalizadas e previsão de entrega já passou)
  const SIMULATED_NOW = new Date();
  const delayedTasks = filteredTasks.filter(t => {
    if (t.statusAndamento === 'Finalizado' || !t.previsaoEntrega) return false;
    // Tenta converter previsaoEntrega (DD/MM/AAAA ou DD/MM/YY) para data
    const parts = t.previsaoEntrega.split('/');
    if (parts.length === 3) {
      let year = parseInt(parts[2]);
      if (year < 100) year += 2000; // Converte YY para AAAA
      const month = parseInt(parts[1]) - 1;
      const day = parseInt(parts[0]);
      const prevDate = new Date(year, month, day);
      return prevDate < SIMULATED_NOW;
    }
    return false;
  }).length;

  const activeCriticalTasks = filteredTasks.filter(t => 
    (t.urgencia === 'Crítica' || t.urgencia === 'Emergencial') && 
    t.statusAndamento !== 'Finalizado'
  ).length;

  const globalProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Gráfico 1: Tarefas por Setor
  const sectorDataMap: { [key: string]: number } = {};
  filteredTasks.forEach(t => {
    sectorDataMap[t.sector] = (sectorDataMap[t.sector] || 0) + 1;
  });
  const sectorData = Object.keys(sectorDataMap).map(key => ({
    name: key,
    value: sectorDataMap[key]
  })).sort((a, b) => b.value - a.value);

  const COLORS = [
    '#3b82f6', // Azul Royal
    '#10b981', // Verde Esmeralda
    '#8b5cf6', // Roxo Violeta
    '#f59e0b', // Amarelo Laranja
    '#ec4899', // Rosa Pink
    '#06b6d4', // Ciano Neon
    '#f43f5e', // Vermelho Coral
    '#14b8a6'  // Teal
  ];

  // Gráfico 2: Andamento por Empreendimento
  const projectStats = projects.map(p => {
    const projTasks = tasks.filter(t => t.project.toLowerCase() === p.name.toLowerCase());
    const total = projTasks.length;
    const completed = projTasks.filter(t => t.statusAndamento === 'Finalizado').length;
    const inProgress = projTasks.filter(t => t.statusAndamento === 'Em andamento').length;
    const delayed = projTasks.filter(t => {
      if (t.statusAndamento === 'Finalizado' || !t.previsaoEntrega) return false;
      const parts = t.previsaoEntrega.split('/');
      if (parts.length === 3) {
        let year = parseInt(parts[2]);
        if (year < 100) year += 2000;
        const month = parseInt(parts[1]) - 1;
        const day = parseInt(parts[0]);
        const prevDate = new Date(year, month, day);
        return prevDate < SIMULATED_NOW;
      }
      return false;
    }).length;

    return {
      name: p.name,
      'Concluídas': completed,
      'Em Andamento': inProgress,
      'Atrasadas': delayed,
      total
    };
  });

  // Gargalos: responsáveis com mais tarefas pendentes (atrasadas ou críticas)
  const responsibleGargalos: { [name: string]: { total: number; delayed: number; critical: number } } = {};
  filteredTasks.forEach(t => {
    if (t.statusAndamento !== 'Finalizado') {
      const resp = t.responsible || 'Não atribuído';
      if (!responsibleGargalos[resp]) {
        responsibleGargalos[resp] = { total: 0, delayed: 0, critical: 0 };
      }
      responsibleGargalos[resp].total += 1;
      if (t.urgencia === 'Crítica' || t.urgencia === 'Emergencial') {
        responsibleGargalos[resp].critical += 1;
      }
      // Verifica atraso
      if (t.previsaoEntrega) {
        const parts = t.previsaoEntrega.split('/');
        if (parts.length === 3) {
          let year = parseInt(parts[2]);
          if (year < 100) year += 2000;
          const prevDate = new Date(year, parseInt(parts[1]) - 1, parseInt(parts[0]));
          if (prevDate < SIMULATED_NOW) {
            responsibleGargalos[resp].delayed += 1;
          }
        }
      }
    }
  });

  const gargaloList = Object.keys(responsibleGargalos)
    .map(name => ({
      name,
      ...responsibleGargalos[name]
    }))
    .filter(r => r.name !== 'Não atribuído' && r.name !== '-')
    .sort((a, b) => b.delayed + b.critical - (a.delayed + a.critical))
    .slice(0, 5);

  return (
    <div className="flex-1 w-full space-y-6 p-4 md:p-6 lg:px-6 lg:py-4">
      {/* Filtro e Atualizar */}
      <header className="flex flex-col gap-3 border-b border-[#1C1C1E] pb-4">
        {/* Filtro e Atualizar — responsivo */}
        <div className="flex items-center gap-2 w-full">
          <div className="flex flex-1 min-w-0 items-center gap-2 bg-[#1b1b1f] border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white">
            <SlidersHorizontal size={13} className="text-zinc-400 shrink-0" />
            <span className="text-zinc-400 shrink-0 hidden sm:inline">Empreendimento:</span>
            <select
              value={selectedProjectFilter}
              onChange={(e) => setSelectedProjectFilter(e.target.value)}
              className="flex-1 min-w-0 bg-transparent text-white font-semibold focus:outline-none cursor-pointer text-xs"
            >
              <option value="Todos" className="bg-[#121214] text-white">Todos</option>
              {projects.map(p => (
                <option key={p.id} value={p.name} className="bg-[#121214] text-white">{p.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={fetchData}
            className="no-tap shrink-0 p-2.5 bg-[#121214] border border-[#1E1E22] text-zinc-400 hover:text-white rounded-xl transition-all flex items-center gap-1.5 text-xs active:scale-95"
            title="Atualizar dados"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline font-semibold">Atualizar</span>
          </button>
        </div>
      </header>

      {/* Alertas Urgentes / Emergenciais */}
      {notifications.some(n => n.type === 'urgent') && (
        <section className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 glow-white-sm space-y-2.5 animate-in fade-in-50 duration-300">
          <div className="flex items-center gap-2 text-red-400 font-bold text-xs uppercase tracking-wider">
            <ShieldAlert size={14} />
            <span>Avisos de Risco Crítico / Alertas da Diretoria</span>
          </div>
          <div className="space-y-1.5">
            {notifications.filter(n => n.type === 'urgent').map((notif) => (
              <div 
                key={notif.id} 
                onClick={() => notif.taskId && setSelectedTaskId(notif.taskId)}
                className={`text-xs text-zinc-300 flex items-start gap-2 ${notif.taskId ? 'cursor-pointer hover:text-white hover:underline transition-all' : ''}`}
              >
                <span className="text-red-500 shrink-0">•</span>
                <p className="leading-relaxed font-semibold">{notif.text}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Grid de KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Tarefas */}
        <div className="bg-[#121214]/60 border border-[#1E1E22] p-4.5 rounded-xl flex flex-col justify-between h-28 hover:border-zinc-700 transition-all duration-300 group">
          <div className="flex justify-between items-center text-zinc-500 group-hover:text-zinc-400 transition-colors">
            <span className="text-[10px] uppercase font-bold tracking-wider">Total de Tarefas</span>
            <Activity size={16} />
          </div>
          <div className="mt-2.5">
            <h3 className="text-2xl font-semibold text-white tracking-tight">{totalTasks}</h3>
            <p className="text-[9px] text-zinc-500 font-medium mt-0.5">Operações mapeadas</p>
          </div>
        </div>

        {/* Progresso Geral */}
        <div className="bg-[#121214]/60 border border-[#1E1E22] p-4.5 rounded-xl flex flex-col justify-between h-28 hover:border-zinc-700 transition-all duration-300 group">
          <div className="flex justify-between items-center text-zinc-500 group-hover:text-zinc-400 transition-colors">
            <span className="text-[10px] uppercase font-bold tracking-wider">Progresso Geral</span>
            <TrendingUp size={16} />
          </div>
          <div className="mt-2.5">
            <h3 className="text-2xl font-semibold text-white tracking-tight">{globalProgress}%</h3>
            {/* Barra de progresso micro */}
            <div className="w-full bg-zinc-800 h-1 rounded-full mt-1.5 overflow-hidden">
              <div 
                className="bg-white h-1 rounded-full transition-all duration-500" 
                style={{ width: `${globalProgress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Em Andamento */}
        <div className="bg-[#121214]/60 border border-[#1E1E22] p-4.5 rounded-xl flex flex-col justify-between h-28 hover:border-zinc-700 transition-all duration-300 group">
          <div className="flex justify-between items-center text-zinc-500 group-hover:text-zinc-400 transition-colors">
            <span className="text-[10px] uppercase font-bold tracking-wider">Em Andamento</span>
            <Clock size={16} />
          </div>
          <div className="mt-2.5">
            <h3 className="text-2xl font-semibold text-zinc-300 tracking-tight">{inProgressTasks}</h3>
            <p className="text-[9px] text-zinc-500 font-medium mt-0.5">Tarefas ativas</p>
          </div>
        </div>

        {/* Concluídas */}
        <div className="bg-[#121214]/60 border border-[#1E1E22] p-4.5 rounded-xl flex flex-col justify-between h-28 hover:border-zinc-700 transition-all duration-300 group">
          <div className="flex justify-between items-center text-zinc-500 group-hover:text-zinc-400 transition-colors">
            <span className="text-[10px] uppercase font-bold tracking-wider">Concluídas</span>
            <CheckCircle2 size={16} />
          </div>
          <div className="mt-2.5">
            <h3 className="text-2xl font-semibold text-zinc-400 tracking-tight">{completedTasks}</h3>
            <p className="text-[9px] text-zinc-500 font-medium mt-0.5">Finalizadas</p>
          </div>
        </div>

        {/* Atrasos */}
        <div className={`
          border p-4.5 rounded-xl flex flex-col justify-between h-28 transition-all duration-300 group
          ${delayedTasks > 0 
            ? 'bg-red-500/5 border-red-500/20 hover:border-red-500/40' 
            : 'bg-[#121214]/60 border-[#1E1E22] hover:border-zinc-700'
          }
        `}>
          <div className="flex justify-between items-center text-zinc-500 group-hover:text-zinc-400 transition-colors">
            <span className="text-[10px] uppercase font-bold tracking-wider">Atrasadas</span>
            <AlertOctagon size={16} className={delayedTasks > 0 ? 'text-red-400' : ''} />
          </div>
          <div className="mt-2.5">
            <h3 className={`text-2xl font-semibold tracking-tight ${delayedTasks > 0 ? 'text-red-400' : 'text-zinc-300'}`}>
              {delayedTasks}
            </h3>
            <p className="text-[9px] text-zinc-500 font-medium mt-0.5">Prazo expirado</p>
          </div>
        </div>

        {/* Críticas / Emergenciais */}
        <div className={`
          border p-4.5 rounded-xl flex flex-col justify-between h-28 transition-all duration-300 group
          ${activeCriticalTasks > 0 
            ? 'bg-orange-500/5 border-orange-500/20 hover:border-orange-500/40 glow-white-sm' 
            : 'bg-[#121214]/60 border-[#1E1E22] hover:border-zinc-700'
          }
        `}>
          <div className="flex justify-between items-center text-zinc-500 group-hover:text-zinc-400 transition-colors">
            <span className="text-[10px] uppercase font-bold tracking-wider">Críticas/Emerg.</span>
            <ShieldAlert size={16} className={activeCriticalTasks > 0 ? 'text-orange-400' : ''} />
          </div>
          <div className="mt-2.5">
            <h3 className={`text-2xl font-semibold tracking-tight ${activeCriticalTasks > 0 ? 'text-orange-400' : 'text-zinc-300'}`}>
              {activeCriticalTasks}
            </h3>
            <p className="text-[9px] text-zinc-500 font-medium mt-0.5">Urgência prioritária</p>
          </div>
        </div>
      </section>

      {/* Seção de Gráficos e Detalhes */}
      <section className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-3">
        
        {/* Gráfico 1: Andamento por Empreendimento */}
        <div className="min-w-0 lg:col-span-2 bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-[#1C1C1E] pb-3">
            <div>
              <h4 className="text-sm font-semibold text-white">Evolução Operacional por Empreendimento</h4>
              <p className="text-[11px] text-zinc-500 mt-0.5">Quantidade de tarefas por status em cada projeto</p>
            </div>
          </div>
          <div className="h-64 min-w-0 w-full">
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={projectStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis 
                    dataKey="name" 
                    stroke="#3f3f46" 
                    tick={{ fill: '#f4f4f5', fontSize: 11, fontWeight: 600 }} 
                    tickLine={false} 
                  />
                  <YAxis 
                    stroke="#3f3f46" 
                    tick={{ fill: '#a1a1aa', fontSize: 11 }} 
                    tickLine={false} 
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#2b2b30', color: '#fff' }} 
                    labelStyle={{ fontWeight: 'bold' }}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: 10, paddingTop: 12 }} 
                    formatter={(value) => <span className="text-zinc-200 font-semibold px-1">{value}</span>}
                  />
                  <Bar dataKey="Concluídas" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Em Andamento" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Atrasadas" stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Gráfico 2: Distribuição por Setores (Pizza) */}
        <div className="min-w-0 bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-[#1C1C1E] pb-3">
            <div>
              <h4 className="text-sm font-semibold text-white">Tarefas por Setor</h4>
              <p className="text-[11px] text-zinc-500 mt-0.5">Representatividade operacional no projeto</p>
            </div>
          </div>
          <div className="h-64 min-w-0 w-full flex items-center justify-center relative">
            {mounted && sectorData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sectorData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {sectorData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#1c1c1e', color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-zinc-500">Sem dados setoriais</p>
            )}
            {/* Legenda Absoluta Simplificada no Centro */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-bold text-white">{totalTasks}</span>
              <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Tarefas</span>
            </div>
          </div>
        </div>

      </section>

      {/* Gargalos e Risco Operacional */}
      <section className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Gargalos Operacionais */}
        <div className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-[#1C1C1E] pb-3">
            <div>
              <h4 className="text-sm font-semibold text-white">Gargalos Operacionais (Líderes de Pendências)</h4>
              <p className="text-[11px] text-zinc-500 mt-0.5">Responsáveis com mais tarefas atrasadas e críticas pendentes</p>
            </div>
          </div>
          <div className="divide-y divide-[#1C1C1E]">
            {gargaloList.length === 0 ? (
              <p className="text-xs text-zinc-500 py-6 text-center">Nenhum gargalo identificado no momento.</p>
            ) : (
              gargaloList.map((gargalo, index) => (
                <div key={gargalo.name} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div 
                    onClick={() => setSelectedRespName(gargalo.name)}
                    className="flex items-center gap-3 cursor-pointer group/gargalo"
                  >
                    <div className="w-6 h-6 rounded-full bg-zinc-800 text-[10px] text-white flex items-center justify-center border border-zinc-700 font-bold group-hover/gargalo:border-zinc-500 transition-colors">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-xs text-white font-bold group-hover/gargalo:underline">{gargalo.name}</p>
                      <p className="text-[9px] text-zinc-400">Clique para ver tarefas do responsável</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-xs font-bold text-white">{gargalo.total} ativas</span>
                      <div className="flex items-center gap-1.5 justify-end mt-0.5">
                        {gargalo.delayed > 0 && (
                          <span className="text-[9px] bg-red-500/10 text-red-400 px-1 py-0.2 rounded border border-red-500/20 font-mono">
                            {gargalo.delayed} atrasadas
                          </span>
                        )}
                        {gargalo.critical > 0 && (
                          <span className="text-[9px] bg-orange-500/10 text-orange-400 px-1 py-0.2 rounded border border-orange-500/20 font-mono">
                            {gargalo.critical} críticas
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Visão de Risco Geral dos Empreendimentos */}
        <div className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-[#1C1C1E] pb-3">
            <div>
              <h4 className="text-sm font-semibold text-white">Mapa de Risco e Conclusão dos Empreendimentos</h4>
              <p className="text-[11px] text-zinc-500 mt-0.5">Resumo executivo de saúde dos projetos</p>
            </div>
            <Link href="/project-vision/projects" className="text-zinc-400 hover:text-white flex items-center gap-1 text-[11px] font-semibold transition-colors">
              <span>Ver todos</span>
              <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-4.5">
            {projects.slice(0, 4).map((proj) => {
              const projTasks = tasks.filter(t => t.project.toLowerCase() === proj.name.toLowerCase());
              const delayed = projTasks.filter(t => {
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

              // Calcula o nível de risco
              let riskLabel = 'Baixo';
              let riskColor = 'text-green-400 bg-green-500/10 border-green-500/20';
              if (delayed > 3) {
                riskLabel = 'Crítico';
                riskColor = 'text-red-400 bg-red-500/10 border-red-500/20';
              } else if (delayed > 0) {
                riskLabel = 'Médio';
                riskColor = 'text-orange-400 bg-orange-500/10 border-orange-500/20';
              }

              return (
                <div key={proj.id} className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span 
                      onClick={() => {
                        window.location.href = `/project-vision/projects/${proj.id}`;
                      }}
                      className="font-bold text-zinc-100 hover:text-white cursor-pointer hover:underline"
                    >
                      {proj.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${riskColor}`}>
                        Risco {riskLabel}
                      </span>
                      <span className="font-mono text-zinc-400 font-bold">{proj.progress}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        riskLabel === 'Crítico' ? 'bg-red-500' : riskLabel === 'Médio' ? 'bg-orange-400' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${proj.progress}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Drawer de Detalhes da Tarefa (Interação Direta no Dashboard) */}
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
