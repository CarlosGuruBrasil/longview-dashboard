'use client';

import { useState } from 'react';

export function PublicLeadForm({
  empreendimentoId,
  empreendimentoNome,
}: {
  empreendimentoId?: string;
  empreendimentoNome?: string;
}) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const response = await fetch('/api/public/site/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empreendimentoId,
          nome,
          email,
          telefone,
          mensagem,
          origem: empreendimentoNome ? `site_publico:${empreendimentoNome}` : 'site_publico:home',
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error || 'Não foi possível enviar o lead.');
      }

      setFeedback({
        tone: 'success',
        text: json?.action === 'reactivated'
          ? 'Seu interesse foi registrado e seu atendimento foi reativado.'
          : 'Seu interesse foi enviado com sucesso. Nossa equipe vai retornar em breve.',
      });
      setNome('');
      setEmail('');
      setTelefone('');
      setMensagem('');
    } catch (error) {
      setFeedback({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Não foi possível enviar o lead.',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,18,20,0.95),rgba(9,11,12,0.98))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-300">Fale com a LongView</p>
        <h3 className="mt-2 text-2xl font-semibold text-white">Peça atendimento comercial</h3>
        <p className="mt-2 text-sm text-zinc-400">
          {empreendimentoNome
            ? `Registre seu interesse em ${empreendimentoNome} e envie seu contato para o time comercial.`
            : 'Envie seu contato e a equipe comercial retorna com a melhor oportunidade para o seu perfil.'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <input value={nome} onChange={(event) => setNome(event.target.value)} placeholder="Seu nome" className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500" />
        <input value={telefone} onChange={(event) => setTelefone(event.target.value)} placeholder="WhatsApp ou telefone" className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500" />
      </div>
      <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Seu e-mail" className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500" />
      <textarea value={mensagem} onChange={(event) => setMensagem(event.target.value)} placeholder="Conte brevemente o que você procura" rows={4} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500" />

      {feedback ? (
        <div className={`rounded-2xl px-4 py-3 text-sm ${feedback.tone === 'success' ? 'border border-emerald-400/20 bg-emerald-500/10 text-emerald-200' : 'border border-red-400/20 bg-red-500/10 text-red-200'}`}>
          {feedback.text}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={saving}
        className="inline-flex w-full items-center justify-center rounded-2xl bg-teal-400 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? 'Enviando...' : 'Quero atendimento'}
      </button>
    </form>
  );
}
