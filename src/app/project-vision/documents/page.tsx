'use client';

import React, { useState, useEffect } from 'react';
import { 
  FolderArchive, 
  Search, 
  Filter, 
  FileText, 
  Download, 
  Plus, 
  History, 
  User, 
  Calendar,
  Layers,
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import { Task, Document } from '@/lib/db';
import { useUser } from '@/context/UserContext';

interface EnhancedDocument extends Document {
  taskSubject: string;
  taskId: string;
  projectName: string;
}

export default function DocumentsPage() {
  const { currentUser } = useUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');

  // Modal para upload global real
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [newDocCat, setNewDocCat] = useState('Projetos');
  const [newDocProject, setNewDocProject] = useState('Villa Alta');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tasks');
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (e) {
      console.error('Erro ao buscar tarefas:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchData();
    });
  }, []);

  // Compilar todos os documentos anexados das tarefas em uma lista única consolidada
  const documentsList: EnhancedDocument[] = [];
  tasks.forEach(t => {
    if (t.documents && t.documents.length > 0) {
      t.documents.forEach(doc => {
        documentsList.push({
          ...doc,
          taskSubject: t.subject,
          taskId: t.id,
          projectName: t.project
        });
      });
    }
  });

  // Filtros aplicados localmente no cliente
  const categories = ['Todos', 'Projetos', 'Processos', 'Documentação', 'Contratos', 'Marketing'];

  const filteredDocs = documentsList.filter(doc => {
    const matchesSearch = !searchQuery ? true : (
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.uploader.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.projectName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const matchesCategory = selectedCategory === 'Todos' || doc.category.toLowerCase() === selectedCategory.toLowerCase();

    return matchesSearch && matchesCategory;
  });

  const handleUploadReal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    // Encontra a primeira tarefa correspondente ao projeto para receber o anexo
    const targetTask = tasks.find(t => t.project.toLowerCase() === newDocProject.toLowerCase());
    
    if (!targetTask) {
      alert(`Nenhuma tarefa encontrada para o projeto ${newDocProject} para receber o anexo.`);
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (!uploadRes.ok) {
        throw new Error('Falha no upload do arquivo físico.');
      }

      const uploadData = await uploadRes.json();

      const doc: Document = {
        id: `doc-${Date.now()}`,
        name: uploadData.name,
        category: newDocCat,
        uploadDate: new Date().toLocaleDateString('pt-BR'),
        uploader: currentUser.name,
        version: 1,
        url: uploadData.url,
        size: uploadData.size
      };

      const res = await fetch(`/api/tasks/${targetTask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documents: [...(targetTask.documents || []), doc],
          currentUser
        })
      });

      if (res.ok) {
        setUploadOpen(false);
        setSelectedFile(null);
        fetchData();
        alert('Documento corporativo anexado e salvo com sucesso!');
      } else {
        alert('Erro ao vincular documento à tarefa.');
      }
    } catch (e) {
      console.error('Erro ao fazer upload:', e);
      alert('Erro ao realizar upload do documento.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 p-6 lg:p-10 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#1C1C1E] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-400">
              Arquivos Corporativos
            </span>
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-white mt-1">Central de Documentos</h2>
          <p className="text-sm text-zinc-400 mt-0.5">Repositório unificado de licenças, plantas, contratos e relatórios.</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={fetchData}
            className="p-2.5 bg-[#121214] hover:bg-[#18181B] border border-[#1E1E22] text-zinc-400 hover:text-white rounded-lg transition-colors flex items-center gap-1.5 text-xs"
            title="Atualizar dados"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          
          <button 
            onClick={() => setUploadOpen(true)}
            className="bg-white hover:bg-zinc-200 text-black px-4.5 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all duration-200"
          >
            <Plus size={16} />
            <span>Upload Documento</span>
          </button>
        </div>
      </header>

      {/* Painel de Filtros e Busca */}
      <section className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-4.5 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3.5 top-3.5 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Buscar documento por nome, empreendimento, uploader..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0A0A0B] border border-[#1E1E22] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-zinc-700 transition-colors"
            />
          </div>
          
          <div className="w-56 flex items-center gap-2 bg-[#0A0A0B] border border-[#1E1E22] rounded-lg px-3 py-1.5 text-xs text-zinc-300">
            <Filter size={14} className="text-zinc-500" />
            <span className="font-medium shrink-0">Categoria:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer w-full"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Grade de Documentos */}
      {loading ? (
        <div className="py-20 text-center text-zinc-500 flex flex-col items-center justify-center gap-2">
          <RefreshCw size={24} className="animate-spin text-zinc-400" />
          <p className="text-sm">Buscando repositório de arquivos...</p>
        </div>
      ) : filteredDocs.length === 0 ? (
        <section className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-16 text-center text-zinc-500 flex flex-col items-center justify-center gap-3 shadow-xl">
          <FolderOpen size={36} className="text-zinc-600 animate-pulse" />
          <p className="text-sm font-medium">Nenhum documento anexado ou encontrado.</p>
        </section>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map((doc) => (
            <div 
              key={doc.id}
              className="bg-[#121214]/60 border border-[#1E1E22] p-4.5 rounded-xl hover:border-zinc-700 transition-all duration-300 flex flex-col justify-between shadow-lg group relative overflow-hidden"
            >
              {/* Info Superior */}
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center border border-zinc-700 shrink-0">
                    <FileText size={18} className="text-zinc-400" />
                  </div>
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded border border-white/10 text-zinc-400 uppercase tracking-wider">
                    v{doc.version}.0
                  </span>
                </div>

                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-white truncate" title={doc.name}>
                    {doc.name}
                  </h4>
                  <div className="flex items-center gap-1.5 text-[9px] text-zinc-500">
                    <span className="font-semibold text-zinc-400">{doc.category}</span>
                    <span>•</span>
                    <span className="truncate">{doc.projectName}</span>
                  </div>
                </div>
              </div>

              {/* Detalhes de autoria e tarefa */}
              <div className="border-t border-[#1C1C1E] mt-4 pt-3.5 space-y-2 text-[10px] text-zinc-500">
                <p className="truncate" title={doc.taskSubject}>
                  <span className="font-semibold text-zinc-400">Atividade:</span> {doc.taskSubject}
                </p>
                <div className="flex justify-between items-center pt-0.5">
                  <span className="flex items-center gap-1"><User size={10} /> {doc.uploader}</span>
                  <span className="flex items-center gap-1"><Calendar size={10} /> {doc.uploadDate}</span>
                </div>
              </div>

              {/* Botões Rápidos */}
              <div className="mt-4 flex justify-end gap-2.5">
                <button 
                  onClick={() => alert(`Versão ${doc.version}.0. Histórico de auditoria: Nenhuma alteração de versão registrada.`)}
                  className="p-1.5 text-zinc-500 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg transition-colors flex items-center gap-1 text-[9px] font-bold"
                  title="Histórico de versionamento"
                >
                  <History size={12} />
                  <span>Versionamento</span>
                </button>
                <a 
                  href={doc.url}
                  download={doc.name}
                  className="bg-white hover:bg-zinc-200 text-black px-3.5 py-1.5 rounded-lg text-[9px] font-bold flex items-center gap-1 transition-colors"
                >
                  <Download size={12} />
                  <span>Download</span>
                </a>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Modal de Simulação de Upload */}
      {uploadOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in" onClick={() => setUploadOpen(false)} />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-50 animate-in zoom-in-95 duration-200">
            <div className="bg-[#09090B] border border-[#1E1E22] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
              
              <div className="p-5 border-b border-[#1C1C1E] bg-[#121214]/60 flex justify-between items-center">
                <h3 className="text-sm font-bold text-white">Anexar Documento ao Empreendimento</h3>
              </div>

              <form onSubmit={handleUploadReal} className="p-6 space-y-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Selecionar Arquivo (Obrigatório)</label>
                  <input
                    type="file"
                    required
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="bg-[#121214] border border-[#1E1E22] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-700 w-full"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Categoria</label>
                    <select
                      value={newDocCat}
                      onChange={(e) => setNewDocCat(e.target.value)}
                      className="bg-[#121214] border border-[#1E1E22] rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                    >
                      <option value="Projetos">Projetos</option>
                      <option value="Processos">Processos</option>
                      <option value="Documentação">Documentação</option>
                      <option value="Contratos">Contratos</option>
                      <option value="Marketing">Marketing</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Projeto</label>
                    <select
                      value={newDocProject}
                      onChange={(e) => setNewDocProject(e.target.value)}
                      className="bg-[#121214] border border-[#1E1E22] rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                    >
                      <option value="Villa Alta">Villa Alta</option>
                      <option value="Varandas">Varandas</option>
                      <option value="Jerivá">Jerivá</option>
                      <option value="Ride">Ride</option>
                      <option value="Altana">Altana</option>
                      <option value="Cacupé">Cacupé</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-[#1C1C1E]">
                  <button 
                    type="button" 
                    onClick={() => setUploadOpen(false)}
                    className="bg-transparent hover:bg-white/5 border border-zinc-700 text-zinc-300 px-4 py-2 rounded-lg text-xs font-semibold"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="bg-white hover:bg-zinc-200 text-black px-4 py-2 rounded-lg text-xs font-semibold"
                  >
                    Anexar Arquivo
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
