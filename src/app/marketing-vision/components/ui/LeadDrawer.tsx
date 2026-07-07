'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Lead, LeadInteracao } from '../../types';
import { getOrigin, getStatusColor, getLeadTags, getLeadSource } from '../../utils/leads';
import { formatDate } from '../../utils/formatters';
import { useData } from '../../context/DataContext';
import logger from '@/lib/logger'
import { 
  Lightbulb, 
  Edit2, 
  Check, 
  X, 
  ShieldAlert, 
  Sparkles, 
  ExternalLink, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Star, 
  MessageSquare, 
  History, 
  Compass, 
  Building,
  ArrowRight
} from 'lucide-react';

interface StageChange {
  de: string | null;
  para: string;
  autor: string | null;
  changed_at: string;
  corretor: string | null;
  gestor: string | null;
  origem: string | null;
}

interface Props {
  lead: Lead | null;
  onClose: () => void;
}

function GridField({ icon: Icon, label, value }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value?: string | number | null }) {
  if (value == null || value === '') {
    return (
      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.01] border border-white/5 opacity-55">
        <Icon className="text-zinc-600 shrink-0 mt-0.5" size={16} />
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">{label}</span>
          <span className="text-xs text-zinc-600 font-mono">—</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
      <Icon className="text-orange-500 shrink-0 mt-0.5" size={16} />
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">{label}</span>
        <span className="text-sm text-zinc-200 font-medium truncate" title={String(value)}>{value}</span>
      </div>
    </div>
  );
}

