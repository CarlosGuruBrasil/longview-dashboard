'use client';

import React, { useState, useEffect } from 'react';
import { X, ExternalLink, AlertTriangle, CheckCircle2, Clock, AlertOctagon } from 'lucide-react';
import { Task } from '@/lib/db';
import logger from '@/lib/logger'

const isDelayed = (task: Task): boolean => {
  if (task.statusAndamento === 'Finalizado' || !task.previsaoEntrega) return false;
  const parts = task.previsaoEntrega.split('/');
  if (parts.length !== 3) return false;
  let y = parseInt(parts[2]); if (y < 100) y += 2000;
  return new Date(y, parseInt(parts[1]) - 1, parseInt(parts[0])) < new Date();
};

interface Props {
  responsibleName: string | null;
  onClose: () => void;
  onSelectTask: (taskId: string) => void;
}

export default function ResponsibleModal({ responsibleName, onClose, onSelectTask }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!responsibleName) return;
    let active = true;

    Promise.resolve().then(() => {
      if (active) setLoading(true);
    });

    fetch(`/api/tasks?responsible=${encodeURIComponent(responsibleName)}`)
      .then(res => res.json())
      .then(data => {
        if (active) setTasks(data.tasks || []);
      })
      .catch((err: unknown) => logger.error({ err }))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [responsibleName]);

  if (!responsibleName) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
        <div className="bg-[#09090B] border border-[#1E1E22] rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
          <div className="p-5 border-b border-[#1C1C1E] flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-white">Tarefas de {responsibleName}</h3>
              <p className="text-xs text-zinc-500 mt-0.5">{tasks.length} tarefas encontradas</p>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-white/5 text-zinc-400 hover:text-white rounded-lg">
              <X size={16} />
            </button>
          </div>

          <div className="overflow-y-auto p-5 space-y-3 flex-1">
            {loading ? (
              <p className="text-sm text-zinc-500 text-center py-8">Carregando...</p>
            ) : tasks.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-8">Nenhuma tarefa encontrada para este responsável.</p>
            ) : (
              tasks.map(task => {
                const late = isDelayed(task);
                return (
                  <div
                    key={task.id}
                    onClick={() => { onSelectTask(task.id); onClose(); }}
                    className={`border rounded-xl p-4 cursor-pointer transition-all group ${
                      late
                        ? 'bg-red-500/5 border-red-500/20 hover:border-red-500/40'
                        : 'bg-[#121214] border-[#1E1E22] hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-mono text-[10px] text-zinc-500 font-bold">{task.id}</span>
                          <span className="text-[10px] text-zinc-600">•</span>
                          <span className="text-[10px] text-zinc-400 font-medium">{task.project}</span>
                          <span className="text-[10px] text-zinc-600">•</span>
                          <span className="text-[10px] text-zinc-400">{task.sector}</span>
                          {late && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-bold">
                              <AlertOctagon size={9} /> ATRASADA
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-white truncate group-hover:underline">{task.subject}</p>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full border font-medium ${
                            task.statusAndamento === 'Finalizado' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                            task.statusAndamento === 'Em andamento' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                            'text-zinc-400 bg-zinc-500/10 border-zinc-500/20'
                          }`}>
                            {task.statusAndamento === 'Finalizado' ? <CheckCircle2 size={10} /> :
                             task.statusAndamento === 'Em andamento' ? <Clock size={10} /> :
                             <AlertTriangle size={10} />}
                            {task.statusAndamento}
                          </span>
                          <span className="font-mono text-[10px] text-zinc-500">{task.progress}%</span>
                          {task.previsaoEntrega && (
                            <span className={`font-mono text-[9px] ${late ? 'text-red-400 font-bold' : 'text-zinc-500'}`}>
                              Prev: {task.previsaoEntrega}
                            </span>
                          )}
                        </div>
                      </div>
                      <ExternalLink size={14} className="text-zinc-600 group-hover:text-zinc-300 shrink-0 mt-1" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
}
