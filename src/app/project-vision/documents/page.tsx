'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FolderOpen, Search, Download, RefreshCw,
  Paperclip, Filter, X, Loader2, Plus, Upload,
} from 'lucide-react';
import type { DocumentWithContext } from '@/app/api/documents/route';
import { useUser } from '@/context/UserContext';

const CATEGORIES = ['Todos', 'contrato', 'proposta', 'planta', 'foto', 'aprovacao', 'ata', 'outro'];
const CAT_LABEL: Record<string, string> = {
  contrato: 'Contrato', proposta: 'Proposta', planta: 'Planta',
  foto: 'Foto', aprovacao: 'Aprovação', ata: 'Ata', outro: 'Outro',
};

function fmtSize(bytes?: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fileIcon(contentType?: string | null) {
  if (!contentType) return '📄';
  if (contentType.startsWith('image/')) return '🖼️';
  if (contentType === 'application/pdf') return '📕';
  if (contentType.includes('word') || contentType.includes('document')) return '📝';
  if (contentType.includes('sheet') || contentType.includes('excel')) return '📊';
  if (contentType.includes('zip') || contentType.includes('compressed')) return '📦';
  return '📄';
}

export default function DocumentsPage() {
  const { currentUser } = useUser();
  const isEditable = ['Desenvolvedor', 'Diretoria', 'Operador', 'Gestor'].includes(currentUser.role)
    || currentUser.permissions?.manageProjects === true;

  const [docs,     setDocs]     = useState<DocumentWithContext[]>([]);
  const [tasks,    setTasks]    = useState<{ id: string; subject: string; project: string }[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  const [loading,  setLoading]  = useState(true);

  // Filtros
  const [q,          setQ]          = useState('');
  const [filterCat,  setFilterCat]  = useState('Todos');
  const [filterProj, setFilterProj] = useState('Todos');

  // Modal upload
  const [uploadOpen,    setUploadOpen]    = useState(false);
  const [uploadTask,    setUploadTask]    = useState('');
  const [uploadCat,     setUploadCat]     = useState('outro');
  const [uploadFile,    setUploadFile]    = useState<File | null>(null);
  const [uploading,     setUploading]     = useState(false);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q && q.trim())              params.set('q', q.trim());
      if (filterCat !== 'Todos')      params.set('category', filterCat);
      if (filterProj !== 'Todos')     params.set('project', filterProj);

      const res = await fetch(`/api/documents?${params}`);
      const data = await res.json();
      setDocs(data.documents ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [q, filterCat, filterProj]);

  // Carrega tarefas para o modal de upload
  const fetchTasks = useCallback(async () => {
    try {
      const res  = await fetch('/api/tasks');
      const data = await res.json();
      const list = (data.tasks ?? []) as { id: string; subject: string; project: string }[];
      setTasks(list);
      const projs = [...new Set(list.map(t => t.project).filter(Boolean))].sort();
      setProjects(projs);
      if (!uploadTask && list.length > 0) setUploadTask(list[0].id);
    } catch { /* ignora */ }
  }, [uploadTask]);

  useEffect(() => {
    const id = window.setTimeout(() => { void fetchDocs(); }, 0);
    return () => window.clearTimeout(id);
  }, [fetchDocs]);
  useEffect(() => {
    if (!uploadOpen) return;
    const id = window.setTimeout(() => { void fetchTasks(); }, 0);
    return () => window.clearTimeout(id);
  }, [uploadOpen, fetchTasks]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !uploadTask) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', uploadFile);
      form.append('category', uploadCat);
      const res = await fetch(`/api/tasks/${uploadTask}/documents`, { method: 'POST', body: form });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? 'Erro ao enviar arquivo');
        return;
      }
      setUploadOpen(false);
      setUploadFile(null);
      fetchDocs();
    } finally {
      setUploading(false);
    }
  };

  const clearFilters = () => { setQ(''); setFilterCat('Todos'); setFilterProj('Todos'); };
  const hasFilters   = q || filterCat !== 'Todos' || filterProj !== 'Todos';

  return (
    <div className="flex-1 w-full space-y-5 p-4 md:p-6 lg:px-6 lg:py-4">

      {/* Header */}
      <header className="flex items-center justify-between border-b border-[#1C1C1E] pb-4">
        <div className="flex items-center gap-2 text-zinc-400">
          <Paperclip size={16} />
          <span className="text-sm font-semibold text-white">Documentos</span>
          {!loading && (
            <span className="text-xs text-zinc-500">— {docs.length} arquivo{docs.length !== 1 ? 's' : ''}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchDocs}
            className="p-2.5 bg-[#121214] hover:bg-[#18181B] border border-[#1E1E22] text-zinc-400 hover:text-white rounded-lg transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          {isEditable && (
            <button onClick={() => setUploadOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white text-black text-xs font-bold rounded-lg hover:bg-zinc-200 transition-colors">
              <Plus size={13} /> Anexar Arquivo
            </button>
          )}
        </div>
      </header>

      {/* Filtros */}
      <section className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Filter size={13} />
            <span className="font-semibold">Filtros</span>
          </div>
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-white">
              <X size={11} /> Limpar
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Busca */}
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-2.5 text-zinc-500" />
            <input type="text" placeholder="Buscar por nome, tarefa, empreendimento, responsável..."
              value={q} onChange={e => setQ(e.target.value)}
              className="w-full bg-[#0A0A0B] border border-[#1E1E22] rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-zinc-700" />
          </div>

          {/* Categoria */}
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
            className="bg-[#0A0A0B] border border-[#1E1E22] rounded-lg px-3 py-2 text-xs text-white focus:outline-none">
            {CATEGORIES.map(c => <option key={c} value={c}>{c === 'Todos' ? 'Todas categorias' : CAT_LABEL[c] ?? c}</option>)}
          </select>

          {/* Projeto */}
          <select value={filterProj} onChange={e => setFilterProj(e.target.value)}
            className="bg-[#0A0A0B] border border-[#1E1E22] rounded-lg px-3 py-2 text-xs text-white focus:outline-none">
            <option value="Todos">Todos os empreendimentos</option>
            {projects.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </section>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-zinc-500">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Buscando documentos...</span>
        </div>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-zinc-600">
          <FolderOpen size={36} />
          <p className="text-sm">Nenhum documento encontrado.</p>
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-zinc-500 hover:text-white underline">Limpar filtros</button>
          )}
        </div>
      ) : (
        <div className="bg-[#121214]/40 border border-[#1E1E22] rounded-xl overflow-hidden">
          <table className="w-full text-left">
            <thead className="border-b border-[#1C1C1E] bg-[#0E0E10] text-[11px] uppercase font-bold text-zinc-500 tracking-wider">
              <tr>
                <th className="py-3 px-4">Arquivo</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4">Tarefa</th>
                <th className="py-3 px-4">Empreendimento</th>
                <th className="py-3 px-4">Enviado por</th>
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4">Tamanho</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1C1C1E]">
              {docs.map(doc => (
                <tr key={doc.id} className="hover:bg-[#17171A] transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base leading-none">{fileIcon(doc.contentType)}</span>
                      <span className="text-xs font-medium text-white max-w-[200px] truncate" title={doc.name}>
                        {doc.name}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-[11px] px-2 py-0.5 rounded-full border border-[#2E2E34] bg-[#1a1a1f] text-zinc-400">
                      {CAT_LABEL[doc.category] ?? doc.category}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-zinc-400 max-w-[200px]">
                    <span className="truncate block" title={doc.taskSubject}>{doc.taskSubject}</span>
                  </td>
                  <td className="py-3 px-4 text-xs text-zinc-400 whitespace-nowrap">{doc.project}</td>
                  <td className="py-3 px-4 text-xs text-zinc-500 whitespace-nowrap">{doc.uploadedBy}</td>
                  <td className="py-3 px-4 text-xs text-zinc-500 whitespace-nowrap font-mono">{fmtDate(doc.uploadedAt)}</td>
                  <td className="py-3 px-4 text-xs text-zinc-600 whitespace-nowrap">{fmtSize(doc.sizeBytes)}</td>
                  <td className="py-3 px-4">
                    <a href={doc.downloadUrl} download={doc.name}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-[11px] rounded-lg transition-colors border border-white/5">
                      <Download size={11} /> Baixar
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal upload */}
      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setUploadOpen(false)} />
          <div className="relative bg-[#111113] border border-[#1E1E22] rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Upload size={14} /> Anexar Arquivo a uma Tarefa
              </h3>
              <button onClick={() => setUploadOpen(false)} className="text-zinc-500 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
              {/* Tarefa */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">Tarefa *</label>
                <select value={uploadTask} onChange={e => setUploadTask(e.target.value)} required
                  className="w-full bg-[#1a1a1f] border border-[#2E2E34] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-600">
                  {tasks.map(t => (
                    <option key={t.id} value={t.id}>{t.id} — {t.subject} ({t.project})</option>
                  ))}
                </select>
              </div>

              {/* Categoria */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">Categoria</label>
                <select value={uploadCat} onChange={e => setUploadCat(e.target.value)}
                  className="w-full bg-[#1a1a1f] border border-[#2E2E34] rounded-lg px-3 py-2 text-xs text-white focus:outline-none">
                  {Object.entries(CAT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              {/* Arquivo */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">Arquivo * (máx 200 MB)</label>
                <input type="file" required onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
                  className="w-full bg-[#1a1a1f] border border-[#2E2E34] rounded-lg px-3 py-2 text-xs text-zinc-300 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-zinc-700 file:text-white" />
                {uploadFile && (
                  <p className="text-[11px] text-zinc-500 mt-1">{uploadFile.name} — {fmtSize(uploadFile.size)}</p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setUploadOpen(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold border border-zinc-700">
                  Cancelar
                </button>
                <button type="submit" disabled={uploading || !uploadFile || !uploadTask}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-white hover:bg-zinc-200 disabled:opacity-50 text-black text-xs font-bold flex items-center justify-center gap-2">
                  {uploading ? <><Loader2 size={13} className="animate-spin" /> Enviando...</> : <><Upload size={13} /> Enviar</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