export default function LeadDrawer({ lead, onClose }: Props) {
  const { allLeads, refresh } = useData();
  const [history, setHistory] = useState<StageChange[] | null>(null);
  const [fullLead, setFullLead] = useState<Lead | null>(null);
  const [loadingLead, setLoadingLead] = useState(false);

  // Abas do Modal
  const [activeTab, setActiveTab] = useState<'ficha' | 'interacoes'>('ficha');

  // Estados do modo de edição
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [editNome, setEditNome] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editTelefone, setEditTelefone] = useState('');
  const [editIdSituacao, setEditIdSituacao] = useState('');
  const [editIdCorretor, setEditIdCorretor] = useState('');
  const [editIdGestor, setEditIdGestor] = useState('');
  const [editIdImobiliaria, setEditIdImobiliaria] = useState('');

  // Busca os dados completos do lead (incluindo interações) assincronamente
  useEffect(() => {
    const leadId = lead?.idlead ?? lead?.id;
    if (!lead) {
      setFullLead(null);
      setLoadingLead(false);
      return;
    }
    if (!leadId) return;

    setFullLead(lead);
    setLoadingLead(true);
    let active = true;

    fetch(`/api/leads/${leadId}`)
      .then((r) => r.json())
      .then((d) => {
        if (active && d.ok && d.lead) {
          setFullLead(d.lead);
        }
      })
      .catch((err: unknown) => logger.error({ err }))
      .finally(() => {
        if (active) setLoadingLead(false);
      });

    return () => {
      active = false;
    };
  }, [lead]);

  // Busca o histórico de movimentação do lead
  useEffect(() => {
    const leadId = lead?.idlead ?? lead?.id;
    if (!lead || !leadId) return;

    setHistory(null);
    let active = true;

    fetch(`/api/leads/${leadId}/history`)
      .then((r) => r.json())
      .then((d) => { if (active) setHistory(d.history ?? []); })
      .catch(() => { if (active) { setHistory([]); logger.warn('[LeadDrawer] history falhou'); } });

    return () => {
      active = false;
    };
  }, [lead]);

  // Inicializa os campos do formulário ao abrir ou ativar o modo de edição
  const activeLead = fullLead || lead;
  
  useEffect(() => {
    if (activeLead && isEditing) {
      setEditNome(activeLead.nome || '');
      setEditEmail(activeLead.email || '');
      setEditTelefone(activeLead.telefone || activeLead.celular || '');
      setEditIdSituacao(String(activeLead.situacao?.id || ''));
      setEditIdCorretor(String(activeLead.corretor?.id || ''));
      setEditIdGestor(String(activeLead.gestor?.id || ''));
      setEditIdImobiliaria(String(activeLead.imobiliaria?.id || ''));
      setErrorMsg(null);
    }
  }, [activeLead, isEditing]);

  // Fecha no ESC
  useEffect(() => {
    if (!lead) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [lead, onClose]);

  // Extrai listas dinâmicas exclusivas a partir de todos os leads carregados
  const corretores = useMemo(() => {
    const map = new Map<number, string>();
    allLeads.forEach(l => {
      if (l.corretor?.id && l.corretor?.nome) {
        map.set(Number(l.corretor.id), l.corretor.nome);
      }
    });
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [allLeads]);

  const gestores = useMemo(() => {
    const map = new Map<number, string>();
    allLeads.forEach(l => {
      if (l.gestor?.id && l.gestor?.nome) {
        map.set(Number(l.gestor.id), l.gestor.nome);
      }
    });
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [allLeads]);

  const imobiliarias = useMemo(() => {
    const map = new Map<number, string>();
    allLeads.forEach(l => {
      if (l.imobiliaria?.id && l.imobiliaria?.nome) {
        map.set(Number(l.imobiliaria.id), l.imobiliaria.nome);
      }
    });
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [allLeads]);

  const etapas = useMemo(() => {
    const map = new Map<number, string>();
    allLeads.forEach(l => {
      if (l.situacao?.id && l.situacao?.nome) {
        map.set(Number(l.situacao.id), l.situacao.nome);
      }
    });
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [allLeads]);

  if (!activeLead) return null;

  const id = activeLead.idlead ?? activeLead.id;
  const rawCrm = activeLead.raw as { _crm?: { id?: string } } | undefined;
  const isMetaOrphan = String(id).startsWith('meta_') && (!rawCrm?._crm?.id && !activeLead.idlead);
  
  // Link exato para o CV CRM comercial do cliente
  const crmUrl = id && !String(id).startsWith('meta_')
    ? `https://longviewempreendimentos.cvcrm.com.br/gestor/comercial/leads/${id}/administrar`
    : undefined;
  
  const sc = getStatusColor(activeLead);
  const tags = getLeadTags(activeLead);
  const interacoes = (activeLead.interacao ?? []).filter(it => it.descricao && it.descricao.trim().length > 0);
  const source = getLeadSource(activeLead);

  // Submissão das alterações
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editNome.trim()) {
      setErrorMsg('O nome é obrigatório.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    const payload = {
      nome: editNome.trim(),
      email: editEmail.trim() || null,
      telefone: editTelefone.trim() || null,
      idsituacao: editIdSituacao || undefined,
      nomeSituacao: etapas.find(et => String(et.id) === editIdSituacao)?.nome || undefined,
      idcorretor: editIdCorretor || undefined,
      nomeCorretor: corretores.find(c => String(c.id) === editIdCorretor)?.nome || undefined,
      idusuario: editIdGestor || undefined,
      nomeGestor: gestores.find(g => String(g.id) === editIdGestor)?.nome || undefined,
      idimobiliaria: editIdImobiliaria || undefined,
      nomeImobiliaria: imobiliarias.find(i => String(i.id) === editIdImobiliaria)?.nome || undefined,
    };

    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar alterações no CRM.');

      if (data.lead) {
        setFullLead(data.lead);
      }

      setIsEditing(false);
      refresh(true);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <div
        className="w-full max-w-3xl h-[85vh] overflow-hidden rounded-2xl border border-white/10 flex flex-col relative bg-zinc-950"
        style={{ backgroundImage: 'radial-gradient(at center top, rgba(249,115,22,0.07) 0%, transparent 65%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Fixo */}
        <div className="flex items-start justify-between gap-4 p-5 border-b border-white/5 bg-zinc-950/80 backdrop-blur-md z-10 shrink-0">
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold truncate text-white tracking-tight">
                {activeLead.nome || 'Lead'}
              </h2>
              {crmUrl && (
                <a
                  href={crmUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-orange-500 hover:text-orange-400 p-1 rounded-lg hover:bg-orange-500/10 flex items-center gap-1 transition-all text-xs font-semibold"
                  title="Abrir Ficha no CV CRM"
                >
                  Abrir no CV CRM <ExternalLink size={12} />
                </a>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {activeLead.situacao?.nome && (
                <span className="text-[10px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider" style={{ backgroundColor: sc.bg, color: sc.text }}>
                  {activeLead.situacao.nome}
                </span>
              )}
              {isMetaOrphan && (
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 uppercase tracking-wider flex items-center gap-1">
                  <ShieldAlert size={10} /> Órfão Meta (Não Integrado)
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {!isMetaOrphan && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="shrink-0 h-9 px-4 rounded-full border border-white/10 text-zinc-300 hover:text-white hover:bg-white/5 flex items-center justify-center gap-1.5 transition-all text-xs font-semibold"
              >
                <Edit2 size={13} /> Editar Ficha
              </button>
            )}
            <button 
              onClick={onClose} 
              className="shrink-0 w-9 h-9 rounded-full border border-white/10 text-zinc-400 hover:text-white hover:bg-white/5 flex items-center justify-center transition-all text-sm font-semibold"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Abas */}
        {!isEditing && (
          <div className="flex border-b border-white/5 px-5 bg-zinc-950 shrink-0">
            <button
              onClick={() => setActiveTab('ficha')}
              className={`py-3 text-xs font-bold uppercase tracking-wider border-b-2 px-3 transition-all flex items-center gap-2 ${
                activeTab === 'ficha'
                  ? 'border-orange-500 text-orange-400 bg-orange-500/5'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              <User size={13} /> Ficha Cadastral
            </button>
            <button
              onClick={() => setActiveTab('interacoes')}
              className={`py-3 text-xs font-bold uppercase tracking-wider border-b-2 px-3 transition-all flex items-center gap-2 relative ${
                activeTab === 'interacoes'
                  ? 'border-orange-500 text-orange-400 bg-orange-500/5'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              <MessageSquare size={13} /> Mensagens do Corretor ({interacoes.length})
              {interacoes.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-orange-500 absolute top-2 right-1 animate-pulse" />
              )}
            </button>
          </div>
        )}

        {/* Conteúdo Central Scrollável */}
        <div className="flex-1 overflow-y-auto p-5 min-h-0 bg-zinc-950/20">
          {isEditing ? (
            /* MODO EDIÇÃO */
            <form onSubmit={handleSave} className="flex flex-col gap-4 max-w-xl mx-auto py-2">
              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2.5">
                  <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] uppercase tracking-wide text-zinc-500 font-bold">Nome Completo</label>
                  <input
                    type="text"
                    required
                    value={editNome}
                    onChange={e => setEditNome(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] uppercase tracking-wide text-zinc-500 font-bold">E-mail</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={e => setEditEmail(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] uppercase tracking-wide text-zinc-500 font-bold">Telefone / Celular</label>
                  <input
                    type="text"
                    value={editTelefone}
                    onChange={e => setEditTelefone(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] uppercase tracking-wide text-zinc-500 font-bold">Situação / Etapa</label>
                  <select
                    value={editIdSituacao}
                    onChange={e => setEditIdSituacao(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-zinc-900 border border-white/10 text-sm text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                  >
                    <option value="">Selecione a etapa...</option>
                    {etapas.map(et => (
                      <option key={et.id} value={et.id}>{et.nome}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] uppercase tracking-wide text-zinc-500 font-bold">Corretor Responsável</label>
                  <select
                    value={editIdCorretor}
                    onChange={e => setEditIdCorretor(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-zinc-900 border border-white/10 text-sm text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                  >
                    <option value="">Selecione o corretor...</option>
                    {corretores.map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] uppercase tracking-wide text-zinc-500 font-bold">Gestor Responsável</label>
                  <select
                    value={editIdGestor}
                    onChange={e => setEditIdGestor(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-zinc-900 border border-white/10 text-sm text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                  >
                    <option value="">Selecione o gestor...</option>
                    {gestores.map(g => (
                      <option key={g.id} value={g.id}>{g.nome}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label className="text-[11px] uppercase tracking-wide text-zinc-500 font-bold">Imobiliária</label>
                  <select
                    value={editIdImobiliaria}
                    onChange={e => setEditIdImobiliaria(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-zinc-900 border border-white/10 text-sm text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                  >
                    <option value="">Selecione a imobiliária...</option>
                    {imobiliarias.map(i => (
                      <option key={i.id} value={i.id}>{i.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-5 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={saving}
                  className="flex-1 h-10 rounded-full border border-white/10 text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-white/5 disabled:opacity-50 transition-all text-zinc-400"
                >
                  <X size={14} /> Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 h-10 rounded-full bg-orange-500 text-white text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-orange-600 disabled:opacity-50 transition-all"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check size={14} /> Salvar Alterações
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : activeTab === 'ficha' ? (
            /* ABA FICHA CADASTRAL */
            <div className="flex flex-col gap-5">
              {isMetaOrphan && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2.5 max-w-2xl mx-auto w-full">
                  <Lightbulb className="shrink-0 mt-0.5 text-amber-400" size={16} />
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-sm">Lead Órfão do Meta Ads</span>
                    <span>Este contato foi captado no Meta, mas não está cadastrado no CRM. Você pode ver se ele está no CRM clicando na aba **Validação Meta** no painel de Leads e forçar a sincronização retroativa.</span>
                  </div>
                </div>
              )}

              {/* Informações Cadastrais em Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Coluna 1: Dados Pessoais */}
                <div className="flex flex-col gap-3">
                  <h3 className="text-xs uppercase font-bold tracking-wider text-zinc-500 mb-1 flex items-center gap-1.5">
                    <User size={12} /> Informações de Contato
                  </h3>
                  <GridField icon={Mail} label="E-mail" value={activeLead.email} />
                  <GridField icon={Phone} label="Telefone / Celular" value={activeLead.telefone || activeLead.celular} />
                  <GridField icon={MapPin} label="Cidade" value={activeLead.cidade} />
                  <GridField icon={Calendar} label="Data de Cadastro" value={formatDate(activeLead.data_cad || activeLead.data_cadastro || activeLead.data_cadastramento)} />
                </div>

                {/* Coluna 2: Atendimento Comercial */}
                <div className="flex flex-col gap-3">
                  <h3 className="text-xs uppercase font-bold tracking-wider text-zinc-500 mb-1 flex items-center gap-1.5">
                    <Star size={12} /> Comercial & CRM
                  </h3>
                  <GridField icon={Compass} label="Origem da Captação" value={getOrigin(activeLead)} />
                  <GridField icon={Building} label="Empreendimento de Interesse" value={activeLead.empreendimento?.map((e) => e.nome).join(', ')} />
                  <GridField icon={User} label="Corretor Responsável" value={activeLead.corretor?.nome} />
                  <GridField icon={Building} label="Imobiliária" value={activeLead.imobiliaria?.nome} />
                </div>
              </div>

              {/* Tags do Lead */}
              {tags.length > 0 && (
                <div className="flex flex-col gap-2 mt-2">
                  <h4 className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Tags do Lead</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((t) => (
                      <span key={t} className="px-2.5 py-0.5 rounded-full text-xs bg-white/5 border border-white/10 text-zinc-300 font-medium">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Origem e Canal Detalhado */}
              <div className="p-4 rounded-xl border border-white/5 bg-white/[0.01] flex flex-col gap-2 mt-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider"
                    style={source.type === 'manual'
                      ? { backgroundColor: 'rgba(245,158,11,0.15)', color: '#fbbf24' }
                      : { backgroundColor: 'rgba(14,165,233,0.15)', color: '#38bdf8' }}
                  >
                    {source.type === 'manual' ? 'Cadastro Manual' : 'Integração Automática'}
                  </span>
                  <span className="text-xs text-zinc-400 font-medium">{source.channel}</span>
                </div>
                {source.type === 'manual' && (
                  <span className="text-xs text-zinc-400">
                    Cadastrado originalmente no CRM por: <strong className="text-zinc-200">{source.by ?? 'Não identificado'}</strong>
                  </span>
                )}
                {activeLead.midia_principal && (
                  <div className="text-xs text-zinc-500 mt-1">
                    Parâmetro Mídia: <span className="font-mono text-zinc-400">{String(activeLead.midia_principal)}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ABA INTERAÇÕES E MENSAGENS DO CORRETOR */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full items-stretch">
              {/* Coluna A: Histórico de Conversas e Comentários do Corretor */}
              <div className="flex flex-col gap-3.5 min-h-[300px]">
                <h3 className="text-xs uppercase font-bold tracking-wider text-zinc-400 flex items-center gap-2">
                  <MessageSquare size={13} className="text-orange-500" /> Descrição das Interações ({interacoes.length})
                </h3>
                
                {loadingLead ? (
                  <div className="flex items-center justify-center p-8 text-zinc-500 text-xs">
                    Carregando mensagens do corretor...
                  </div>
                ) : interacoes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center border border-white/5 rounded-xl bg-white/[0.01] p-8 text-center gap-1.5 flex-1">
                    <MessageSquare size={24} className="text-zinc-700" />
                    <span className="text-xs text-zinc-500">Nenhum comentário ou interação registrada pelo corretor.</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 overflow-y-auto max-h-[48vh] pr-1 scrollbar-thin">
                    {interacoes.map((it: LeadInteracao, i) => (
                      <div key={i} className="flex flex-col gap-2 p-3.5 rounded-xl bg-zinc-900 border border-white/5 hover:border-white/10 transition-colors">
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded">
                            {it.tipo || 'Mensagem'}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {formatDate(it.data_cad)}
                          </span>
                        </div>
                        {it.descricao && (
                          <p className="text-zinc-300 text-xs leading-relaxed whitespace-pre-wrap font-sans">
                            {it.descricao}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Coluna B: Linha do Tempo de Etapas CRM */}
              <div className="flex flex-col gap-3.5 border-t md:border-t-0 md:border-l border-white/5 pt-5 md:pt-0 md:pl-6 min-h-[300px]">
                <h3 className="text-xs uppercase font-bold tracking-wider text-zinc-400 flex items-center gap-2">
                  <History size={13} className="text-orange-500" /> Linha do Tempo (Movimentação)
                </h3>

                {history === null ? (
                  <div className="flex items-center justify-center p-8 text-zinc-500 text-xs">
                    Carregando histórico do CRM...
                  </div>
                ) : history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center border border-white/5 rounded-xl bg-white/[0.01] p-8 text-center gap-1.5 flex-1">
                    <History size={24} className="text-zinc-700" />
                    <span className="text-xs text-zinc-500">Nenhuma movimentação de etapa registrada ainda.</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 overflow-y-auto max-h-[48vh] pr-1 scrollbar-thin">
                    <ol className="relative border-l border-white/10 ml-2.5 flex flex-col gap-4.5 py-1">
                      {history.map((h, i) => (
                        <li key={i} className="mb-1 ml-4 text-xs">
                          {/* Bolinha indicadora */}
                          <div className="absolute w-2.5 h-2.5 bg-orange-500 rounded-full -left-[5.5px] border border-zinc-950 shadow-md" />
                          
                          <div className="flex flex-col gap-1">
                            <span className="text-zinc-200 font-medium flex items-center gap-1 flex-wrap">
                              {h.de && <span className="opacity-60">{h.de}</span>}
                              {h.de && <ArrowRight size={10} className="text-zinc-500" />}
                              <strong className="text-orange-400">{h.para}</strong>
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {new Date(h.changed_at).toLocaleString('pt-BR')}
                            </span>
                            {(h.corretor || h.gestor) && (
                              <span className="text-[11px] text-zinc-400 font-medium">
                                Corretor: {h.corretor ?? '—'}{h.gestor ? ` (Gestor: ${h.gestor})` : ''}
                              </span>
                            )}
                            {h.autor && (
                              <span className="text-[11px] text-zinc-500">Autor: {h.autor}</span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé Fixo */}
        {crmUrl && !isEditing && (
          <div className="p-4 border-t border-white/5 bg-zinc-950 shrink-0 flex justify-end">
            <a
              href={crmUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-10 px-5 rounded-full bg-white hover:bg-white/90 text-zinc-950 text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg hover:scale-[1.01] active:scale-[0.99]"
            >
              Abrir Ficha de Vendas no CV CRM ↗
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
