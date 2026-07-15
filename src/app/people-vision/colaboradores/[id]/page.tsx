'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowLeft, Save, Loader2, Check, User, Phone, Building2, MapPin,
  Heart, Lock, AlertCircle, FileText, Upload, Trash2, Download,
  Camera, ShieldCheck, ExternalLink,
} from 'lucide-react';
import { useUser } from '@/context/UserContext';
import PasswordInput from '@/components/app/PasswordInput';
import logger from '@/lib/logger'

// ── CPF validation ────────────────────────────────────────────────────────────
function validateCPF(raw: string): boolean {
  const d = raw.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const calc = (len: number) =>
    d.slice(0, len).split('').reduce((s, n, i) => s + +n * (len + 1 - i), 0);
  const r1 = (calc(9)  * 10) % 11; const v1 = r1 < 2 ? 0 : 11 - r1;
  const r2 = (calc(10) * 10) % 11; const v2 = r2 < 2 ? 0 : 11 - r2;
  return +d[9] === v1 && +d[10] === v2;
}

function formatCPF(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4')
          .replace(/(\d{3})(\d{3})(\d{1,3})$/, '$1.$2.$3')
          .replace(/(\d{3})(\d{1,3})$/, '$1.$2');
}

// ── Mapeamento de cargo → registro profissional ───────────────────────────────
const PROF_ID_BY_ROLE: Record<string, { type: string; label: string; placeholder: string }> = {
  Corretor:     { type: 'CRECI', label: 'CRECI',        placeholder: 'Ex: 75875-F ou 75875' },
  Desenvolvedor:{ type: 'outro', label: 'Registro',     placeholder: 'Certificações, etc.' },
  Diretoria:    { type: 'outro', label: 'Registro',     placeholder: 'Opcional' },
};
// Extensível — fora do mapa = sem seção obrigatória, mas campo livre disponível

const STATES_BR = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

// Cargos e departamentos já em uso na base — lista viva, cresce via "Outro" quando falta opção
const DEPARTMENTS = [
  'Comercial', 'Direção', 'Engenharia', 'Engenharia HUB', 'Engenharia Nautic',
  'Financeiro', 'Fornecedores', 'Marketing', 'Relacionamento Cliente', 'Suprimentos',
];

const POSITIONS = [
  'Almoxarife', 'Ambiental', 'Analista Administrativo', 'Analista Financeiro', 'Ancoragem',
  'Análise Acústica', 'Análise térmica e lumínica', 'Arquitetura', 'Arquitetura - Legal e Executivo',
  'Assistente Administrativo', 'Assistente Comercial', 'Assistente Engenharia civil',
  'Assistente Financeiro', 'Assistente Relac. Cliente', 'Assistente Suprimentos',
  'Assistente de Projetos', 'Automação', 'Auxiliar Engenharia Civil II', 'Auxiliar de Engenharia Civil',
  'CFTV (segurança)', 'Consultoria de Paisagismo', 'Consultoria de marketing',
  'Coordenador Assist.Técnica', 'Coordenadora de Incorporação', 'Coordenadora de Projetos',
  'Coordenadora de Projetos e Licenças', 'Coordenadora de Suprimentos', 'Coordenação e Compatibilização',
  'Coordendora Relac. Cliente', 'Diretor', 'Drenagem', 'ETE', 'Estagiário Marketing',
  'Estagiário de Engenharia Civil', 'Estrutura', 'Estrutura de concreto', 'Exaustão',
  'Gerente', 'Gerente Comercial', 'Gerente Financeiro', 'Gerente Geral de Obras',
  'Gerente de Incorporação', 'Gerente de Obras', 'Gerente de Vendas', 'Imagens comerciais',
  'Impermeabilização', 'Interiores', 'Interiores Comercial', 'Interiores áreas comerciais',
  'Interiores áreas comuns', 'Luminotécnico', 'Líder de Projetos', 'Marketing', 'Orçamento',
  'PPCI / Gás', 'Paisagismo', 'Piscina', 'Piscinas', 'Planejamento', 'Porteiro',
  'Preventivo contra incêndio', 'Projeto de sistema de exaustão', 'Recepcionista e Relac. Cliente',
  'Relatório de desempenho térmico', 'Sondagem', 'Supervisor Assist.Técnica', 'Supervisor de Obra',
  'Supervisor de Qualidade e Engenharia', 'Terraplanagem', 'Topografia', 'Técnica Segurança do Trabalho',
];

const CUSTOM_OPT = '__outro__';

const DOC_CATEGORIES = [
  { value: 'contrato_clt', label: 'Contrato CLT' },
  { value: 'contrato_pj',  label: 'Contrato PJ / Prestação de Serviços' },
  { value: 'identificacao',label: 'Identificação (RG/CPF)' },
  { value: 'habilitacao',  label: 'Habilitação Profissional (CRECI/CREA)' },
  { value: 'outro',        label: 'Outro' },
];

interface UserDocument {
  id: string;
  name: string;
  category: string;
  url?: string;
  contentType?: string;
  sizeBytes?: number;
  expiresAt?: string;
  uploadedBy: string;
  uploadedAt: string;
}

