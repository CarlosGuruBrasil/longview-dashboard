'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { RefreshCw, ArrowLeft } from 'lucide-react';
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
    Promise.resolve().then(() => {
      fetchData();
    });
  }, [id]);

  if (loading) {
    return (
      <div className="flex-1 p-6 lg:p-10 max-w-7xl mx-auto w-full">
        <div className="py-20 text-center text-zinc-500">Carregando...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex-1 p-6 lg:p-10 max-w-7xl mx-auto w-full">
        <div className="py-20 text-center text-zinc-500">
          <p className="text-lg font-semibold">Empreendimento não encontrado</p>
          <Link href="/project-vision/projects" className="text-sm text-zinc-400 hover:text-white mt-2 inline-block underline">Voltar</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 lg:p-10 space-y-6 max-w-7xl mx-auto w-full">
      <header className="flex items-center gap-4 border-b border-[#1C1C1E] pb-6">
        <Link href="/project-vision/projects" className="text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-white">{project.name}</h2>
          <p className="text-sm text-zinc-400 mt-0.5">{project.status} • {project.progress}% concluído</p>
        </div>
        <div className="ml-auto">
          <button onClick={fetchData} className="p-2.5 bg-[#121214] hover:bg-[#18181B] border border-[#1E1E22] text-zinc-400 hover:text-white rounded-lg transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#121214]/40 border border-[#1E1E22] rounded-xl p-4">
          <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Total</p>
          <p className="text-2xl font-bold text-white mt-1">{tasks.length}</p>
        </div>
        <div className="bg-[#121214]/40 border border-[#1E1E22] rounded-xl p-4">
          <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Concluídas</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{tasks.filter(t => t.statusAndamento === 'Finalizado').length}</p>
        </div>
        <div className="bg-[#121214]/40 border border-[#1E1E22] rounded-xl p-4">
          <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Em Andamento</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{tasks.filter(t => t.statusAndamento === 'Em andamento').length}</p>
        </div>
        <div className="bg-[#121214]/40 border border-[#1E1E22] rounded-xl p-4">
          <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Não Iniciadas</p>
          <p className="text-2xl font-bold text-zinc-400 mt-1">{tasks.filter(t => t.statusAndamento === 'Não iniciado').length}</p>
        </div>
      </div>

      <div className="bg-[#121214]/40 border border-[#1E1E22] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#1C1C1E] bg-[#0E0E10]/70 text-[10px] uppercase font-bold text-zinc-300 tracking-wider">
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Setor</th>
                <th className="py-3 px-4">Assunto</th>
                <th className="py-3 px-4">Responsável</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Progresso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1C1C1E]">
              {tasks.map(task => (
                <tr key={task.id} onClick={() => setSelectedTaskId(task.id)} className="hover:bg-white/[0.02] cursor-pointer transition-colors">
                  <td className="py-3 px-4 font-mono text-xs text-zinc-400">{task.id}</td>
                  <td className="py-3 px-4 text-xs text-zinc-300">{task.sector}</td>
                  <td className="py-3 px-4 text-xs text-white font-medium">{task.subject}</td>
                  <td className="py-3 px-4 text-xs text-zinc-300">{task.responsible}</td>
                  <td className="py-3 px-4 text-xs">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border ${
                      task.statusAndamento === 'Finalizado' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10' :
                      task.statusAndamento === 'Em andamento' ? 'text-amber-400 border-amber-500/20 bg-amber-500/10' :
                      'text-zinc-400 border-zinc-500/20 bg-zinc-500/10'
                    }`}>{task.statusAndamento}</span>
                  </td>
                  <td className="py-3 px-4 text-xs font-mono text-zinc-200">{task.progress}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <TaskDrawer taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} onUpdate={fetchData} />
    </div>
  );
}
