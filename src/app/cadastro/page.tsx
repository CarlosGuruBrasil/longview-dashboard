'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { UserPlus, AlertCircle, Check, Loader2, ChevronDown } from 'lucide-react';
import PasswordInput from '@/components/app/PasswordInput';
import logger from '@/lib/logger';

interface Approver {
  id: string;
  name: string;
  role: string;
  email: string;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-zinc-500 mb-1.5 font-medium">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text', required }: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean;
}) {
  if (type === 'password') {
    return (
      <PasswordInput
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete="new-password"
        inputClassName="w-full h-11 px-4 pr-10 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
      />
    );
  }

  return (
    <input
      type={type}
      autoComplete={type === 'email' ? 'email' : 'off'}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className="w-full h-11 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
    />
  );
}

function RegisterForm({ token }: { token: string }) {
  const router = useRouter();
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);

  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [approverId, setApproverId] = useState('');
  const [position, setPosition] = useState('');
  const [department, setDepartment] = useState('');
  const [phone, setPhone]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState(false);

  useEffect(() => {
    fetch(`/api/auth/register?token=${token}`)
      .then(r => r.json())
      .then(d => {
        setTokenValid(d.valid ?? false);
        setApprovers(d.approvers ?? []);
        if (d.approvers?.length > 0) setApproverId(d.approvers[0].id);
      })
      .catch((err) => { logger.warn('[cadastro] token validation falhou', err); setTokenValid(false); });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPwd) { setError('As senhas não conferem'); return; }
    if (password.length < 8)    { setError('Senha deve ter pelo menos 8 caracteres'); return; }
    if (!approverId)             { setError('Selecione um aprovador'); return; }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token, name, email, password, approverId,
          profile: { position, department, phone },
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Erro ao enviar solicitação'); return; }
      setSuccess(true);
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (tokenValid === null) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (tokenValid === false) {
    return (
      <div className="text-center py-12 space-y-3">
        <AlertCircle size={36} className="mx-auto text-red-400" />
        <p className="text-zinc-300 font-semibold">Link inválido ou expirado</p>
        <p className="text-sm text-zinc-500">Solicite um novo link de convite ao administrador.</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center py-12 space-y-4">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto">
          <Check size={28} className="text-emerald-400" />
        </div>
        <div>
          <p className="text-zinc-100 font-semibold text-lg">Solicitação enviada!</p>
          <p className="text-sm text-zinc-500 mt-2 max-w-xs mx-auto">
            Sua solicitação foi enviada para aprovação. Você receberá acesso assim que for aprovado.
          </p>
        </div>
        <button onClick={() => router.push('/login')} className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
          Ir para o login
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Field label="Nome completo *">
            <Input value={name} onChange={setName} placeholder="Seu nome completo" required />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Email corporativo *">
            <Input value={email} onChange={setEmail} type="email" placeholder="email@empresa.com" required />
          </Field>
        </div>
        <Field label="Cargo / Posição">
          <Input value={position} onChange={setPosition} placeholder="Ex: Analista de Marketing" />
        </Field>
        <Field label="Departamento">
          <Input value={department} onChange={setDepartment} placeholder="Ex: Comercial" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Telefone / WhatsApp">
            <Input value={phone} onChange={setPhone} type="tel" placeholder="+55 11 91234-5678" />
          </Field>
        </div>
      </div>

      <div className="border-t border-white/[0.06] pt-4 space-y-4">
        <Field label="Senha *">
          <Input value={password} onChange={setPassword} type="password" placeholder="Mínimo 8 caracteres" required />
        </Field>
        <Field label="Confirmar senha *">
          <Input value={confirmPwd} onChange={setConfirmPwd} type="password" placeholder="Repita a senha" required />
        </Field>
      </div>

      <div className="border-t border-white/[0.06] pt-4">
        <Field label="Quem deve aprovar seu acesso? *">
          <div className="relative">
            <select
              value={approverId}
              onChange={e => setApproverId(e.target.value)}
              className="w-full h-11 px-4 pr-10 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-100 focus:outline-none focus:border-emerald-500/50 appearance-none"
              required
            >
              <option value="">Selecione um aprovador</option>
              {approvers.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.role})
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          </div>
          <p className="text-[11px] text-zinc-600 mt-1.5">
            Esta pessoa receberá uma notificação para liberar seu acesso.
          </p>
        </Field>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
      >
        {submitting ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
        {submitting ? 'Enviando...' : 'Solicitar Acesso'}
      </button>
    </form>
  );
}

function CadastroContent() {
  const params = useSearchParams();
  const token  = params.get('token') ?? '';

  return (
    <div className="min-h-screen bg-[#09090b] flex items-start justify-center px-4 pt-12 pb-20">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-36 h-10 mb-4">
            <Image src="/logolongview.png" alt="LongView" fill style={{ objectFit: 'contain' }} sizes="144px" />
          </div>
          <span className="text-[9px] uppercase font-bold tracking-[0.25em] text-emerald-400/70">People Vision</span>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-white">Solicitar Acesso</h1>
            <p className="text-sm text-zinc-500 mt-1">Preencha seus dados para solicitar acesso ao sistema.</p>
          </div>
          <RegisterForm token={token} />
        </div>

        <p className="text-center text-xs text-zinc-600 mt-6">
          Já tem acesso?{' '}
          <a href="/login" className="text-emerald-400 hover:text-emerald-300 transition-colors">
            Fazer login
          </a>
        </p>
      </div>
    </div>
  );
}

export default function CadastroPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <CadastroContent />
    </Suspense>
  );
}
