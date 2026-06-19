'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2,
  TrendingUp,
  FolderOpen,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  X,
  Upload,
  Camera,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Task, Project } from '@/lib/db';
import { useUser } from '@/context/UserContext';

export default function ProjectsPage() {
  const { currentUser } = useUser();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal de Criação
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newBanner, setNewBanner] = useState<string | null>(null);

  // Upload de banner em projeto existente
  const [uploadingBanner, setUploadingBanner] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const resProj = await fetch('/api/projects');
      const dataProj = await resProj.json();

      const resTasks = await fetch('/api/tasks');
      const dataTasks = await resTasks.json();

      setProjects(dataProj.projects || []);
      setTasks(dataTasks.tasks || []);
    } catch (e) {
      console.error('Erro ao buscar empreendimentos:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchData();
    });
  }, []);

  const getProjectStats = (projectName: string) => {
    const projTasks = tasks.filter(t => t.project.toLowerCase() === projectName.toLowerCase());
    const total = projTasks.length;
    const finished = projTasks.filter(t => t.statusAndamento === 'Finalizado').length;
    const active = total - finished;

    return { total, finished, active };
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'finalizado': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'em andamento': return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'não iniciado': return 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20';
      default: return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
    }
  };

  const handleProjectBannerUpdate = async (projId: string, file: File) => {
    setUploadingBanner(projId);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const res = await fetch('/api/projects', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: projId, banner: base64 })
        });
        if (res.ok) {
          setProjects(prev => prev.map(p => p.id === projId ? { ...p, banner: base64 } : p));
        }
        setUploadingBanner(null);
      };
      reader.readAsDataURL(file);
    } catch {
      setUploadingBanner(null);
    }
  };

  // Trata upload da foto/banner do projeto
  const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewBanner(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Submeter criação do projeto
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const payload = {
      name: newName.trim(),
      description: newDesc.trim(),
      banner: newBanner // Base64 ou nulo
    };

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setCreateModalOpen(false);
        setNewName('');
        setNewDesc('');
        setNewBanner(null);
        fetchData();
        alert('Empreendimento cadastrado com sucesso!');
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao cadastrar empreendimento');
      }
    } catch (err) {
      console.error('Erro de requisição:', err);
    }
  };

  return (
    <div className="flex-1 p-6 lg:p-10 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#1C1C1E] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-400">
              Operações Imobiliárias
            </span>
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-white mt-1">Nossos Empreendimentos</h2>
          <p className="text-sm text-zinc-400 mt-0.5">Gestão centralizada de portfólio físico e processos.</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={fetchData}
            className="p-2.5 bg-[#121214] hover:bg-[#18181B] border border-[#1E1E22] text-zinc-400 hover:text-white rounded-lg transition-colors flex items-center gap-1.5 text-xs"
            title="Atualizar dados"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          {(currentUser.role === 'Diretoria' || currentUser.role === 'Desenvolvedor' || currentUser.role === 'Operador' || currentUser.permissions?.manageProjects) && (
            <button 
              onClick={() => setCreateModalOpen(true)}
              className="bg-white hover:bg-zinc-200 text-black px-4.5 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all duration-200 shadow-md"
            >
              <Plus size={16} />
              <span>Novo Empreendimento</span>
            </button>
          )}
        </div>
      </header>

      {/* Grid de Empreendimentos */}
      {loading ? (
        <div className="py-20 text-center text-zinc-500 flex flex-col items-center justify-center gap-2">
          <RefreshCw size={24} className="animate-spin text-zinc-400" />
          <p className="text-sm">Carregando carteira de projetos...</p>
        </div>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((proj) => {
            const stats = getProjectStats(proj.name);
            const projectUrl = `/project-vision/projects/${proj.id}`;
            const canEdit = currentUser.role === 'Diretoria' || currentUser.role === 'Desenvolvedor' || currentUser.role === 'Operador';

            return (
              <div
                key={proj.id}
                className="bg-[#121214]/60 border border-[#1E1E22] rounded-xl overflow-hidden hover:border-zinc-700 transition-all duration-300 group flex flex-col justify-between shadow-xl"
              >
                {/* Banner / Capa */}
                <div className="relative h-40 w-full overflow-hidden bg-[#09090B] border-b border-[#1C1C1E] flex items-center justify-center">
                  {!proj.banner ? (
                    <div className="absolute inset-0 bg-[#09090B] flex items-center justify-center p-6 border-b border-[#1C1C1E]">
                      <div className="relative w-32 h-12">
                        <Image
                          src="/logolongview.png"
                          alt="LongView Fallback Logo"
                          fill
                          style={{ objectFit: 'contain' }}
                        />
                      </div>
                    </div>
                  ) : (
                    <Image
                      src={proj.banner}
                      alt={proj.name}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />

                  {/* Botão de alterar imagem */}
                  {canEdit && (
                    <label
                      htmlFor={`banner-${proj.id}`}
                      className="absolute top-2 right-2 z-20 p-2 bg-black/60 hover:bg-black/85 text-white rounded-lg cursor-pointer opacity-0 group-hover:opacity-100 transition-all duration-200 border border-white/10"
                      title="Alterar imagem do empreendimento"
                      onClick={e => e.stopPropagation()}
                    >
                      {uploadingBanner === proj.id
                        ? <Loader2 size={14} className="animate-spin" />
                        : <Camera size={14} />}
                      <input
                        id={`banner-${proj.id}`}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleProjectBannerUpdate(proj.id, file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                  
                  {/* Nome e Status */}
                  <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between z-10">
                    <h3 className="text-lg font-bold text-white tracking-wide">{proj.name}</h3>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${getStatusBadgeColor(proj.status)}`}>
                      {proj.status}
                    </span>
                  </div>
                </div>

                {/* Info do Projeto */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                    {proj.description}
                  </p>

                  {/* Estatísticas Rápidas */}
                  <div className="grid grid-cols-3 gap-2 bg-black/30 border border-[#1C1C1E] p-3 rounded-lg text-center">
                    <div>
                      <span className="block text-xs font-bold text-white">{stats.total}</span>
                      <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wide">Tarefas</span>
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-emerald-400">{stats.finished}</span>
                      <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wide">Finalizadas</span>
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-amber-400">{stats.active}</span>
                      <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wide">Ativas</span>
                    </div>
                  </div>

                  {/* Progresso com barra de temperatura */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold text-zinc-400 tracking-wider">
                      <span>Progresso Conclusão</span>
                      <span className={`font-mono font-bold ${
                        proj.progress >= 80 ? 'text-emerald-400' :
                        proj.progress >= 60 ? 'text-lime-400' :
                        proj.progress >= 35 ? 'text-amber-400' :
                        proj.progress >= 15 ? 'text-orange-400' :
                        'text-red-400'
                      }`}>{proj.progress}%</span>
                    </div>
                    <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-700 ${
                          proj.progress >= 80 ? 'bg-emerald-500' :
                          proj.progress >= 60 ? 'bg-lime-500' :
                          proj.progress >= 35 ? 'bg-amber-500' :
                          proj.progress >= 15 ? 'bg-orange-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${proj.progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Link */}
                <div className="px-5 py-3 border-t border-[#1C1C1E] bg-[#121214]/30 flex justify-end">
                  <Link 
                    href={projectUrl} 
                    className="text-zinc-400 hover:text-white flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors"
                  >
                    <span>Gerenciar Operação</span>
                    <ArrowRight size={12} className="transition-transform duration-200 group-hover:translate-x-1" />
                  </Link>
                </div>

              </div>
            );
          })}
        </section>
      )}

      {/* MODAL DE CADASTRO DE EMPREENDIMENTO */}
      {createModalOpen && (
        <>
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 animate-in fade-in" onClick={() => setCreateModalOpen(false)} />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-50 animate-in zoom-in-95 duration-200 pointer-events-none">
            <div className="bg-[#09090B] border border-[#1E1E22] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col justify-between pointer-events-auto">
              
              <div className="p-5 border-b border-[#1C1C1E] flex justify-between items-center bg-[#121214]/60">
                <h3 className="text-base font-bold text-white">Criar Novo Empreendimento</h3>
                <button onClick={() => setCreateModalOpen(false)} className="p-1 hover:bg-white/5 text-zinc-400 hover:text-white rounded-lg">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateProject} className="p-6 space-y-4.5 overflow-y-auto max-h-[85vh]">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Nome do Empreendimento</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Villa Alta Residencial"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="bg-[#121214] border border-[#1E1E22] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-700"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Descrição / Apresentação</label>
                  <textarea
                    rows={3}
                    placeholder="Resumo executivo do projeto imobiliário..."
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="bg-[#121214] border border-[#1E1E22] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-700 resize-none"
                  />
                </div>

                {/* Upload de Imagem de Banner */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">Foto de Capa (Banner)</label>
                  <div className="flex items-start gap-4">
                    <label className="flex-1 border border-dashed border-[#2B2B30] hover:border-zinc-500 rounded-lg p-5 flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-black/10 hover:bg-black/20 transition-all text-center">
                      <Upload size={18} className="text-zinc-400" />
                      <span className="text-[10px] font-semibold text-zinc-300">Escolher imagem de capa</span>
                      <span className="text-[8px] text-zinc-500">Deixe vazio para usar o logo padrão da LongView</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleBannerUpload} 
                        className="hidden" 
                      />
                    </label>

                    {/* Preview de Banner */}
                    <div className="w-28 h-20 rounded-lg overflow-hidden border border-[#2B2B30] relative bg-[#09090B] flex items-center justify-center shrink-0">
                      {newBanner ? (
                        <img 
                          src={newBanner} 
                          alt="Banner Preview" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="relative w-16 h-8 opacity-40">
                          <Image 
                            src="/logolongview.png" 
                            alt="Logo Fallback Preview" 
                            fill
                            style={{ objectFit: 'contain' }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex justify-end gap-3 pt-4 border-t border-[#1C1C1E]">
                  <button 
                    type="button" 
                    onClick={() => setCreateModalOpen(false)}
                    className="bg-transparent hover:bg-white/5 border border-zinc-700 text-zinc-300 px-4.5 py-2 rounded-lg text-xs font-semibold"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="bg-white hover:bg-zinc-200 text-black px-5 py-2 rounded-lg text-xs font-semibold"
                  >
                    Criar Empreendimento
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