interface UserPerms {
  viewMarketingDashboard: boolean; viewMarketingLeads: boolean;
  viewMarketingOportunidades: boolean; viewMarketingEstoque: boolean;
  viewMarketingAds: boolean; viewMarketingVendas: boolean;
  viewProjectVision: boolean; manageProjects: boolean;
  manageCommentsDocs: boolean; deleteTasks: boolean;
  viewPeopleVision: boolean; viewQualityVision: boolean; viewSalesVision: boolean;
  isAdmin: boolean;
}

const DEFAULT_PERMS: UserPerms = {
  viewMarketingDashboard: false, viewMarketingLeads: false,
  viewMarketingOportunidades: false, viewMarketingEstoque: false,
  viewMarketingAds: false, viewMarketingVendas: false,
  viewProjectVision: false, manageProjects: false,
  manageCommentsDocs: false, deleteTasks: false,
  viewPeopleVision: false, viewQualityVision: false, viewSalesVision: false,
  isAdmin: false,
};

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  permissions?: Partial<UserPerms>;
  profile?: {
    category?: 'colaborador' | 'fornecedor';
    phone?: string; whatsapp?: string; position?: string; department?: string;
    company?: string; managerId?: string; activatedAt?: string; birthDate?: string; linkedIn?: string;
    avatarUrl?: string; status?: string; notes?: string;
    cpf?: string; rg?: string; rgOrgao?: string; rgEstado?: string;
    professionalId?: string; professionalIdType?: string;
    professionalIdState?: string; professionalIdExpiry?: string;
    address?: { street?: string; number?: string; complement?: string; city?: string; state?: string; zip?: string };
    emergencyContact?: { name?: string; phone?: string; relationship?: string };
  };
}

interface PageMeta {
  canEdit: boolean;
  canManageDocuments: boolean;
  canManagePermissions?: boolean;
  canChangeRole?: boolean;
  canSetManagerId?: boolean;
  canViewSensitive: boolean;
  readOnly?: boolean;
}

const ROLES = ['Desenvolvedor', 'Diretoria', 'Gestor', 'Operador', 'Parceiro', 'Corretor', 'Visualizador'];
const STATUS_OPTS = [
  { value: 'ativo',    label: 'Ativo' },
  { value: 'ferias',   label: 'Férias' },
  { value: 'afastado', label: 'Afastado' },
  { value: 'inativo',  label: 'Inativo' },
];

// ── Components ────────────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children, accent }: {
  title: string; icon: React.ElementType; children: React.ReactNode; accent?: string;
}) {
  return (
    <div className="rounded-xl border border-[#1E1E22] bg-[#121214]/60 overflow-hidden">
      <div className={`flex items-center gap-2 px-5 py-4 border-b border-[#1C1C1E]`}>
        <Icon size={15} className={accent ?? 'text-emerald-400'} />
        <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] text-zinc-500 uppercase tracking-wider mb-1.5 font-semibold">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = (readOnly?: boolean) =>
  `w-full h-10 px-3 rounded-xl text-sm placeholder-zinc-600 focus:outline-none transition-colors ${
    readOnly
      ? 'bg-[#121214]/60 border border-[#1E1E22] text-zinc-500 cursor-default'
      : 'bg-[#121214]/60 border border-[#1E1E22] text-zinc-100 focus:border-emerald-500/50'
  }`;

function Input({ value, onChange, placeholder, type = 'text', readOnly, error }: {
  value: string; onChange?: (v: string) => void; placeholder?: string;
  type?: string; readOnly?: boolean; error?: string;
}) {
  if (type === 'password') {
    return (
      <PasswordInput value={value} onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder} autoComplete="new-password"
        inputClassName={`${inputCls(readOnly)} pr-10`} />
    );
  }
  return (
    <div>
      <input type={type} value={value} onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder} readOnly={readOnly} className={`${inputCls(readOnly)} ${error ? 'border-red-500/50' : ''}`} />
      {error && <p className="text-[11px] text-red-400 mt-1">{error}</p>}
    </div>
  );
}

