'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X, Save, Trash2, Paperclip, MessageSquare, CheckSquare, Clock,
  Upload, Download, FileText, Send, Plus, Check, Loader2,
} from 'lucide-react';
import { Task, ChangeLog, Comment, Subtask, TaskDocumentMeta } from '@/lib/db-kv';
import { useUser } from '@/context/UserContext';

interface Props {
  taskId: string | null;
  onClose: () => void;
  onUpdate: () => void;
}

type Tab = 'detalhes' | 'subtasks' | 'comentarios' | 'arquivos' | 'logs';

const TAB_LABELS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'detalhes',    label: 'Detalhes',    icon: FileText      },
  { key: 'subtasks',    label: 'Subtarefas',  icon: CheckSquare   },
  { key: 'comentarios', label: 'Comentários', icon: MessageSquare },
  { key: 'arquivos',    label: 'Arquivos',    icon: Paperclip     },
  { key: 'logs',        label: 'Histórico',   icon: Clock         },
];

const DOC_CATEGORIES = [
  { value: 'contrato',    label: 'Contrato'    },
  { value: 'proposta',    label: 'Proposta'    },
  { value: 'planta',      label: 'Planta'      },
  { value: 'foto',        label: 'Foto'        },
  { value: 'aprovacao',   label: 'Aprovação'   },
  { value: 'ata',         label: 'Ata'         },
  { value: 'outro',       label: 'Outro'       },
];

function fmtSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function TaskDrawer({ taskId, onClose, onUpdate }: Props) {
  const { currentUser } = useUser();
  const [task,    setTask]    = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [tab,     setTab]     = useState<Tab>('detalhes');
  const [editMode,       setEditMode]       = useState(false);
  const [confirmDelete,  setConfirmDelete]  = useState(false);
  const [deleting,       setDeleting]       = useState(false);

  // Detalhes fields
  const [status,     setStatus]     = useState('');
  const [urgencia,   setUrgencia]   = useState('');
  const [progress,   setProgress]   = useState(0);
  const [responsible, setResponsible] = useState('');
  const [previsao,   setPrevisao]   = useState('');
  const [situacao,   setSituacao]   = useState('');
  const [observacoes, setObservacoes] = useState('');

  // Subtasks
  const [newSubtask, setNewSubtask] = useState('');
  const [savingSubtask, setSavingSubtask] = useState(false);

  // Comentários
  const [newComment, setNewComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  // Arquivos
  const [docs, setDocs] = useState<TaskDocumentMeta[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docCategory, setDocCategory] = useState('outro');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEditable  = ['Desenvolvedor', 'Diretoria', 'Operador'].includes(currentUser.role) || currentUser.permissions?.manageProjects === true;
  const isDeletable = ['Desenvolvedor', 'Diretoria', 'Operador'].includes(currentUser.role) || currentUser.permissions?.deleteTasks === true;

  useEffect(() => {
    if (!taskId) { setTask(null); return; }
    let active = true;
    setTask(null); setEditMode(false); setLoading(true); setTab('detalhes');
    fetch(`/api/tasks/${taskId}`)
      .then(r => r.json())
      .then(d => {
        if (!active) return;
        const t: Task = d.task;
        setTask(t);
        setStatus(t.statusAndamento);
        setUrgencia(t.urgencia);
        setProgress(t.progress ?? 0);
        setResponsible(t.responsible);
        setPrevisao(t.previsaoEntrega ?? '');
        setSituacao(t.situacao ?? '');
        setObservacoes(t.observacoesRotinas ?? '');
      })
      .catch(console.error)
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [taskId]);

  useEffect(() => {
    if (!taskId || tab !== 'arquivos') return;
    setDocsLoading(true);
    fetch(`/api/tasks/${taskId}/documents`)
      .then(r => r.json())
      .then(d => setDocs(d.documents ?? []))
      .catch(console.error)
      .finally(() => setDocsLoading(false));
  }, [taskId, tab]);

  const handleSave = async () => {
    if (!task) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusAndamento: status, urgencia, progress, responsible, previsaoEntrega: previsao, situacao, observacoesRotinas: observacoes }),
      });
      if (res.ok) {
        const data = await res.json();
        setTask(data.task);
        setEditMode(false);
        onUpdate();
      }
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!task) return;
    setDeleting(true);
    const res = await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
    if (res.ok) { onUpdate(); onClose(); }
    setDeleting(false); setConfirmDelete(false);
  };

  const handleAddSubtask = async () => {
    if (!task || !newSubtask.trim()) return;
    setSavingSubtask(true);
    const subtask: Subtask = { id: `st-${Date.now()}`, title: newSubtask.trim(), completed: false };
    const updated = [...(task.subtasks || []), subtask];
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subtasks: updated }),
    });
    if (res.ok) {
      const d = await res.json();
      setTask(d.task);
      setNewSubtask('');
      onUpdate();
    }
    setSavingSubtask(false);
  };

  const handleToggleSubtask = async (stId: string) => {
    if (!task) return;
    const updated = (task.subtasks || []).map(s => s.id === stId ? { ...s, completed: !s.completed } : s);
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subtasks: updated }),
    });
    if (res.ok) { const d = await res.json(); setTask(d.task); onUpdate(); }
  };

  const handleSendComment = async () => {
    if (!task || !newComment.trim()) return;
    setSendingComment(true);
    const comment: Comment = {
      id: `cm-${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      role: currentUser.role,
      content: newComment.trim(),
      createdAt: new Date().toISOString(),
    };
    const updated = [...(task.comments || []), comment];
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comments: updated }),
    });
    if (res.ok) { const d = await res.json(); setTask(d.task); setNewComment(''); onUpdate(); }
    setSendingComment(false);
  };

  const handleUploadFile = async (file: File) => {
    if (!task) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    form.append('category', docCategory);
    const res = await fetch(`/api/tasks/${task.id}/documents`, { method: 'POST', body: form });
    if (res.ok) {
      const d = await res.json();
      setDocs(prev => [d.document, ...prev]);
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? 'Erro ao enviar arquivo');
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!task || !confirm('Remover este arquivo?')) return;
    const res = await fetch(`/api/tasks/${task.id}/documents/${docId}`, { method: 'DELETE' });
    if (res.ok) setDocs(prev => prev.filter(d => d.id !== docId));
  };

  if (!taskId) return null;

  const completedCount = (task?.subtasks || []).filter(s => s.completed).length;
  const totalCount     = (task?.subtasks || []).length;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-[#09090B] border-l border-[#1C1C1E] shadow-2xl z-50 flex flex-col">

        {/* Header */}
        <div className="p-5 border-b border-[#1C1C1E] flex-shrink-0">
          <div className="flex justify-between items-start gap-3">
            <div className="min-w-0">
              {task ? (
                <>
                  <span className="font-mono text-[10px] text-zinc-500 font-bold">{task.id}</span>
                  <h3 className="text-base font-bold text-white mt-0.5 leading-tight">{task.subject}</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">{task.project} · {task.sector}</p>
                </>
              ) : (
                <p className="text-sm text-zinc-500 animate-pulse">Carregando...</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isDeletable && !editMode && task && (
                <button onClick={() => setConfirmDelete(true)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/50 text-red-400 border border-red-900/50 flex items-center gap-1.5">
                  <Trash2 size={12} /> Excluir
                </button>
              )}
              {isEditable && !editMode && task && (
                <button onClick={() => setEditMode(true)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700">
                  Editar
                </button>
              )}
              <button onClick={onClose} className="p-1.5 hover:bg-white/5 text-zinc-400 hover:text-white rounded-lg">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 overflow-x-auto">
            {TAB_LABELS.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  tab === key ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                }`}>
                <Icon size={12} />
                {label}
                {key === 'subtasks' && totalCount > 0 && (
                  <span className="ml-0.5 text-[10px] text-zinc-500">{completedCount}/{totalCount}</span>
                )}
                {key === 'comentarios' && (task?.comments?.length ?? 0) > 0 && (
                  <span className="ml-0.5 text-[10px] text-zinc-500">{task!.comments.length}</span>
                )}
                {key === 'arquivos' && docs.length > 0 && (
                  <span className="ml-0.5 text-[10px] text-zinc-500">{docs.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading || !task ? (
            <div className="flex items-center justify-center h-40 gap-3 text-zinc-500">
              <div className="w-5 h-5 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
              <span className="text-sm">Carregando...</span>
            </div>
          ) : (
            <>
              {/* ── DETALHES ── */}
              {tab === 'detalhes' && (
                <div className="p-5 space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="label">Andamento</span>
                      {editMode ? (
                        <select value={status} onChange={e => setStatus(e.target.value)} className="field mt-1">
                          {['Não iniciado','Em andamento','Aguardando','Em análise','Finalizado'].map(s => <option key={s}>{s}</option>)}
                        </select>
                      ) : <p className="val">{task.statusAndamento}</p>}
                    </div>
                    <div>
                      <span className="label">Urgência</span>
                      {editMode ? (
                        <select value={urgencia} onChange={e => setUrgencia(e.target.value)} className="field mt-1">
                          {['Baixa','Média','Alta','Crítica','Emergencial'].map(u => <option key={u}>{u}</option>)}
                        </select>
                      ) : <p className="val">{task.urgencia}</p>}
                    </div>
                  </div>

                  <div>
                    <span className="label">Responsável</span>
                    {editMode ? (
                      <input value={responsible} onChange={e => setResponsible(e.target.value)} className="field mt-1" />
                    ) : <p className="val">{task.responsible}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="label">Previsão de Entrega</span>
                      {editMode ? (
                        <input value={previsao} onChange={e => setPrevisao(e.target.value)} placeholder="DD/MM/AAAA" className="field mt-1" />
                      ) : <p className="val font-mono">{task.previsaoEntrega || '—'}</p>}
                    </div>
                    <div>
                      <span className="label">Progresso</span>
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

                  <div>
                    <span className="label">Situação / Histórico</span>
                    {editMode ? (
                      <textarea value={situacao} onChange={e => setSituacao(e.target.value)} rows={4} className="field mt-1 resize-none" />
                    ) : <p className="text-xs text-zinc-300 mt-1 whitespace-pre-wrap leading-relaxed">{task.situacao || '—'}</p>}
                  </div>

                  <div>
                    <span className="label">Observações</span>
                    {editMode ? (
                      <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={3} className="field mt-1 resize-none" />
                    ) : <p className="text-xs text-zinc-300 mt-1 whitespace-pre-wrap">{task.observacoesRotinas || '—'}</p>}
                  </div>
                </div>
              )}

              {/* ── SUBTAREFAS ── */}
              {tab === 'subtasks' && (
                <div className="p-5 space-y-3">
                  {isEditable && (
                    <div className="flex gap-2">
                      <input value={newSubtask} onChange={e => setNewSubtask(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddSubtask()}
                        placeholder="Nova subtarefa..."
                        className="flex-1 bg-[#121214] border border-[#1E1E22] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-600" />
                      <button onClick={handleAddSubtask} disabled={savingSubtask || !newSubtask.trim()}
                        className="px-3 py-2 bg-white text-black text-xs font-semibold rounded-lg disabled:opacity-40 flex items-center gap-1.5">
                        {savingSubtask ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Adicionar
                      </button>
                    </div>
                  )}
                  {totalCount === 0 ? (
                    <p className="text-xs text-zinc-600 py-8 text-center">Nenhuma subtarefa ainda.</p>
                  ) : (
                    <div className="space-y-2">
                      {(task.subtasks || []).map(st => (
                        <div key={st.id} onClick={() => isEditable && handleToggleSubtask(st.id)}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                            isEditable ? 'cursor-pointer hover:bg-white/[0.03]' : ''
                          } ${st.completed ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-[#1E1E22] bg-[#121214]/40'}`}>
                          <div className={`w-4 h-4 rounded flex items-center justify-center border ${
                            st.completed ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-600'
                          }`}>
                            {st.completed && <Check size={10} className="text-black" />}
                          </div>
                          <span className={`text-xs ${st.completed ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>{st.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {totalCount > 0 && (
                    <p className="text-[11px] text-zinc-500">{completedCount} de {totalCount} concluídas</p>
                  )}
                </div>
              )}

              {/* ── COMENTÁRIOS ── */}
              {tab === 'comentarios' && (
                <div className="p-5 space-y-4">
                  <div className="space-y-3">
                    {(task.comments || []).length === 0 ? (
                      <p className="text-xs text-zinc-600 py-8 text-center">Nenhum comentário ainda.</p>
                    ) : (
                      (task.comments || []).map(c => (
                        <div key={c.id} className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-3">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-xs font-semibold text-zinc-200">{c.userName}</span>
                            <span className="text-[10px] text-zinc-600">{c.role}</span>
                            <span className="text-[10px] text-zinc-600 ml-auto">{new Date(c.createdAt).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}</span>
                          </div>
                          <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">{c.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-[#1E1E22]">
                    <textarea value={newComment} onChange={e => setNewComment(e.target.value)}
                      placeholder="Escrever comentário..."
                      rows={2}
                      className="flex-1 bg-[#121214] border border-[#1E1E22] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-600 resize-none" />
                    <button onClick={handleSendComment} disabled={sendingComment || !newComment.trim()}
                      className="px-3 py-2 bg-white text-black rounded-lg disabled:opacity-40 flex items-center self-end">
                      {sendingComment ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    </button>
                  </div>
                </div>
              )}

              {/* ── ARQUIVOS ── */}
              {tab === 'arquivos' && (
                <div className="p-5 space-y-4">
                  {isEditable && (
                    <div className="border border-dashed border-[#2E2E34] rounded-xl p-4 space-y-3">
                      <p className="text-xs text-zinc-500 text-center">Selecione um arquivo para anexar (máx 20 MB)</p>
                      <div className="flex gap-2">
                        <select value={docCategory} onChange={e => setDocCategory(e.target.value)}
                          className="bg-[#121214] border border-[#1E1E22] rounded-lg px-3 py-2 text-xs text-white focus:outline-none">
                          {DOC_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                        <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                          className="flex-1 px-3 py-2 bg-[#1a1a1f] border border-[#2E2E34] rounded-lg text-xs text-zinc-300 hover:bg-[#222228] flex items-center justify-center gap-2 disabled:opacity-50">
                          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                          {uploading ? 'Enviando...' : 'Escolher arquivo'}
                        </button>
                        <input ref={fileInputRef} type="file" className="hidden"
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadFile(f); }} />
                      </div>
                    </div>
                  )}

                  {docsLoading ? (
                    <div className="flex items-center justify-center h-20 gap-2 text-zinc-500">
                      <Loader2 size={14} className="animate-spin" /> <span className="text-xs">Carregando...</span>
                    </div>
                  ) : docs.length === 0 ? (
                    <p className="text-xs text-zinc-600 py-6 text-center">Nenhum arquivo anexado.</p>
                  ) : (
                    <div className="space-y-2">
                      {docs.map(doc => (
                        <div key={doc.id} className="flex items-center gap-3 p-3 bg-[#121214]/60 border border-[#1E1E22] rounded-xl">
                          <FileText size={16} className="text-zinc-500 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-zinc-200 truncate">{doc.name}</p>
                            <p className="text-[10px] text-zinc-500 mt-0.5">
                              {doc.category} · {fmtSize(doc.sizeBytes)} · {doc.uploadedBy} · {new Date(doc.uploadedAt).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          <a href={`/api/tasks/${task.id}/documents/${doc.id}`} download={doc.name}
                            className="p-1.5 hover:bg-white/5 text-zinc-500 hover:text-white rounded-lg shrink-0">
                            <Download size={13} />
                          </a>
                          {isEditable && (
                            <button onClick={() => handleDeleteDoc(doc.id)}
                              className="p-1.5 hover:bg-red-500/10 text-zinc-600 hover:text-red-400 rounded-lg shrink-0">
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── HISTÓRICO ── */}
              {tab === 'logs' && (
                <div className="p-5 space-y-2">
                  {(task.logs || []).length === 0 ? (
                    <p className="text-xs text-zinc-600 py-8 text-center">Nenhuma alteração registrada.</p>
                  ) : (
                    [...(task.logs || [])].reverse().map(log => (
                      <div key={log.id} className="text-[10px] text-zinc-400 bg-[#121214] border border-[#1E1E22] rounded-lg p-2.5">
                        <span className="font-bold text-zinc-300">{log.userName}</span>
                        <span className="text-zinc-600 mx-1">alterou</span>
                        <span className="font-bold text-zinc-300">{log.field}</span>
                        {log.oldValue !== 'N/A' && (
                          <> <span className="text-zinc-600 mx-1">de</span><span className="text-zinc-400 line-through">{log.oldValue}</span><span className="text-zinc-600 mx-1">para</span><span className="text-white font-semibold">{log.newValue}</span></>
                        )}
                        <span className="block text-zinc-600 mt-0.5">{new Date(log.date).toLocaleString('pt-BR')}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer — salvar detalhes */}
        {editMode && task && tab === 'detalhes' && (
          <div className="p-5 border-t border-[#1C1C1E] flex items-center justify-end gap-3 flex-shrink-0">
            <button onClick={() => setEditMode(false)} className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 rounded-lg">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="px-5 py-2 text-xs font-semibold text-black bg-white hover:bg-zinc-200 rounded-lg flex items-center gap-1.5 disabled:opacity-60">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        )}
      </div>

      {/* Modal confirmar exclusão */}
      {confirmDelete && task && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmDelete(false)} />
          <div className="relative bg-[#111113] border border-red-900/40 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-950/50 border border-red-900/50 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Excluir tarefa?</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Esta ação não pode ser desfeita</p>
              </div>
            </div>
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3 mb-5">
              <p className="text-xs font-mono text-zinc-500">{task.id}</p>
              <p className="text-sm font-semibold text-white mt-0.5">{task.subject}</p>
              <p className="text-xs text-zinc-400 mt-0.5">{task.project} · {task.sector}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 px-4 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold border border-zinc-700">Cancelar</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2">
                {deleting ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Excluindo...</> : <><Trash2 size={13} />Excluir</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .label { display:block; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#71717a; }
        .val   { font-size:14px; font-weight:600; color:#fff; margin-top:4px; }
        .field { display:block; width:100%; background:#121214; border:1px solid #1E1E22; border-radius:8px; padding:8px 12px; font-size:12px; color:#fff; }
        .field:focus { outline:none; border-color:#3f3f46; }
      `}</style>
    </>
  );
}
