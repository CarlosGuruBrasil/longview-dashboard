'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { AlertCircle, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import PasswordInput from '@/components/app/PasswordInput';

export default function PrimeiroAcessoPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/first-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword, confirmPassword }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível atualizar a senha.');
      }

      router.push('/select-app');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar a senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#09090b] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-orange-500/5 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[520px] bg-[#121214]/60 border border-[#1e1e22] rounded-3xl p-8 backdrop-blur-md shadow-[0_18px_60px_rgba(0,0,0,0.35)] relative z-10">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="relative w-48 h-16 mb-5">
            <Image src="/logolongview.png" alt="LongView" fill className="object-contain" priority />
          </div>
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
            <ShieldCheck size={24} className="text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Primeiro acesso</h1>
          <p className="text-sm text-zinc-400 mt-2 max-w-sm">
            Antes de entrar no sistema, defina uma nova senha. A navegação fica bloqueada até essa etapa ser concluída.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3.5 bg-red-500/5 border border-red-500/20 text-red-400 rounded-xl text-sm flex items-start gap-2.5">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
              Nova senha
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                <KeyRound size={16} />
              </div>
              <PasswordInput
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                inputClassName="w-full bg-[#1b1b1f] border border-[#2e2e34] rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all duration-200"
                placeholder="Crie uma senha forte"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
              Confirmar nova senha
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                <KeyRound size={16} />
              </div>
              <PasswordInput
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                inputClassName="w-full bg-[#1b1b1f] border border-[#2e2e34] rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all duration-200"
                placeholder="Repita a senha"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3.5 px-4 rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Atualizando senha...</span>
              </>
            ) : (
              <span>Salvar e continuar</span>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