function Select({ value, onChange, options, disabled }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; disabled?: boolean;
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
      className="w-full h-10 px-3 rounded-xl bg-[#121214]/60 border border-[#1E1E22] text-sm text-zinc-100 focus:outline-none focus:border-emerald-500/50 disabled:opacity-50">
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function fmtSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDate(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ColaboradorPage() {
  const { id }          = useParams<{ id: string }>();
  const router          = useRouter();
  const { currentUser } = useUser();
  const isAdmin         = currentUser?.role === 'Desenvolvedor' || currentUser?.permissions?.isAdmin === true;
  const isSelf          = currentUser?.id === id || id === 'me';

  const [user, setUser]       = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState('');
  const [pageMeta, setPageMeta] = useState<PageMeta>({ canEdit: false, canManageDocuments: false, canViewSensitive: false });

  // Form state — dados básicos
  const [name, setName]             = useState('');
  const [role, setRole]             = useState('');
  const [status, setStatus]         = useState('ativo');
  const [phone, setPhone]           = useState('');
  const [whatsapp, setWhatsapp]     = useState('');
  const [position, setPosition]     = useState('');
  const [positionCustom, setPositionCustom] = useState(false);
  const [department, setDepartment] = useState('');
  const [departmentCustom, setDepartmentCustom] = useState(false);
  const [company, setCompany]       = useState('');
  const [managerId, setManagerId]   = useState('');
  const [managers, setManagers]     = useState<{ id: string; name: string; role: string }[]>([]);
  const [activatedAt, setActivatedAt] = useState('');
  const [birthDate, setBirthDate]   = useState('');
  const [linkedIn, setLinkedIn]     = useState('');
  const [avatarUrl, setAvatarUrl]   = useState('');
  const [notes, setNotes]           = useState('');
  // Documentos pessoais
  const [cpf, setCpf]               = useState('');
  const [cpfError, setCpfError]     = useState('');
  const [rg, setRg]                 = useState('');
  const [rgOrgao, setRgOrgao]       = useState('');
  const [rgEstado, setRgEstado]     = useState('');
  // Registro profissional
  const [profId, setProfId]           = useState('');
  const [profIdType, setProfIdType]   = useState('');
  const [profIdState, setProfIdState] = useState('');
  const [profIdExpiry, setProfIdExpiry] = useState('');
  // Endereço
  const [street, setStreet]         = useState('');
  const [addrNumber, setAddrNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [city, setCity]             = useState('');
  const [addrState, setAddrState]   = useState('');
  const [zip, setZip]               = useState('');
  // Emergência
  const [ecName, setEcName]         = useState('');
  const [ecPhone, setEcPhone]       = useState('');
  const [ecRel, setEcRel]           = useState('');
  // Senha
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd]         = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');

  // Avatar upload
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Documentos
  const [docs, setDocs]           = useState<UserDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const docInputRef               = useRef<HTMLInputElement>(null);
  const [docUploading, setDocUploading] = useState(false);
  const [docName, setDocName]     = useState('');
  const [docCategory, setDocCategory] = useState('contrato_clt');
  const [docExpiry, setDocExpiry] = useState('');
  const [showDocForm, setShowDocForm] = useState(false);

  const canEdit = pageMeta.canEdit;
  const canManageDocs = pageMeta.canManageDocuments;

  // Permissões (apenas admin pode ver/alterar permissões de outros)
  const [perms, setPerms] = useState<UserPerms>({ ...DEFAULT_PERMS });
  const [permsSaving, setPermsSaving] = useState(false);
  const [permsSaved, setPermsSaved]   = useState(false);

  const handleSavePermissions = async () => {
    setPermsSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: perms }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro');
      setPermsSaved(true);
      setTimeout(() => setPermsSaved(false), 3000);
    } catch (e: unknown) {
      logger.error({ err: e }, '[colaborador] salvar permissões falhou');
      setError(e instanceof Error ? e.message : 'Erro ao salvar permissões');
    } finally { setPermsSaving(false); }
  };

  // ── Load user ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const ep = isSelf ? '/api/user/me' : `/api/admin/users/${id}`;
    fetch(ep).then(r => r.json()).then(d => {
      const u: UserData = d.user ?? d;
      setPageMeta(d.meta ?? { canEdit: isSelf || isAdmin, canManageDocuments: false, canViewSensitive: isSelf || isAdmin });
      setUser(u);
      setPerms({ ...DEFAULT_PERMS, ...(u.permissions ?? {}) });
      setName(u.name ?? '');
      setRole(u.role ?? '');
      setStatus(u.profile?.status ?? 'ativo');
      setPhone(u.profile?.phone ?? '');
      setWhatsapp(u.profile?.whatsapp ?? '');
      const loadedPosition = u.profile?.position ?? '';
      setPosition(loadedPosition);
      setPositionCustom(loadedPosition !== '' && !POSITIONS.includes(loadedPosition));
      const loadedDepartment = u.profile?.department ?? '';
      setDepartment(loadedDepartment);
      setDepartmentCustom(loadedDepartment !== '' && !DEPARTMENTS.includes(loadedDepartment));
      setCompany(u.profile?.company ?? '');
      setManagerId(u.profile?.managerId ?? '');
      setActivatedAt(u.profile?.activatedAt?.slice(0, 10) ?? '');
      setBirthDate(u.profile?.birthDate?.slice(0, 10) ?? '');
      setLinkedIn(u.profile?.linkedIn ?? '');
      setAvatarUrl(u.profile?.avatarUrl ?? '');
      setNotes(u.profile?.notes ?? '');
      setCpf(u.profile?.cpf ?? '');
      setRg(u.profile?.rg ?? '');
      setRgOrgao(u.profile?.rgOrgao ?? '');
      setRgEstado(u.profile?.rgEstado ?? '');
      setProfId(u.profile?.professionalId ?? '');
      setProfIdType(u.profile?.professionalIdType ?? (PROF_ID_BY_ROLE[u.role]?.type ?? 'outro'));
      setProfIdState(u.profile?.professionalIdState ?? '');
      setProfIdExpiry(u.profile?.professionalIdExpiry?.slice(0, 10) ?? '');
      setStreet(u.profile?.address?.street ?? '');
      setAddrNumber(u.profile?.address?.number ?? '');
      setComplement(u.profile?.address?.complement ?? '');
      setCity(u.profile?.address?.city ?? '');
      setAddrState(u.profile?.address?.state ?? '');
      setZip(u.profile?.address?.zip ?? '');
      setEcName(u.profile?.emergencyContact?.name ?? '');
      setEcPhone(u.profile?.emergencyContact?.phone ?? '');
      setEcRel(u.profile?.emergencyContact?.relationship ?? '');
    }).catch((err) => { logger.warn('[colaborador] fetch falhou', err); setError('Colaborador não encontrado'); }).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ── Load documents ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id || id === 'me' || !canManageDocs) return;
    const timer = window.setTimeout(() => setDocsLoading(true), 0);
    fetch(`/api/admin/users/${id}/documents`)
      .then(r => r.json()).then(d => setDocs(d.docs ?? []))
      .catch(() => logger.warn('[colaborador] documentos falhou')).finally(() => setDocsLoading(false));
    return () => window.clearTimeout(timer);
  }, [canManageDocs, id]);

  // ── Load candidatos a gestor responsável (lista já respeita visibilidade do viewer) ──
  useEffect(() => {
    fetch('/api/admin/users').then(r => r.json()).then(d => {
      const list = (d.users ?? []) as { id: string; name: string; role: string }[];
      setManagers(list.filter(u => u.id !== id && (u.role === 'Diretoria' || u.role === 'Gestor')));
    }).catch(() => logger.warn('[colaborador] lista de gestores falhou'));
  }, [id]);

  // ── Save profile ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    // CPF validation
    if (cpf && !validateCPF(cpf)) {
      setCpfError('CPF inválido — verifique os dígitos');
      setError('Corrija os erros antes de salvar');
      return;
    }
    setSaving(true); setError('');
    try {
      const body: Record<string, unknown> = {
        name,
        profile: {
          phone, whatsapp, position, department, company,
          managerId: pageMeta.canSetManagerId ? (managerId || undefined) : undefined,
          activatedAt: activatedAt || undefined,
          birthDate:   birthDate   || undefined,
          linkedIn, avatarUrl, status,
          notes: isAdmin ? notes : undefined,
          cpf: cpf || undefined,
          rg:  rg  || undefined,
          rgOrgao:  rgOrgao  || undefined,
          rgEstado: rgEstado || undefined,
          professionalId:       profId      || undefined,
          professionalIdType:   profIdType  || undefined,
          professionalIdState:  profIdState || undefined,
          professionalIdExpiry: profIdExpiry || undefined,
          address: { street, number: addrNumber, complement, city, state: addrState, zip, country: 'Brasil' },
          emergencyContact: { name: ecName, phone: ecPhone, relationship: ecRel },
        },
      };
      if (isSelf && currentPwd && newPwd) {
        if (newPwd !== confirmPwd) { setError('Senhas não conferem'); return; }
        if (newPwd.length < 8)    { setError('Nova senha: mínimo 8 caracteres'); return; }
        body.currentPassword = currentPwd;
        body.newPassword     = newPwd;
      }
      if (pageMeta.canChangeRole && !isSelf) body.role = role;

      const ep  = isSelf ? '/api/user/me' : `/api/admin/users/${id}`;
      const res = await fetch(ep, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro ao salvar');
      setSaved(true); setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      logger.error({ err: e }, '[colaborador] salvar perfil falhou');
      setError(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally { setSaving(false); }
  };

  // ── Avatar upload ──────────────────────────────────────────────────────────
  const handleAvatarUpload = async (file: File) => {
    setAvatarUploading(true);
    const form = new FormData(); form.append('file', file);
    try {
      const res = await fetch(`/api/admin/users/${id}/avatar`, { method: 'POST', body: form });
      const d   = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Erro');
      setAvatarUrl(d.avatarUrl);
    } catch (e: unknown) {
      logger.error({ err: e }, '[colaborador] upload avatar falhou');
      setError(e instanceof Error ? e.message : 'Erro no upload da foto');
    } finally { setAvatarUploading(false); }
  };

  // ── Document upload ────────────────────────────────────────────────────────
  const handleDocUpload = async (file: File) => {
    if (!docName.trim()) { setError('Digite um nome para o documento antes de enviar'); return; }
    setDocUploading(true);
    const form = new FormData();
    form.append('file', file);
    form.append('name', docName.trim());
    form.append('category', docCategory);
    if (docExpiry) form.append('expiresAt', docExpiry);
    try {
      const res = await fetch(`/api/admin/users/${id}/documents`, { method: 'POST', body: form });
      const d   = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Erro');
      setDocs(prev => [d.doc, ...prev]);
      setDocName(''); setDocExpiry(''); setShowDocForm(false);
    } catch (e: unknown) {
      logger.error({ err: e }, '[colaborador] upload documento falhou');
      setError(e instanceof Error ? e.message : 'Erro no upload');
    } finally { setDocUploading(false); }
  };

  const handleDocDelete = async (docId: string) => {
    if (!confirm('Remover este documento permanentemente?')) return;
    const res = await fetch(`/api/admin/users/${id}/documents?docId=${docId}`, { method: 'DELETE' });
    if (res.ok) setDocs(prev => prev.filter(d => d.id !== docId));
    else setError('Erro ao remover documento');
  };

  if (loading) return (
    <div className="flex items-center justify-center" style={{ minHeight: '60dvh' }}>
      <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!user) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <AlertCircle size={32} className="text-zinc-600" />
      <p className="text-zinc-500">Colaborador não encontrado</p>
      <button onClick={() => router.back()} className="text-sm text-emerald-400">← Voltar</button>
    </div>
  );

  const profConfig = PROF_ID_BY_ROLE[role];

  return (
    <div className="w-full space-y-6 p-4 md:p-6 lg:px-6 lg:py-4">

      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[#1C1C1E] pb-4">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-white/[0.06] text-zinc-400 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <p className="flex-1 truncate text-sm text-zinc-500">{user.email}</p>
        {canEdit && (
          <button onClick={handleSave} disabled={saving}
            className={`flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold transition-colors ${
              saved ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-500 hover:bg-emerald-400 text-white'
            }`}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Save size={14} />}
            {saved ? 'Salvo' : 'Salvar'}
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          <AlertCircle size={14} className="shrink-0" />{error}
        </div>
      )}

      {/* ── Dados Básicos ── */}
      <Section title="Dados Básicos" icon={User}>
        {/* Avatar */}
        <div className="flex items-center gap-4 mb-2">
          <div className="relative shrink-0">
            {avatarUrl ? (
              <Image src={avatarUrl} alt={user.name} width={64} height={64} className="rounded-full object-cover border border-[#1E1E22]" unoptimized />
            ) : (
              <div className="w-16 h-16 rounded-full bg-emerald-800/30 border border-emerald-700/20 flex items-center justify-center text-xl font-bold text-emerald-300">
                {(user.name || '').split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() || '?'}
              </div>
            )}
            {canEdit && (
              <button onClick={() => avatarInputRef.current?.click()} disabled={avatarUploading}
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center transition-colors shadow-lg">
                {avatarUploading ? <Loader2 size={11} className="animate-spin text-white" /> : <Camera size={11} className="text-white" />}
              </button>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-zinc-100 truncate">{user.name}</p>
            <p className="text-xs text-zinc-500">
              {role}
              {user.profile?.category === 'fornecedor' ? ' · Fornecedor' : ''}
            </p>
            {canEdit && (
              <p className="text-[11px] text-zinc-600 mt-1">Clique na câmera para trocar a foto (JPG, PNG, WebP · máx. 5 MB)</p>
            )}
          </div>
          <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); e.target.value = ''; }} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nome completo">
            <Input value={name} onChange={canEdit ? setName : undefined} readOnly={!canEdit} />
          </Field>
          <Field label="Email">
            <Input value={user.email} readOnly />
          </Field>
          <Field label="Cargo / Posição">
            <Select value={positionCustom ? CUSTOM_OPT : position}
              onChange={v => {
                if (!canEdit) return;
                if (v === CUSTOM_OPT) { setPositionCustom(true); setPosition(''); }
                else { setPositionCustom(false); setPosition(v); }
              }}
              options={[{ value: '', label: 'Selecione...' }, ...POSITIONS.map(p => ({ value: p, label: p })), { value: CUSTOM_OPT, label: 'Outro (digitar)' }]}
              disabled={!canEdit} />
            {positionCustom && (
              <Input value={position} onChange={canEdit ? setPosition : undefined} placeholder="Digite o cargo" readOnly={!canEdit} />
            )}
          </Field>
          <Field label="Departamento">
            <Select value={departmentCustom ? CUSTOM_OPT : department}
              onChange={v => {
                if (!canEdit) return;
                if (v === CUSTOM_OPT) { setDepartmentCustom(true); setDepartment(''); }
                else { setDepartmentCustom(false); setDepartment(v); }
              }}
              options={[{ value: '', label: 'Selecione...' }, ...DEPARTMENTS.map(d => ({ value: d, label: d })), { value: CUSTOM_OPT, label: 'Outro (digitar)' }]}
              disabled={!canEdit} />
            {departmentCustom && (
              <Input value={department} onChange={canEdit ? setDepartment : undefined} placeholder="Digite o departamento" readOnly={!canEdit} />
            )}
          </Field>
          <Field label="Empresa">
            <Input value={company} onChange={canEdit ? setCompany : undefined} placeholder="Ex: Longview" readOnly={!canEdit} />
          </Field>
          <Field label="Gestor Responsável">
            {pageMeta.canSetManagerId ? (
              <Select value={managerId} onChange={setManagerId}
                options={[{ value: '', label: 'Nenhum' }, ...managers.map(m => ({ value: m.id, label: `${m.name} (${m.role})` }))]} />
            ) : (
              <Input value={managers.find(m => m.id === managerId)?.name ?? (managerId ? managerId : '—')} readOnly />
            )}
          </Field>
          {pageMeta.canChangeRole ? (
            <Field label="Perfil (role)">
              <Select value={role} onChange={v => { setRole(v); setProfIdType(PROF_ID_BY_ROLE[v]?.type ?? 'outro'); }}
                options={ROLES.map(r => ({ value: r, label: r }))} />
            </Field>
          ) : null}
          <Field label="Status">
            <Select value={status} onChange={canEdit ? setStatus : () => {}} options={STATUS_OPTS} disabled={!canEdit} />
          </Field>
          <Field label="Data de entrada">
            <Input type="date" value={activatedAt} onChange={canEdit ? setActivatedAt : undefined} readOnly={!canEdit} />
          </Field>
          <Field label="Data de nascimento">
            <Input type="date" value={birthDate} onChange={canEdit ? setBirthDate : undefined} readOnly={!canEdit} />
          </Field>
          <Field label="LinkedIn">
            <Input value={linkedIn} onChange={canEdit ? setLinkedIn : undefined} placeholder="https://linkedin.com/in/..." readOnly={!canEdit} />
          </Field>
        </div>
      </Section>

      {/* ── Documentos Pessoais ── */}
      {pageMeta.canViewSensitive && (
      <Section title="Documentos Pessoais" icon={ShieldCheck} accent="text-sky-400">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="CPF" required>
            <Input value={cpf} onChange={canEdit ? v => { setCpf(formatCPF(v)); setCpfError(''); } : undefined}
              placeholder="000.000.000-00" readOnly={!canEdit} error={cpfError} />
          </Field>
          <div /> {/* spacer */}
          <Field label="RG">
            <Input value={rg} onChange={canEdit ? setRg : undefined} placeholder="00.000.000-0" readOnly={!canEdit} />
          </Field>
          <Field label="Órgão emissor RG">
            <Input value={rgOrgao} onChange={canEdit ? setRgOrgao : undefined} placeholder="SSP, DETRAN..." readOnly={!canEdit} />
          </Field>
          <Field label="Estado emissor RG">
            <Select value={rgEstado} onChange={canEdit ? setRgEstado : () => {}}
              options={[{ value: '', label: 'Selecione...' }, ...STATES_BR.map(s => ({ value: s, label: s }))]}
              disabled={!canEdit} />
          </Field>
        </div>
      </Section>
      )}

      {/* ── Registro Profissional (condicional por cargo) ── */}
      {pageMeta.canViewSensitive && (
      <Section title={profConfig ? `Registro Profissional — ${profConfig.type}` : 'Registro Profissional'} icon={FileText} accent="text-violet-400">
        {!profConfig && (
          <p className="text-xs text-zinc-500 mb-3">
            Preencha se este colaborador possuir registro em órgão profissional (CRECI, CREA, CRM, OAB, CRC, etc.)
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Tipo de registro">
            <Select value={profIdType} onChange={canEdit ? setProfIdType : () => {}}
              options={[
                { value: '',      label: 'Nenhum' },
                { value: 'CRECI', label: 'CRECI — Corretor' },
                { value: 'CREA',  label: 'CREA — Engenheiro / Arquiteto' },
                { value: 'CRM',   label: 'CRM — Médico' },
                { value: 'OAB',   label: 'OAB — Advogado' },
                { value: 'CRC',   label: 'CRC — Contador' },
                { value: 'outro', label: 'Outro' },
              ]}
              disabled={!canEdit} />
          </Field>
          <Field label={profConfig ? profConfig.label : 'Número do registro'}>
            <Input value={profId} onChange={canEdit ? setProfId : undefined}
              placeholder={profConfig?.placeholder ?? 'Número do registro'}
              readOnly={!canEdit} />
          </Field>
          <Field label="Estado do registro">
            <Select value={profIdState} onChange={canEdit ? setProfIdState : () => {}}
              options={[{ value: '', label: 'Selecione...' }, ...STATES_BR.map(s => ({ value: s, label: s }))]}
              disabled={!canEdit} />
          </Field>
          <Field label="Data de vencimento">
            <Input type="date" value={profIdExpiry} onChange={canEdit ? setProfIdExpiry : undefined} readOnly={!canEdit} />
            {profIdExpiry && new Date(profIdExpiry) < new Date() && (
              <p className="text-[11px] text-red-400 mt-1">⚠ Registro vencido</p>
            )}
            {profIdExpiry && (() => {
              const days = Math.ceil((new Date(profIdExpiry).getTime() - new Date().getTime()) / 86400000);
              return days > 0 && days <= 60
                ? <p className="text-[11px] text-amber-400 mt-1">⚠ Vence em {days} dias</p>
                : null;
            })()}
          </Field>
        </div>
      </Section>
      )}

      {/* ── Contato ── */}
      <Section title="Contato" icon={Phone}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Telefone">
            <Input value={phone} onChange={canEdit ? setPhone : undefined} placeholder="+55 48 91234-5678" type="tel" readOnly={!canEdit} />
          </Field>
          <Field label="WhatsApp">
            <Input value={whatsapp} onChange={canEdit ? setWhatsapp : undefined} placeholder="+55 48 91234-5678" type="tel" readOnly={!canEdit} />
          </Field>
        </div>
      </Section>

      {/* ── Endereço ── */}
      <Section title="Endereço" icon={MapPin}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Field label="Logradouro">
              <Input value={street} onChange={canEdit ? setStreet : undefined} placeholder="Rua, Av., Estrada..." readOnly={!canEdit} />
            </Field>
          </div>
          <Field label="Número">
            <Input value={addrNumber} onChange={canEdit ? setAddrNumber : undefined} placeholder="123" readOnly={!canEdit} />
          </Field>
          <Field label="Complemento">
            <Input value={complement} onChange={canEdit ? setComplement : undefined} placeholder="Apto, Bloco..." readOnly={!canEdit} />
          </Field>
          <Field label="Cidade">
            <Input value={city} onChange={canEdit ? setCity : undefined} placeholder="Florianópolis" readOnly={!canEdit} />
          </Field>
          <Field label="Estado">
            <Select value={addrState} onChange={canEdit ? setAddrState : () => {}}
              options={[{ value: '', label: 'Selecione...' }, ...STATES_BR.map(s => ({ value: s, label: s }))]}
              disabled={!canEdit} />
          </Field>
          <Field label="CEP">
            <Input value={zip} onChange={canEdit ? setZip : undefined} placeholder="00000-000" readOnly={!canEdit} />
          </Field>
        </div>
      </Section>

      {/* ── Contato de Emergência ── */}
      <Section title="Contato de Emergência" icon={Heart}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nome">
            <Input value={ecName} onChange={canEdit ? setEcName : undefined} placeholder="Nome do contato" readOnly={!canEdit} />
          </Field>
          <Field label="Telefone">
            <Input value={ecPhone} onChange={canEdit ? setEcPhone : undefined} placeholder="+55 48 91234-5678" type="tel" readOnly={!canEdit} />
          </Field>
          <Field label="Parentesco / Relação">
            <Input value={ecRel} onChange={canEdit ? setEcRel : undefined} placeholder="Cônjuge, Pai, Mãe..." readOnly={!canEdit} />
          </Field>
        </div>
      </Section>

      {/* ── Documentos / Contratos ── */}
      <Section title="Documentos & Contratos" icon={FileText} accent="text-amber-400">
        {/* Indicador público */}
        <div className="flex items-center gap-3 mb-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium ${
            docs.length > 0
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
              : 'bg-zinc-500/10 border border-zinc-700 text-zinc-500'
          }`}>
            <FileText size={12} />
            {docs.length > 0 ? `${docs.length} documento${docs.length > 1 ? 's' : ''} arquivado${docs.length > 1 ? 's' : ''}` : 'Nenhum documento'}
          </div>
          {canManageDocs && (
            <button onClick={() => setShowDocForm(v => !v)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#121214] border border-[#1E1E22] text-xs font-medium text-zinc-400 hover:text-zinc-100 hover:border-zinc-600 transition-all">
              <Upload size={12} />
              Enviar documento
            </button>
          )}
        </div>

        {/* Formulário de upload */}
        {showDocForm && canManageDocs && (
          <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-3 mb-3">
            <p className="text-xs font-semibold text-amber-300">Novo documento</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Nome do documento">
                <Input value={docName} onChange={setDocName} placeholder="Ex: Contrato CLT 2024" />
              </Field>
              <Field label="Categoria">
                <Select value={docCategory} onChange={setDocCategory} options={DOC_CATEGORIES} />
              </Field>
              <Field label="Data de validade (opcional)">
                <Input type="date" value={docExpiry} onChange={setDocExpiry} />
              </Field>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => docInputRef.current?.click()} disabled={docUploading || !docName.trim()}
                className="flex items-center gap-2 h-9 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black text-sm font-semibold transition-colors">
                {docUploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                {docUploading ? 'Enviando...' : 'Selecionar arquivo'}
              </button>
              <p className="text-[11px] text-zinc-600">PDF, JPG ou PNG · máx. 20 MB</p>
              <button onClick={() => setShowDocForm(false)} className="ml-auto text-xs text-zinc-600 hover:text-zinc-400">Cancelar</button>
            </div>
            <input ref={docInputRef} type="file" accept="application/pdf,image/jpeg,image/png" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleDocUpload(f); e.target.value = ''; }} />
          </div>
        )}

        {/* Lista de documentos */}
        {docsLoading ? (
          <div className="h-10 rounded-xl bg-white/[0.03] animate-pulse" />
        ) : docs.length === 0 ? (
          <p className="text-xs text-zinc-600 text-center py-6">Nenhum documento arquivado</p>
        ) : (
          <div className="space-y-2">
            {docs.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#17171A] border border-[#1E1E22]">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  doc.contentType === 'application/pdf' ? 'bg-red-500/15 text-red-400' : 'bg-sky-500/15 text-sky-400'
                }`}>
                  <FileText size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-100 font-medium truncate">{doc.name}</p>
                  <p className="text-[11px] text-zinc-500 truncate">
                    {DOC_CATEGORIES.find(c => c.value === doc.category)?.label ?? doc.category}
                    {doc.sizeBytes ? ` · ${fmtSize(doc.sizeBytes)}` : ''}
                    {` · ${fmtDate(doc.uploadedAt)}`}
                    {doc.expiresAt && ` · vence ${fmtDate(doc.expiresAt)}`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {canManageDocs && (
                    <a href={`/api/admin/users/${id}/documents/${doc.id}`}
                      target="_blank" rel="noopener noreferrer"
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-sky-400 hover:bg-sky-500/10 transition-all">
                      <ExternalLink size={13} />
                    </a>
                  )}
                  {canManageDocs && (
                    <a href={`/api/admin/users/${id}/documents/${doc.id}`} download
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all">
                      <Download size={13} />
                    </a>
                  )}
                  {canManageDocs && (
                    <button onClick={() => handleDocDelete(doc.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all">
                      <Trash2 size={13} />
                    </button>
                  )}
                  {!canManageDocs && (
                    <span className="text-[10px] text-zinc-600">Arquivo restrito</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Notas internas (admin) ── */}
      {isAdmin && (
        <Section title="Observações Internas" icon={Building2}>
          <Field label="Notas (visível apenas para admin)">
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Informações internas sobre o colaborador..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl bg-[#121214]/60 border border-[#1E1E22] text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 resize-none" />
          </Field>
        </Section>
      )}

      {/* ── Permissões do sistema (somente admin, não é o próprio) ── */}
      {pageMeta.canManagePermissions && !isSelf && (
        <Section title="Permissões do Sistema" icon={ShieldCheck} accent="text-amber-400">
          <div className="space-y-4">
            {/* Marketing Vision */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Marketing Vision</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {([
                  ['viewMarketingDashboard',     'Dashboard Comercial'],
                  ['viewMarketingLeads',         'Leads (CRM)'],
                  ['viewMarketingOportunidades', 'Oportunidades'],
                  ['viewMarketingEstoque',       'Estoque'],
                  ['viewMarketingAds',           'Anúncios (Meta)'],
                  ['viewMarketingVendas',        'Vendas'],
                ] as [keyof UserPerms, string][]).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white cursor-pointer select-none">
                    <input type="checkbox" checked={perms[key] as boolean}
                      onChange={() => setPerms(p => ({ ...p, [key]: !p[key] }))}
                      className="w-3.5 h-3.5 rounded bg-[#1b1b1f] border-[#2e2e34] text-amber-500 focus:ring-0" />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            {/* Project Vision */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Project Vision</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {([
                  ['viewProjectVision',   'Acessar Project Vision'],
                  ['manageProjects',      'Criar/Editar Projetos'],
                  ['manageCommentsDocs',  'Comentários e Documentos'],
                  ['deleteTasks',         'Excluir Tarefas'],
                ] as [keyof UserPerms, string][]).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white cursor-pointer select-none">
                    <input type="checkbox" checked={perms[key] as boolean}
                      onChange={() => setPerms(p => ({ ...p, [key]: !p[key] }))}
                      className="w-3.5 h-3.5 rounded bg-[#1b1b1f] border-[#2e2e34] text-amber-500 focus:ring-0" />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            {/* Outros módulos */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Outros Módulos</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {([
                  ['viewPeopleVision',  'People Vision'],
                  ['viewQualityVision', 'Quality Vision'],
                  ['viewSalesVision',   'Sales Vision'],
                  ['isAdmin',           'Administrador (acesso total)'],
                ] as [keyof UserPerms, string][]).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white cursor-pointer select-none">
                    <input type="checkbox" checked={perms[key] as boolean}
                      onChange={() => setPerms(p => ({ ...p, [key]: !p[key] }))}
                      disabled={!pageMeta.canChangeRole && key === 'isAdmin'}
                      className="w-3.5 h-3.5 rounded bg-[#1b1b1f] border-[#2e2e34] text-amber-500 focus:ring-0" />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            {/* Botão salvar permissões */}
            <button onClick={handleSavePermissions} disabled={permsSaving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium hover:bg-amber-500/20 transition-colors disabled:opacity-50">
              {permsSaving ? <Loader2 size={14} className="animate-spin" /> : permsSaved ? <Check size={14} /> : <ShieldCheck size={14} />}
              {permsSaved ? 'Permissões salvas!' : 'Salvar Permissões'}
            </button>
          </div>
        </Section>
      )}

      {/* ── Segurança ── */}
      {(isSelf || id === currentUser?.id) && (
        <Section title="Segurança" icon={Lock}>
          <p className="text-xs text-zinc-500 mb-3">Deixe em branco para não alterar a senha.</p>
          <div className="space-y-3">
            <Field label="Senha atual">
              <Input type="password" value={currentPwd} onChange={setCurrentPwd} placeholder="••••••••" />
            </Field>
            <Field label="Nova senha">
              <Input type="password" value={newPwd} onChange={setNewPwd} placeholder="Mínimo 8 caracteres" />
            </Field>
            <Field label="Confirmar nova senha">
              <Input type="password" value={confirmPwd} onChange={setConfirmPwd} placeholder="Repita a nova senha" />
            </Field>
          </div>
        </Section>
      )}

      <div className="text-[11px] text-zinc-600 text-center pb-4">
        Cadastrado em {new Date(user.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
        {' · '} ID: {user.id}
      </div>

    </div>
  );
}
