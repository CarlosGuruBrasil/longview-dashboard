'use client';

import { useState, useEffect, useCallback } from 'react';
import { Link2, RefreshCw, Copy, Check, UserCheck, UserX, Loader2, AlertCircle, Clock } from 'lucide-react';

interface InviteToken {
  token: string;
  generatedAt: string;
  generatedBy: string;
}

interface Registration {
  id: string;
  name: string;
  email: string;
  approverName: string;
  approverEmail: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  processedAt?: string;
  processedBy?: string;
  profile?: {
    position?: string;
    department?: string;
    phone?: string;
  };
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (d > 0) return `${d}d atrás`;
  if (h > 0) return `${h}h atrás`;
  return 'agora';
}

export default function CadastroPage() {
  const [invite, setInvite]     = useState<InviteToken | null>(null);
  const [regs, setRegs]         = useState<Registration[]>([]);
  const [loadingInvite, setLi]  = useState(true);
  const [loadingRegs, setLr]    = useState(true);
  const [generatingLink, setGl] = useState(false);
  const [copied, setCopied]     = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter]     = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');

  const fetchInvite = useCallback(() => {
    setLi(true);
    fetch('/api/admin/invite-link').then(r => r.json()).then(d => setInvite(d.invite)).finally(() => setLi(false));
  }, []);

  const fetchRegs = useCallback(() => {
    setLr(true);
    fetch('/api/admin/registrations').then(r => r.json()).then(d => setRegs(d.registrations ?? [])).finally(() => setLr(false));
  }, []);

  useEffect(() => { fetchInvite(); fetchRegs(); }, [fetchInvite, fetchRegs]);

  const generateLink = async () => {
    setGl(true);
    try {
      const res  = await fetch('/api/admin/invite-link', { method: 'POST' });
      const data = await res.json();
      setInvite(data.invite);
    } finally { setGl(false); }
  };

  const copyLink = () => {
    if (!invite) return;
    const url = `${window.location.origin}/cadastro?token=${invite.token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const processReg = async (id: string, action: 'approve' | 'reject') => {
    setProcessing(id);
    try {
      await fetch('/api/admin/registrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      fetchRegs();
    } finally { setProcessing(null); }
  };

  const filtered = regs.filter(r => filter === 'all' || r.status === filter);
  const pendingCount = regs.filter(r => r.status === 'pending').length;

  const inviteUrl = invite ? `${typeof window !== 'undefined' ? window.location.origin : ''}/cadastro?token=${invite.token}` : '';

  return (
    <div className="w-full space-y-6 p-4 md:p-6 lg:px-6 lg:py-4">
      {/* Link de convite */}
      <div className="rounded-xl border border-[#1E1E22] bg-[#121214]/60 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Link2 size={15} className="text-emerald-400" />
          <h2 className="text-sm font-semibold text-zinc-200">Link de Convite</h2>
        </div>

        <p className="text-xs text-zinc-500 leading-relaxed">
          Compartilhe este link para que novos colaboradores possam solicitar acesso ao sistema.
          O aprovador escolhido receberá uma notificação para liberar o cadastro.
        </p>

        {loadingInvite ? (
          <div className="h-10 rounded-xl bg-[#18181B] animate-pulse" />
        ) : invite ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-[#121214]/60 border border-[#1E1E22]">
              <p className="flex-1 text-xs text-zinc-300 font-mono truncate">{inviteUrl}</p>
              <button
                onClick={copyLink}
                className={`shrink-0 flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-medium transition-colors ${
                  copied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/[0.06] text-zinc-400 hover:text-zinc-100'
                }`}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-zinc-600">
                Gerado por {invite.generatedBy} em {new Date(invite.generatedAt).toLocaleDateString('pt-BR')}
              </p>
              <button
                onClick={generateLink}
                disabled={generatingLink}
                className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-[#1E1E22] bg-[#18181B] text-xs font-medium text-zinc-400 hover:text-zinc-100 hover:bg-[#202024] transition-all"
              >
                {generatingLink ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                Rotacionar link
              </button>
            </div>
            <p className="text-[11px] text-amber-400/80 flex items-center gap-1">
              <AlertCircle size={11} />
              Rotacionar invalida o link anterior imediatamente.
            </p>
          </div>
        ) : (
          <button
            onClick={generateLink}
            disabled={generatingLink}
            className="flex items-center gap-2 h-9 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold transition-colors"
          >
            {generatingLink ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
            Gerar link de convite
          </button>
        )}
      </div>

      {/* Aprovações */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <UserCheck size={15} className="text-emerald-400" />
            Solicitações
            {pendingCount > 0 && (
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                {pendingCount}
              </span>
            )}
          </h2>
          <div className="flex gap-1">
            {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`h-7 px-2.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === f ? 'bg-emerald-500/20 text-emerald-300' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {{ pending: 'Pendentes', approved: 'Aprovados', rejected: 'Rejeitados', all: 'Todos' }[f]}
              </button>
            ))}
          </div>
        </div>

        {loadingRegs ? (
          <div className="space-y-2">
            {[1, 2].map(i => <div key={i} className="h-20 rounded-xl bg-white/[0.03] animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-zinc-600 text-sm">
            <Clock size={28} className="mx-auto mb-2 text-zinc-700" />
            Nenhuma solicitação {filter !== 'all' ? `com status "${filter === 'pending' ? 'pendente' : filter === 'approved' ? 'aprovado' : 'rejeitado'}"` : ''}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(reg => (
              <div
                key={reg.id}
                className={`p-4 rounded-xl border transition-colors ${
                  reg.status === 'pending'
                    ? 'border-amber-500/20 bg-amber-500/4'
                    : reg.status === 'approved'
                    ? 'border-emerald-500/15 bg-emerald-500/3'
                    : 'border-[#1E1E22] bg-[#121214]/60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-zinc-700/50 flex items-center justify-center text-sm font-bold text-zinc-300 shrink-0">
                    {reg.name ? reg.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() : '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-zinc-100">{reg.name}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${
                        reg.status === 'pending'  ? 'bg-amber-500/15 text-amber-300' :
                        reg.status === 'approved' ? 'bg-emerald-500/15 text-emerald-300' :
                        'bg-zinc-500/15 text-zinc-400'
                      }`}>
                        {reg.status === 'pending' ? 'Pendente' : reg.status === 'approved' ? 'Aprovado' : 'Rejeitado'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">{reg.email}</p>
                    {(reg.profile?.position || reg.profile?.department) && (
                      <p className="text-[11px] text-zinc-600 mt-0.5">
                        {reg.profile.position}{reg.profile.department ? ` · ${reg.profile.department}` : ''}
                      </p>
                    )}
                    <p className="text-[11px] text-zinc-600 mt-1">
                      Aprovador: {reg.approverName} · {timeAgo(reg.createdAt)}
                      {reg.processedAt && ` · Processado ${timeAgo(reg.processedAt)} por ${reg.processedBy}`}
                    </p>
                  </div>

                  {reg.status === 'pending' && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => processReg(reg.id, 'reject')}
                        disabled={processing === reg.id}
                        className="flex items-center gap-1 h-8 px-3 rounded-xl bg-white/[0.05] text-red-400 hover:bg-red-500/15 text-xs font-medium transition-colors"
                      >
                        {processing === reg.id ? <Loader2 size={11} className="animate-spin" /> : <UserX size={13} />}
                        Rejeitar
                      </button>
                      <button
                        onClick={() => processReg(reg.id, 'approve')}
                        disabled={processing === reg.id}
                        className="flex items-center gap-1 h-8 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-semibold transition-colors"
                      >
                        {processing === reg.id ? <Loader2 size={11} className="animate-spin" /> : <UserCheck size={13} />}
                        Aprovar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
