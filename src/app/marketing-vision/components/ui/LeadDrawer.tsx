'use client';

import { useEffect, useState } from 'react';
import type { Lead } from '../../types';
import { getOrigin, getStatusColor, getLeadTags, getLeadSource } from '../../utils/leads';
import { formatDate } from '../../utils/formatters';

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

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

export default function LeadDrawer({ lead, onClose }: Props) {
  const [history, setHistory] = useState<StageChange[] | null>(null);
  const [fullLead, setFullLead] = useState<Lead | null>(null);
  const [loadingLead, setLoadingLead] = useState(false);

  // Busca os dados completos do lead (incluindo interações) assincronamente
  useEffect(() => {
    const leadId = lead?.idlead ?? lead?.id;

    const timer = window.setTimeout(() => {
      if (!lead) {
        setFullLead(null);
        setLoadingLead(false);
        return;
      }
      if (!leadId) return;

      setFullLead(lead);
      setLoadingLead(true);
    }, 0);

    let active = true;

    if (leadId) {
      fetch(`/api/leads/${leadId}`)
        .then((r) => r.json())
        .then((d) => {
          if (active && d.ok && d.lead) {
            setFullLead(d.lead);
          }
        })
        .catch(console.error)
        .finally(() => {
          if (active) setLoadingLead(false);
        });
    }

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [lead]);

  // Busca o histórico de movimentação do lead
  useEffect(() => {
    const leadId = lead?.idlead ?? lead?.id;
    if (!lead || !leadId) return;

    const timer = window.setTimeout(() => setHistory(null), 0);
    let active = true;

    fetch(`/api/leads/${leadId}/history`)
      .then((r) => r.json())
      .then((d) => { if (active) setHistory(d.history ?? []); })
      .catch(() => { if (active) setHistory([]); });

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [lead]);

  // Fecha no ESC
  useEffect(() => {
    if (!lead) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [lead, onClose]);

  const activeLead = fullLead || lead;
  if (!activeLead) return null;

  const id = activeLead.idlead ?? activeLead.id;
  const crmUrl = id ? `https://longviewempreendimentos.cvcrm.com.br/gestor/comercial/leads/${id}/detalhes` : undefined;
  const sc = getStatusColor(activeLead);
  const tags = getLeadTags(activeLead);
  const interacoes = activeLead.interacao ?? [];
  const source = getLeadSource(activeLead);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div
        className="w-full max-w-md h-full overflow-y-auto border-l border-white/10 flex flex-col gap-5 p-5"
        style={{ backgroundColor: 'var(--surface-elevated, #111)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5 min-w-0">
            <h2 className="text-lg font-bold truncate" style={{ color: 'var(--text-primary)' }}>{activeLead.nome || 'Lead'}</h2>
            {activeLead.situacao?.nome && (
              <span className="self-start text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: sc.bg, color: sc.text }}>
                {activeLead.situacao.nome}
              </span>
            )}
          </div>
          <button onClick={onClose} className="shrink-0 w-8 h-8 rounded-full border border-white/12 text-zinc-400 hover:bg-white/10">✕</button>
        </div>

        {/* Panorama */}
        <section className="grid grid-cols-2 gap-3">
          <Field label="E-mail" value={activeLead.email} />
          <Field label="Telefone" value={activeLead.telefone || activeLead.celular} />
          <Field label="Origem" value={getOrigin(activeLead)} />
          <Field label="Temperatura" value={activeLead.temperatura} />
          <Field label="Corretor" value={activeLead.corretor?.nome} />
          <Field label="Gestor" value={activeLead.gestor?.nome} />
          <Field label="Imobiliária" value={activeLead.imobiliaria?.nome} />
          <Field label="Empreendimento" value={activeLead.empreendimento?.map((e) => e.nome).join(', ')} />
          <Field label="Cidade" value={activeLead.cidade} />
          <Field label="Score" value={activeLead.score} />
          <Field label="Cadastro" value={formatDate(activeLead.data_cad || activeLead.data_cadastro || activeLead.data_cadastramento)} />
          <Field label="Reservas" value={activeLead.qtde_reservas_associadas} />
        </section>

        {/* Origem do cadastro */}
        <section className="flex flex-col gap-1.5 rounded-lg border border-white/10 p-3">
          <div className="flex items-center gap-2">
            <span
              className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={source.type === 'manual'
                ? { backgroundColor: 'rgba(245,158,11,0.15)', color: '#fbbf24' }
                : { backgroundColor: 'rgba(14,165,233,0.15)', color: '#38bdf8' }}
            >
              {source.type === 'manual' ? 'Cadastro manual' : 'Integração'}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{source.channel}</span>
          </div>
          {source.type === 'manual' && (
            <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
              Cadastrado por: <strong>{source.by ?? 'não identificado'}</strong>
            </span>
          )}
          {source.mediaBroken && (
            <span className="text-[11px]" style={{ color: '#f87171' }}>
              ⚠ Mídia veio como macro não substituída (ex: {'{{adset.name}}'}) — corrigir na integração Meta→CV CRM.
            </span>
          )}
        </section>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((t) => (
              <span key={t} className="px-2 py-0.5 rounded text-[11px] bg-white/10" style={{ color: 'var(--text-secondary)' }}>{t}</span>
            ))}
          </div>
        )}

        {/* Movimentação de etapa */}
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Movimentação de etapa</h3>
          {history === null ? (
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Carregando…</p>
          ) : history.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Nenhuma movimentação registrada ainda.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {history.map((h, i) => (
                <li key={i} className="text-xs flex flex-col gap-0.5 border-l-2 border-white/15 pl-3">
                  <span style={{ color: 'var(--text-primary)' }}>{h.de ? `${h.de} → ` : ''}<strong>{h.para}</strong></span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {new Date(h.changed_at).toLocaleString('pt-BR')}
                  </span>
                  {(h.corretor || h.gestor) && (
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Atendido por: {h.corretor ?? '—'}{h.gestor ? ` (gestor: ${h.gestor})` : ''}
                    </span>
                  )}
                  {h.autor && (
                    <span style={{ color: 'var(--text-secondary)' }}>Alterado por: {h.autor}</span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Interações */}
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Interações</h3>
          {loadingLead ? (
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Carregando interações…</p>
          ) : interacoes.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Sem interações registradas.</p>
          ) : (
            <ol className="flex flex-col gap-1.5">
              {interacoes.map((it, i) => (
                <li key={i} className="text-xs flex justify-between gap-2 border-b border-white/5 pb-1">
                  <span style={{ color: 'var(--text-primary)' }}>{it.tipo || 'Interação'}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{formatDate(it.data_cad)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* CV CRM */}
        {crmUrl && (
          <a
            href={crmUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto w-full h-11 rounded-full bg-white text-zinc-900 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-white/90"
          >
            Abrir no CV CRM ↗
          </a>
        )}
      </div>
    </div>
  );
}
