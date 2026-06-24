'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, Loader2, Check, User, Phone, Building2, MapPin, Heart, Lock, AlertCircle } from 'lucide-react';
import { useUser } from '@/context/UserContext';

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  profile?: {
    phone?: string;
    whatsapp?: string;
    position?: string;
    department?: string;
    company?: string;
    activatedAt?: string;
    birthDate?: string;
    linkedIn?: string;
    avatarUrl?: string;
    status?: string;
    notes?: string;
    address?: {
      street?: string; number?: string; complement?: string;
      city?: string; state?: string; zip?: string; country?: string;
    };
    emergencyContact?: {
      name?: string; phone?: string; relationship?: string;
    };
  };
}

const ROLES = ['Desenvolvedor', 'Diretoria', 'Gestor', 'Operador', 'Parceiro', 'Corretor', 'Visualizador'];
const STATUS_OPTS = [
  { value: 'ativo',    label: 'Ativo' },
  { value: 'ferias',   label: 'Férias' },
  { value: 'afastado', label: 'Afastado' },
  { value: 'inativo',  label: 'Inativo' },
];

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-white/[0.06]">
        <Icon size={15} className="text-emerald-400" />
        <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] text-zinc-500 uppercase tracking-wider mb-1.5 font-semibold">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text', readOnly }: {
  value: string; onChange?: (v: string) => void; placeholder?: string; type?: string; readOnly?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      readOnly={readOnly}
      className={`w-full h-10 px-3 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none transition-colors ${
        readOnly
          ? 'bg-white/[0.02] border border-white/[0.04] text-zinc-500 cursor-default'
          : 'bg-white/[0.04] border border-white/[0.08] focus:border-emerald-500/50'
      }`}
    />
  );
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full h-10 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-100 focus:outline-none focus:border-emerald-500/50"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export default function ColaboradorPage() {
  const { id }           = useParams<{ id: string }>();
  const router           = useRouter();
  const { currentUser }  = useUser();
  const isAdmin          = currentUser?.role === 'Desenvolvedor' || currentUser?.permissions?.isAdmin === true;
  const isSelf           = currentUser?.id === id || id === 'me';

  const [user, setUser]       = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState('');

  // Form state
  const [name, setName]         = useState('');
  const [role, setRole]         = useState('');
  const [status, setStatus]     = useState('ativo');
  const [phone, setPhone]       = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [position, setPosition] = useState('');
  const [department, setDepartment] = useState('');
  const [company, setCompany]   = useState('');
  const [activatedAt, setActivatedAt] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [linkedIn, setLinkedIn] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [notes, setNotes]       = useState('');
  // Address
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [city, setCity] = useState('');
  const [state, setState_] = useState('');
  const [zip, setZip] = useState('');
  // Emergency
  const [ecName, setEcName] = useState('');
  const [ecPhone, setEcPhone] = useState('');
  const [ecRel, setEcRel] = useState('');
  // Password (only for own profile)
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');

  useEffect(() => {
    const endpoint = (isSelf || id === currentUser?.id) ? '/api/user/me' : `/api/admin/users/${id}`;
    fetch(endpoint)
      .then(r => r.json())
      .then(d => {
        const u: UserData = d.user ?? d;
        setUser(u);
        setName(u.name ?? '');
        setRole(u.role ?? '');
        setStatus(u.profile?.status ?? 'ativo');
        setPhone(u.profile?.phone ?? '');
        setWhatsapp(u.profile?.whatsapp ?? '');
        setPosition(u.profile?.position ?? '');
        setDepartment(u.profile?.department ?? '');
        setCompany(u.profile?.company ?? '');
        setActivatedAt(u.profile?.activatedAt?.slice(0, 10) ?? '');
        setBirthDate(u.profile?.birthDate?.slice(0, 10) ?? '');
        setLinkedIn(u.profile?.linkedIn ?? '');
        setAvatarUrl(u.profile?.avatarUrl ?? '');
        setNotes(u.profile?.notes ?? '');
        setStreet(u.profile?.address?.street ?? '');
        setNumber(u.profile?.address?.number ?? '');
        setComplement(u.profile?.address?.complement ?? '');
        setCity(u.profile?.address?.city ?? '');
        setState_(u.profile?.address?.state ?? '');
        setZip(u.profile?.address?.zip ?? '');
        setEcName(u.profile?.emergencyContact?.name ?? '');
        setEcPhone(u.profile?.emergencyContact?.phone ?? '');
        setEcRel(u.profile?.emergencyContact?.relationship ?? '');
      })
      .catch(() => setError('Colaborador não encontrado'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        name,
        profile: {
          phone, whatsapp, position, department, company,
          activatedAt: activatedAt || undefined,
          birthDate:   birthDate || undefined,
          linkedIn, avatarUrl, status,
          notes: isAdmin ? notes : undefined,
          address: { street, number, complement, city, state, zip, country: 'Brasil' },
          emergencyContact: { name: ecName, phone: ecPhone, relationship: ecRel },
        },
      };
      // Password change (own profile only)
      if ((isSelf || id === currentUser?.id) && currentPwd && newPwd) {
        if (newPwd !== confirmPwd) { setError('Senhas não conferem'); setSaving(false); return; }
        if (newPwd.length < 8)    { setError('Nova senha: mínimo 8 caracteres'); setSaving(false); return; }
        body.currentPassword = currentPwd;
        body.newPassword     = newPwd;
      }
      // Admin can change role
      if (isAdmin && !isSelf) body.role = role;

      const endpoint = (isSelf || id === currentUser?.id) ? '/api/user/me' : `/api/admin/users/${id}`;
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Erro ao salvar');
      }
      setSaved(true);
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '60dvh' }}>
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <AlertCircle size={32} className="text-zinc-600" />
        <p className="text-zinc-500">Colaborador não encontrado</p>
        <button onClick={() => router.back()} className="text-sm text-emerald-400">← Voltar</button>
      </div>
    );
  }

  const canEdit = isAdmin || isSelf || id === currentUser?.id;

  return (
    <div className="px-4 pt-6 pb-12 max-w-2xl mx-auto lg:px-8 lg:pt-10 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-white/[0.06] text-zinc-400 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white">{user.name}</h1>
          <p className="text-xs text-zinc-500">{user.email}</p>
        </div>
        {canEdit && (
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold transition-colors ${
              saved
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-emerald-500 hover:bg-emerald-400 text-white'
            }`}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Save size={14} />}
            {saved ? 'Salvo' : 'Salvar'}
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Avatar + dados básicos */}
      <Section title="Dados Básicos" icon={User}>
        <div className="flex items-center gap-4 mb-2">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={user.name} className="w-16 h-16 rounded-full object-cover border border-white/10" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-emerald-800/30 border border-emerald-700/20 flex items-center justify-center text-xl font-bold text-emerald-300">
              {(user.name || '').split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() || '?'}
            </div>
          )}
          <div className="flex-1">
            <Field label="URL do Avatar">
              <Input value={avatarUrl} onChange={canEdit ? setAvatarUrl : undefined} placeholder="https://..." readOnly={!canEdit} />
            </Field>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nome completo">
            <Input value={name} onChange={canEdit ? setName : undefined} readOnly={!canEdit} />
          </Field>
          <Field label="Email">
            <Input value={user.email} readOnly />
          </Field>
          <Field label="Cargo / Posição">
            <Input value={position} onChange={canEdit ? setPosition : undefined} placeholder="Ex: Engenheiro de Software" readOnly={!canEdit} />
          </Field>
          <Field label="Departamento">
            <Input value={department} onChange={canEdit ? setDepartment : undefined} placeholder="Ex: Tecnologia" readOnly={!canEdit} />
          </Field>
          <Field label="Empresa">
            <Input value={company} onChange={canEdit ? setCompany : undefined} placeholder="Ex: Longview" readOnly={!canEdit} />
          </Field>
          {isAdmin && (
            <Field label="Perfil (role)">
              <Select value={role} onChange={setRole} options={ROLES.map(r => ({ value: r, label: r }))} />
            </Field>
          )}
          <Field label="Status">
            <Select value={status} onChange={canEdit ? setStatus : () => {}} options={STATUS_OPTS} />
          </Field>
          <Field label="Data de entrada na empresa">
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

      {/* Contato */}
      <Section title="Contato" icon={Phone}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Telefone">
            <Input value={phone} onChange={canEdit ? setPhone : undefined} placeholder="+55 11 91234-5678" type="tel" readOnly={!canEdit} />
          </Field>
          <Field label="WhatsApp">
            <Input value={whatsapp} onChange={canEdit ? setWhatsapp : undefined} placeholder="+55 11 91234-5678" type="tel" readOnly={!canEdit} />
          </Field>
        </div>
      </Section>

      {/* Endereço */}
      <Section title="Endereço" icon={MapPin}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Field label="Logradouro">
              <Input value={street} onChange={canEdit ? setStreet : undefined} placeholder="Rua, Av., Estrada..." readOnly={!canEdit} />
            </Field>
          </div>
          <Field label="Número">
            <Input value={number} onChange={canEdit ? setNumber : undefined} placeholder="123" readOnly={!canEdit} />
          </Field>
          <Field label="Complemento">
            <Input value={complement} onChange={canEdit ? setComplement : undefined} placeholder="Apto, Bloco..." readOnly={!canEdit} />
          </Field>
          <Field label="Cidade">
            <Input value={city} onChange={canEdit ? setCity : undefined} placeholder="São Paulo" readOnly={!canEdit} />
          </Field>
          <Field label="Estado">
            <Input value={state} onChange={canEdit ? setState_ : undefined} placeholder="SP" readOnly={!canEdit} />
          </Field>
          <Field label="CEP">
            <Input value={zip} onChange={canEdit ? setZip : undefined} placeholder="00000-000" readOnly={!canEdit} />
          </Field>
        </div>
      </Section>

      {/* Contato de emergência */}
      <Section title="Contato de Emergência" icon={Heart}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nome">
            <Input value={ecName} onChange={canEdit ? setEcName : undefined} placeholder="Nome do contato" readOnly={!canEdit} />
          </Field>
          <Field label="Telefone">
            <Input value={ecPhone} onChange={canEdit ? setEcPhone : undefined} placeholder="+55 11 91234-5678" type="tel" readOnly={!canEdit} />
          </Field>
          <Field label="Parentesco / Relação">
            <Input value={ecRel} onChange={canEdit ? setEcRel : undefined} placeholder="Ex: Cônjuge, Pai, Mãe..." readOnly={!canEdit} />
          </Field>
        </div>
      </Section>

      {/* Notas internas (apenas admin) */}
      {isAdmin && (
        <Section title="Observações Internas" icon={Building2}>
          <Field label="Notas (visível apenas para admin)">
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Informações internas sobre o colaborador..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 resize-none"
            />
          </Field>
        </Section>
      )}

      {/* Alterar senha (próprio perfil) */}
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

      {/* Info de cadastro */}
      <div className="text-[11px] text-zinc-600 text-center pb-4">
        Cadastrado em {new Date(user.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
        {' · '} ID: {user.id}
      </div>

    </div>
  );
}
