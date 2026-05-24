'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, Clock, AlertTriangle, User, Building2, Calendar, Tag, FileText, ChevronDown } from 'lucide-react';
import { Task, ChangeLog, Comment } from '@/lib/db';
import { useUser } from '@/context/UserContext';

interface Props {
  taskId: string | null;
  onClose: () => void;
  onUpdate: () => void;
}

export default function TaskDrawer({ taskId, onClose, onUpdate }: Props) {
  const { currentUser } = useUser();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Form fields
  const [status, setStatus] = useState<string>('');
  const [urgencia, setUrgencia] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [responsible, setResponsible] = useState<string>('');
  const [previsao, setPrevisao] = useState<string>('');
  const [situacao, setSituacao] = useState<string>('');
  const [observacoes, setObservacoes] = useState<string>('');

  useEffect(() => {
    if (!taskId) return;
    let active = true;
    
    Promise.resolve().then(() => {
      if (active) setLoading(true);
    });

    fetch(`/api/tasks/${taskId}`)
      .then(res => res.json())
      .then(data => {
        if (!active) return;
        setTask(data.task);
        setStatus(data.task.statusAndamento);
        setUrgencia(data.task.urgencia);
        setProgress(data.task.progress);
        setResponsible(data.task.responsible);
        setPrevisao(data.task.previsaoEntrega);
        setSituacao(data.task.situacao);
        setObservacoes(data.task.observacoesRotinas);
      })
      .catch(console.error)
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [taskId]);

  const handleSave = async () => {
    if (!task) return;
    setSaving(true);
    try {
      const payload = {
        statusAndamento: status,
        urgencia,
        progress,
        responsible,
        previsaoEntrega: previsao,
        situacao,
        observacoesRotinas: observacoes,
        currentUser
      };

      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setEditMode(false);
        onUpdate();
        const data = await res.json();
        setTask(data.task);
      }
    } catch (e) {
      console.error('Erro ao salvar:', e);
    } finally {
      setSaving(false);
    }
  };

  if (!taskId || !task) return null;

  const isEditable = currentUser.role === 'Desenvolvedor' || currentUser.role === 'Diretoria' || currentUser.role === 'Gestor';

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-[#09090B] border-l border-[#1C1C1E] shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-[#1C1C1E] flex justify-between items-center">
          <div>
            <span className="font-mono text-[10px] text-zinc-500 font-bold">{task.id}</span>
            <h3 className="text-lg font-bold text-white mt-0.5">{task.subject}</h3>
            <p className="text-xs text-zinc-400">{task.project} • {task.sector}</p>
          </div>
          <div className="flex items-center gap-2">
            {isEditable && !editMode && (
              <button onClick={() => setEditMode(true)} className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 font-semibold transition-colors">
                Editar
              </button>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-white/5 text-zinc-400 hover:text-white rounded-lg">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {loading ? (
            <p className="text-sm text-zinc-500 text-center py-8">Carregando...</p>
          ) : (
            <>
              {/* Status & Urgência */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Andamento</span>
                  {editMode ? (
                    <select value={status} onChange={e => setStatus(e.target.value)} className="block w-full mt-1 bg-[#121214] border border-[#1E1E22] rounded-lg px-3 py-2 text-xs text-white">
                      <option>Não iniciado</option>
                      <option>Em andamento</option>
                      <option>Aguardando</option>
                      <option>Em análise</option>
                      <option>Finalizado</option>
                    </select>
                  ) : (
                    <p className="text-sm font-semibold text-white mt-1">{task.statusAndamento}</p>
                  )}
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Urgência</span>
                  {editMode ? (
                    <select value={urgencia} onChange={e => setUrgencia(e.target.value)} className="block w-full mt-1 bg-[#121214] border border-[#1E1E22] rounded-lg px-3 py-2 text-xs text-white">
                      <option>Baixa</option>
                      <option>Média</option>
                      <option>Alta</option>
                      <option>Crítica</option>
                      <option>Emergencial</option>
                    </select>
                  ) : (
                    <p className="text-sm font-semibold text-white mt-1">{task.urgencia}</p>
                  )}
                </div>
              </div>

              {/* Responsável */}
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Responsável</span>
                {editMode ? (
                  <input type="text" value={responsible} onChange={e => setResponsible(e.target.value)} className="block w-full mt-1 bg-[#121214] border border-[#1E1E22] rounded-lg px-3 py-2 text-xs text-white" />
                ) : (
                  <p className="text-sm font-semibold text-white mt-1">{task.responsible}</p>
                )}
              </div>

              {/* Datas */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Previsão de Entrega</span>
                  {editMode ? (
                    <input type="text" value={previsao} onChange={e => setPrevisao(e.target.value)} className="block w-full mt-1 bg-[#121214] border border-[#1E1E22] rounded-lg px-3 py-2 text-xs text-white" placeholder="DD/MM/AAAA" />
                  ) : (
                    <p className="text-sm font-mono text-zinc-300 mt-1">{task.previsaoEntrega || '-'}</p>
                  )}
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Progresso</span>
                  {editMode ? (
                    <div className="flex items-center gap-2 mt-1">
                      <input type="range" min="0" max="100" value={progress} onChange={e => setProgress(Number(e.target.value))} className="flex-1 accent-white" />
                      <span className="text-xs font-mono text-white w-8 text-right">{progress}%</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-white h-1.5 rounded-full" style={{ width: `${task.progress}%` }} />
                      </div>
                      <span className="text-xs font-mono text-white">{task.progress}%</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Situação */}
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Situação / Histórico</span>
                {editMode ? (
                  <textarea value={situacao} onChange={e => setSituacao(e.target.value)} rows={4} className="block w-full mt-1 bg-[#121214] border border-[#1E1E22] rounded-lg px-3 py-2 text-xs text-white resize-none" />
                ) : (
                  <p className="text-xs text-zinc-300 mt-1 whitespace-pre-wrap leading-relaxed">{task.situacao || 'Sem informações'}</p>
                )}
              </div>

              {/* Observações */}
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Observações</span>
                {editMode ? (
                  <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={3} className="block w-full mt-1 bg-[#121214] border border-[#1E1E22] rounded-lg px-3 py-2 text-xs text-white resize-none" />
                ) : (
                  <p className="text-xs text-zinc-300 mt-1 whitespace-pre-wrap">{task.observacoesRotinas || '-'}</p>
                )}
              </div>

              {/* Logs de Alteração */}
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Log de Alterações</span>
                <div className="mt-2 space-y-2">
                  {task.logs?.slice().reverse().map(log => (
                    <div key={log.id} className="text-[10px] text-zinc-400 bg-[#121214] border border-[#1E1E22] rounded-lg p-2.5">
                      <span className="font-bold text-zinc-300">{log.userName}</span>
                      <span className="text-zinc-600 mx-1">alterou</span>
                      <span className="font-bold text-zinc-300">{log.field}</span>
                      <span className="text-zinc-600 mx-1">de</span>
                      <span className="text-zinc-400 line-through">{log.oldValue}</span>
                      <span className="text-zinc-600 mx-1">para</span>
                      <span className="text-white font-semibold">{log.newValue}</span>
                      <span className="block text-zinc-600 mt-0.5">{new Date(log.date).toLocaleString('pt-BR')}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {editMode && (
          <div className="p-5 border-t border-[#1C1C1E] flex items-center justify-end gap-3">
            <button onClick={() => setEditMode(false)} className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 rounded-lg transition-colors">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving} className="px-5 py-2 text-xs font-semibold text-black bg-white hover:bg-zinc-200 rounded-lg flex items-center gap-1.5 transition-colors">
              <Save size={14} />
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
