'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  RefreshCw, 
  Briefcase, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  ExternalLink,
  Plus,
  Phone,
  Mail,
  Building,
  Upload,
  X,
  Sliders
} from 'lucide-react';
import { Task, Project, Responsible } from '@/lib/db';
import { useUser } from '@/context/UserContext';
import ResponsibleModal from '@/components/ResponsibleModal';
import TaskDrawer from '@/components/TaskDrawer';

interface CombinedStats extends Responsible {
  total: number;
  completed: number;
  active: number;
  delayed: number;
  critical: number;
  projects: string[];
}

export default function ResponsiblesPage() {
  const { currentUser } = useUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [responsibles, setResponsibles] = useState<Responsible[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modais
  const [selectedRespName, setSelectedRespName] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Form de Cadastro
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newPhoto, setNewPhoto] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [posX, setPosX] = useState(50);
  const [posY, setPosY] = useState(50);

  const fetchData = async () => {
    setLoading(true);
    try {
      const resTasks = await fetch('/api/tasks');
      const dataTasks = await resTasks.json();
      setTasks(dataTasks.tasks || []);

      const resResp = await fetch('/api/responsibles');
      const dataResp = await resResp.json();
      setResponsibles(dataResp.responsibles || []);
    } catch (e) {
      console.error('Erro ao buscar dados na página de responsáveis:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchData();
    });
  }, []);

  // Trata upload de imagem de perfil
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewPhoto(reader.result as string);
        setZoom(1);
        setPosX(50);
        setPosY(50);
      };
      reader.readAsDataURL(file);
    }
  };

  // Submeter cadastro
  const handleCreateResponsible = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const payload = {
      name: newName.trim(),
      phone: newPhone.trim(),
      email: newEmail.trim(),
      company: newCompany.trim() || 'LongView',
      photo: newPhoto,
      photoPosition: newPhoto ? { x: posX, y: posY, zoom } : null
    };

    try {
      const res = await fetch('/api/responsibles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setCreateModalOpen(false);
        setNewName('');
        setNewPhone('');
        setNewEmail('');
        setNewCompany('');
        setNewPhoto(null);
        fetchData();
        alert('Responsável cadastrado com sucesso!');
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao cadastrar responsável');
      }
    } catch (err) {
      console.error('Erro de requisição:', err);
    }
  };

  // Helper para verificar atraso
  const SIMULATED_NOW = new Date('2026-05-23');
  const isTaskDelayed = (t: Task) => {
    if (t.statusAndamento === 'Finalizado' || !t.previsaoEntrega) return false;
    const parts = t.previsaoEntrega.split('/');
    if (parts.length === 3) {
      let year = parseInt(parts[2]);
      if (year < 100) year += 2000;
      const prevDate = new Date(year, parseInt(parts[1]) - 1, parseInt(parts[0]));
      return prevDate < SIMULATED_NOW;
    }
    return false;
  };

  // Mesclar responsáveis cadastrados com suas estatísticas calculadas de tarefas
  const getCombinedStats = (): CombinedStats[] => {
    return responsibles.map(resp => {
      // Filtra tarefas onde o responsável participa (como primário ou secundário)
      const respTasks = tasks.filter(t => 
        (t.responsible && t.responsible.toLowerCase() === resp.name.toLowerCase()) ||
        (t.secondaryResponsibles && t.secondaryResponsibles.some(sr => sr.toLowerCase() === resp.name.toLowerCase()))
      );

      const total = respTasks.length;
      const completed = respTasks.filter(t => t.statusAndamento === 'Finalizado').length;
      const active = total - completed;
      const delayed = respTasks.filter(t => t.statusAndamento !== 'Finalizado' && isTaskDelayed(t)).length;
      const critical = respTasks.filter(t => t.statusAndamento !== 'Finalizado' && (t.urgencia === 'Crítica' || t.urgencia === 'Emergencial')).length;
      const projects = Array.from(new Set(respTasks.map(t => t.project).filter(Boolean)));

      return {
        ...resp,
        total,
        completed,
        active,
        delayed,
        critical,
        projects
      };
    });
  };

  const combinedStats = getCombinedStats();

  // Filtrar pela barra de pesquisa
  const filteredStats = combinedStats.filter(stats => {
    const query = searchQuery.toLowerCase();
    return (
      stats.name.toLowerCase().includes(query) ||
      stats.company.toLowerCase().includes(query) ||
      stats.email.toLowerCase().includes(query) ||
      stats.projects.some(p => p.toLowerCase().includes(query))
    );
  });

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Diretoria': return 'bg-red-500/10 text-red-400 border border-red-500/30';
      case 'Equipe Interna': return 'bg-blue-500/10 text-blue-400 border border-blue-500/30';
      case 'Parceiro': return 'bg-amber-500/10 text-amber-400 border border-amber-500/30';
      default: return 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/30';
    }
  };

  return (
    <div className="flex-1 p-6 lg:p-10 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#1C1C1E] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-400">
              Operação & Recursos
            </span>
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-white mt-1">Responsáveis & Executores</h2>
          <p className="text-sm text-zinc-400 mt-0.5">Central de controle de carga de trabalho, gargalos e tarefas de cada executor.</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={fetchData}
            className="p-2.5 bg-[#121214] hover:bg-[#18181B] border border-[#1E1E22] text-zinc-400 hover:text-white rounded-lg transition-colors flex items-center gap-1.5 text-xs"
            title="Atualizar dados"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          {currentUser.role === 'Diretoria' && (
            <button 
              onClick={() => setCreateModalOpen(true)}
              className="bg-white hover:bg-zinc-200 text-black px-4.5 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all duration-200 shadow-md"
            >
              <Plus size={16} />
              <span>Cadastrar Executor</span>
            </button>
          )}
        </div>
      </header>

      {/* Busca e Resumos Rápidos */}
      <section className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <Search size={16} className="absolute left-3.5 top-3.5 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Filtrar por nome, empresa, e-mail ou projeto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#121214]/60 border border-[#1E1E22] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-zinc-700 transition-colors"
          />
        </div>
        
        <div className="flex gap-4 text-xs text-zinc-400 self-end md:self-auto shrink-0">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-zinc-500" />
            <span>Total de Executores: <strong className="text-white font-mono">{responsibles.length}</strong></span>
          </div>
        </div>
      </section>

      {/* Grid de Responsáveis */}
      {loading ? (
        <div className="py-20 text-center text-zinc-500 flex flex-col items-center justify-center gap-3">
          <RefreshCw size={24} className="animate-spin text-zinc-400" />
          <p className="text-sm">Carregando painel de responsáveis...</p>
        </div>
      ) : filteredStats.length === 0 ? (
        <div className="py-20 text-center text-zinc-500 border border-dashed border-[#1E1E22] rounded-2xl">
          Nenhum executor cadastrado atende a esses critérios.
        </div>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStats.map((stats) => {
            const hasDelayed = stats.delayed > 0;
            const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

            return (
              <div 
                key={stats.name}
                onClick={() => setSelectedRespName(stats.name)}
                className="bg-[#121214]/40 border border-[#1E1E22] hover:border-zinc-700 p-5 rounded-2xl flex flex-col justify-between space-y-5 cursor-pointer transition-all duration-300 hover:bg-[#18181B]/50 hover:-translate-y-0.5 group relative overflow-hidden"
              >
                {hasDelayed && (
                  <div className="absolute -right-16 -top-16 w-32 h-32 rounded-full bg-red-500/5 blur-3xl pointer-events-none group-hover:bg-red-500/10 transition-all duration-300" />
                )}

                {/* Avatar e Info */}
                <div className="flex items-start gap-4">
                  {stats.photo ? (
                    <div className="w-11 h-11 rounded-full border border-[#2B2B30] overflow-hidden relative shrink-0">
                      <img 
                        src={stats.photo} 
                        alt={stats.name} 
                        className="absolute w-full h-full object-cover"
                        style={{
                          transform: `scale(${stats.photoPosition?.zoom || 1})`,
                          transformOrigin: 'center',
                          objectPosition: `${stats.photoPosition?.x ?? 50}% ${stats.photoPosition?.y ?? 50}%`
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-white font-black text-sm shrink-0">
                      {stats.name.charAt(0)}
                    </div>
                  )}
                  
                  <div className="overflow-hidden flex-1">
                    <h4 className="text-sm font-bold text-white group-hover:underline truncate">{stats.name}</h4>
                    <p className="text-[10px] text-zinc-500 truncate mt-0.5">{stats.email}</p>
                    {stats.phone && (
                      <p className="text-[9px] text-zinc-400 mt-1 font-mono">{stats.phone}</p>
                    )}
                    <div className="mt-2.5">
                      <span className={`inline-block text-[8px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${getRoleColor(stats.company === 'LongView' ? 'Equipe Interna' : 'Parceiro')}`}>
                        {stats.company}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Projetos Ativos */}
                <div className="space-y-1.5 border-t border-[#1C1C1E] pt-3">
                  <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider block">Projetos Ativos</span>
                  <div className="flex flex-wrap gap-1">
                    {stats.projects.length === 0 ? (
                      <span className="text-[9px] text-zinc-600">Nenhum</span>
                    ) : (
                      stats.projects.slice(0, 3).map(p => (
                        <span key={p} className="text-[9px] bg-zinc-800/60 border border-[#1E1E22] px-1.5 py-0.5 rounded font-medium text-zinc-300">
                          {p}
                        </span>
                      ))
                    )}
                    {stats.projects.length > 3 && (
                      <span className="text-[9px] bg-zinc-800/60 border border-[#1E1E22] px-1 py-0.5 rounded font-mono text-zinc-400 font-bold">
                        +{stats.projects.length - 3}
                      </span>
                    )}
                  </div>
                </div>

                {/* Métricas */}
                <div className="grid grid-cols-4 gap-2 pt-1">
                  <div className="bg-black/25 border border-[#1C1C1E] p-2 rounded-lg text-center">
                    <span className="block text-[8px] font-bold text-zinc-500 uppercase">Total</span>
                    <span className="text-sm font-bold text-white font-mono mt-0.5 block">{stats.total}</span>
                  </div>
                  <div className="bg-black/25 border border-[#1C1C1E] p-2 rounded-lg text-center">
                    <span className="block text-[8px] font-bold text-zinc-500 uppercase">Ativas</span>
                    <span className="text-sm font-bold text-amber-400 font-mono mt-0.5 block">{stats.active}</span>
                  </div>
                  <div className="bg-black/25 border border-[#1C1C1E] p-2 rounded-lg text-center">
                    <span className="block text-[8px] font-bold text-zinc-500 uppercase">Concl.</span>
                    <span className="text-sm font-bold text-emerald-400 font-mono mt-0.5 block">{stats.completed}</span>
                  </div>
                  <div className={`p-2 rounded-lg text-center border ${hasDelayed ? 'bg-red-500/5 border-red-500/20' : 'bg-black/25 border-[#1C1C1E]'}`}>
                    <span className="block text-[8px] font-bold text-zinc-500 uppercase">Atraso</span>
                    <span className={`text-sm font-bold font-mono mt-0.5 block ${hasDelayed ? 'text-red-400' : 'text-white'}`}>{stats.delayed}</span>
                  </div>
                </div>

                {/* Barra de Progresso */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[9px] font-bold uppercase text-zinc-500">
                    <span>Taxa de Entrega</span>
                    <span className="font-mono text-white">{completionRate}%</span>
                  </div>
                  <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        completionRate === 100 ? 'bg-emerald-500' : completionRate > 50 ? 'bg-blue-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${completionRate}%` }}
                    />
                  </div>
                </div>

                {/* Visualizar Tarefas */}
                <div className="flex justify-between items-center text-[9px] uppercase font-bold text-zinc-400 pt-2 border-t border-[#1C1C1E]">
                  <span>Visualizar tarefas</span>
                  <ExternalLink size={10} className="text-zinc-500 group-hover:text-white transition-colors" />
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* MODAL DE CADASTRO DE EXECUTOR */}
      {createModalOpen && (
        <>
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 animate-in fade-in" onClick={() => setCreateModalOpen(false)} />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-50 animate-in zoom-in-95 duration-200 pointer-events-none">
            <div className="bg-[#09090B] border border-[#1E1E22] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col justify-between pointer-events-auto">
              
              <div className="p-5 border-b border-[#1C1C1E] flex justify-between items-center bg-[#121214]/60">
                <h3 className="text-base font-bold text-white">Cadastrar Novo Executor</h3>
                <button onClick={() => setCreateModalOpen(false)} className="p-1 hover:bg-white/5 text-zinc-400 hover:text-white rounded-lg">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateResponsible} className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Nome Completo</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Carlos Santos"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="bg-[#121214] border border-[#1E1E22] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-700"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Empresa / Afiliação</label>
                    <input
                      type="text"
                      placeholder="Ex: LongView ou Portal Engenharia"
                      value={newCompany}
                      onChange={(e) => setNewCompany(e.target.value)}
                      className="bg-[#121214] border border-[#1E1E22] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Telefone de Contato</label>
                    <input
                      type="text"
                      placeholder="Ex: (48) 99999-9999"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      className="bg-[#121214] border border-[#1E1E22] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-700"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">E-mail Corporativo</label>
                    <input
                      type="email"
                      placeholder="Ex: executor@longview.com.br"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="bg-[#121214] border border-[#1E1E22] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-700"
                    />
                  </div>
                </div>

                {/* Upload de Imagem de Perfil com Ajustes */}
                <div className="border-t border-[#1C1C1E] pt-4.5 space-y-4">
                  <div className="flex items-start gap-4">
                    {/* Input de Arquivo */}
                    <div className="flex-1 space-y-2">
                      <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">Foto de Perfil ou Logo</label>
                      <label className="border border-dashed border-[#2B2B30] hover:border-zinc-500 rounded-lg p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-black/10 hover:bg-black/20 transition-all text-center">
                        <Upload size={18} className="text-zinc-400" />
                        <span className="text-[10px] font-semibold text-zinc-300">Escolher arquivo de imagem</span>
                        <span className="text-[8px] text-zinc-500">PNG, JPG ou JPEG</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleImageUpload} 
                          className="hidden" 
                        />
                      </label>
                    </div>

                    {/* Preview Circular Vivo */}
                    <div className="flex flex-col items-center gap-1.5 shrink-0">
                      <span className="text-[8px] font-bold text-zinc-500 uppercase">Preview</span>
                      {newPhoto ? (
                        <div className="w-20 h-20 rounded-full border border-white/10 overflow-hidden relative bg-black/30">
                          <img 
                            src={newPhoto} 
                            alt="Crop Preview" 
                            className="absolute w-full h-full object-cover"
                            style={{
                              transform: `scale(${zoom})`,
                              transformOrigin: 'center',
                              objectPosition: `${posX}% ${posY}%`
                            }}
                          />
                        </div>
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-zinc-900 border border-[#1E1E22] flex items-center justify-center text-zinc-600 text-xs font-bold">
                          Sem Foto
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sliders de Ajuste no Círculo */}
                  {newPhoto && (
                    <div className="bg-black/20 border border-[#1E1E22] p-4.5 rounded-xl space-y-3">
                      <div className="flex items-center gap-1.5 text-[9px] font-bold text-zinc-400 uppercase tracking-wider">
                        <Sliders size={12} />
                        <span>Ajustar Foto no Círculo</span>
                      </div>

                      {/* Zoom */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] font-mono text-zinc-500">
                          <span>Zoom</span>
                          <span>{zoom.toFixed(1)}x</span>
                        </div>
                        <input 
                          type="range"
                          min="1"
                          max="3"
                          step="0.1"
                          value={zoom}
                          onChange={(e) => setZoom(parseFloat(e.target.value))}
                          className="w-full accent-white h-1 bg-zinc-800 rounded-lg cursor-pointer"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {/* Posição X */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[9px] font-mono text-zinc-500">
                            <span>Posição X</span>
                            <span>{posX}%</span>
                          </div>
                          <input 
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={posX}
                            onChange={(e) => setPosX(parseInt(e.target.value))}
                            className="w-full accent-white h-1 bg-zinc-800 rounded-lg cursor-pointer"
                          />
                        </div>

                        {/* Posição Y */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[9px] font-mono text-zinc-500">
                            <span>Posição Y</span>
                            <span>{posY}%</span>
                          </div>
                          <input 
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={posY}
                            onChange={(e) => setPosY(parseInt(e.target.value))}
                            className="w-full accent-white h-1 bg-zinc-800 rounded-lg cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  )}
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
                    Salvar Cadastro
                  </button>
                </div>
              </form>

            </div>
          </div>
        </>
      )}

      {/* Drawer para abrir tarefas de dentro do modal do responsável */}
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
