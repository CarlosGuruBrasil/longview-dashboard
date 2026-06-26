'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Lock, Mail, Loader2, AlertCircle } from 'lucide-react';
import PasswordInput from '@/components/app/PasswordInput';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Credenciais inválidas.');
      }

      // Redireciona para a tela de seleção de aplicativo
      router.push('/select-app');
      router.refresh();
    } catch (err: any) {
      console.error('Erro de login:', err);
      setError(err.message || 'Erro ao conectar ao servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Elementos visuais de background (Glows) */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-orange-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none" />

      {/* Card de Login */}
      <div className="w-full max-w-[440px] bg-[#121214]/40 border border-[#1e1e22] rounded-2xl p-8 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Header do Card */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-48 h-16 mb-4 flex items-center justify-center">
            <Image
              src="/logolongview.png"
              alt="LongView"
              fill
              className="object-contain"
              priority
            />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Portal de Inteligência</h2>
          <p className="text-xs text-zinc-400 mt-1.5 text-center">
            Faça login para acessar o Marketing Vision ou Project Vision
          </p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3.5 bg-red-500/5 border border-red-500/20 text-red-400 rounded-xl text-xs font-medium flex items-start gap-2.5">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <p className="leading-relaxed">{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
              E-mail corporativo
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                <Mail size={16} />
              </div>
              <input
                type="email"
                name="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[#1b1b1f] border border-[#2e2e34] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-all duration-200"
                placeholder="nome@longview.com.br"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
              Senha de acesso
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                <Lock size={16} />
              </div>
              <PasswordInput
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                inputClassName="w-full bg-[#1b1b1f] border border-[#2e2e34] rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-all duration-200"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white hover:bg-zinc-200 text-black font-bold py-3.5 px-4 rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(255,255,255,0.05)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Autenticando...</span>
              </>
            ) : (
              <span>Entrar no Painel</span>
            )}
          </button>
        </form>
      </div>

      {/* Footer */}
      <p className="text-[10px] text-zinc-600 mt-8 tracking-wider uppercase font-semibold">
        LongView Empreendimentos © 2026
      </p>
    </main>
  );
}
