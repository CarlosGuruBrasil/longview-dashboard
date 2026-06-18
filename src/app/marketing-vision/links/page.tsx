'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { ArrowLeft, Link2, Copy, Check, Trash2, Plus, Loader2, ExternalLink, MousePointerClick, QrCode, Download, X } from 'lucide-react';

interface LinkItem {
  slug: string;
  url: string;
  title: string;
  active: boolean;
  createdAt: string;
  createdBy: string;
  clicks: number;
}

export default function LinksPage() {
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [slug, setSlug] = useState('');
  const [wantQr, setWantQr] = useState(true);

  // Modal do QR Code
  const [qrFor, setQrFor] = useState<LinkItem | null>(null);
  const [qrData, setQrData] = useState('');

  useEffect(() => { setOrigin(window.location.origin); load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/links');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar links.');
      setLinks(data.links || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const shortUrlOf = (s: string) => `${origin}/l/${s}`;

  // Gera o PNG do QR (1024px p/ impressão) a partir do link curto — sempre o mesmo
  // valor, por isso o QR é "dinâmico": o destino muda no servidor sem reimprimir.
  async function openQr(item: LinkItem) {
    const dataUrl = await QRCode.toDataURL(shortUrlOf(item.slug), { width: 1024, margin: 2 });
    setQrData(dataUrl);
    setQrFor(item);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, url, slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao criar link.');
      setTitle(''); setUrl(''); setSlug('');
      setLinks(prev => [data.link, ...prev]);
      if (wantQr) openQr(data.link); // pergunta respondida via checkbox: já abre o QR
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggle(item: LinkItem) {
    setLinks(prev => prev.map(l => l.slug === item.slug ? { ...l, active: !l.active } : l));
    await fetch('/api/links', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: item.slug, active: !item.active }),
    });
  }

  async function remove(item: LinkItem) {
    if (!confirm(`Excluir o link "${item.title}"? Os acessos registrados serão perdidos.`)) return;
    setLinks(prev => prev.filter(l => l.slug !== item.slug));
    await fetch(`/api/links?slug=${encodeURIComponent(item.slug)}`, { method: 'DELETE' });
  }

  function copy(text: string, slug: string) {
    navigator.clipboard.writeText(text);
    setCopied(slug);
    setTimeout(() => setCopied(null), 1500);
  }

  const totalClicks = links.reduce((s, l) => s + l.clicks, 0);

  const card: React.CSSProperties = { background: '#121214', border: '1px solid #1E1E22', borderRadius: 12 };
  const input: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 8, background: '#09090b', border: '1px solid #27272a', color: '#e5e5e5', fontSize: 14, outline: 'none' };
  const label: React.CSSProperties = { display: 'block', fontSize: 12, color: '#a1a1aa', marginBottom: 6, fontWeight: 600 };

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', color: '#e5e5e5', padding: '28px 20px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <a href="/marketing-vision" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#71717a', textDecoration: 'none', fontSize: 13 }}>
              <ArrowLeft size={16} /> Voltar
            </a>
            <div style={{ width: 1, height: 22, background: '#27272a' }} />
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 20, fontWeight: 700, margin: 0 }}>
              <Link2 size={20} color="#0ea5e9" /> Links, QR &amp; Acessos
            </h1>
          </div>
          <div style={{ ...card, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <MousePointerClick size={16} color="#0ea5e9" />
            <span style={{ fontSize: 13, color: '#a1a1aa' }}>Total de acessos:</span>
            <strong style={{ fontSize: 15 }}>{totalClicks}</strong>
          </div>
        </div>

        {/* Form de criação */}
        <form onSubmit={create} style={{ ...card, padding: 20, marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={label}>Título / identificação *</label>
              <input style={input} value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex.: WhatsApp Hub Beira Mar" required />
            </div>
            <div>
              <label style={label}>Atalho personalizado (opcional)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, color: '#52525b', whiteSpace: 'nowrap' }}>/l/</span>
                <input style={input} value={slug} onChange={e => setSlug(e.target.value)} placeholder="hub-beira-mar (gera automático se vazio)" />
              </div>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={label}>URL de destino *</label>
            <input style={input} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://wa.me/55..." type="url" required />
          </div>
          {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{error}</p>}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <button type="submit" disabled={submitting} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 8, background: '#0ea5e9', color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.6 : 1 }}>
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Criar link
            </button>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#d4d4d8', cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={wantQr} onChange={e => setWantQr(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#0ea5e9' }} />
              <QrCode size={15} /> Gerar QR Code ao criar
            </label>
          </div>
        </form>

        {/* Lista */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40, color: '#71717a' }}>
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : links.length === 0 ? (
          <div style={{ ...card, padding: 40, textAlign: 'center', color: '#71717a' }}>
            Nenhum link criado ainda. Crie o primeiro acima.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {links.map(item => (
              <div key={item.slug} style={{ ...card, padding: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', opacity: item.active ? 1 : 0.55 }}>
                <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{item.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <code style={{ fontSize: 13, color: '#0ea5e9' }}>/l/{item.slug}</code>
                    <button onClick={() => copy(shortUrlOf(item.slug), item.slug)} title="Copiar URL curta" style={{ background: 'none', border: 'none', color: copied === item.slug ? '#34d399' : '#71717a', cursor: 'pointer', display: 'flex' }}>
                      {copied === item.slug ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                  <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#52525b', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <ExternalLink size={11} /> {item.url}
                  </a>
                </div>

                <div style={{ textAlign: 'center', minWidth: 70 }}>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{item.clicks}</div>
                  <div style={{ fontSize: 11, color: '#71717a' }}>acessos</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button onClick={() => openQr(item)} title="QR Code" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', border: '1px solid rgba(14,165,233,0.4)', background: 'transparent', color: '#0ea5e9' }}>
                    <QrCode size={14} /> QR
                  </button>
                  <button onClick={() => toggle(item)} title={item.active ? 'Desativar' : 'Ativar'} style={{ fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 999, cursor: 'pointer', border: '1px solid', background: 'transparent', borderColor: item.active ? 'rgba(16,185,129,0.4)' : 'rgba(113,113,122,0.4)', color: item.active ? '#34d399' : '#a1a1aa' }}>
                    {item.active ? 'Ativo' : 'Inativo'}
                  </button>
                  <button onClick={() => remove(item)} title="Excluir" style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', display: 'flex' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal do QR Code */}
      {qrFor && (
        <div onClick={() => setQrFor(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ ...card, padding: 24, width: 320, maxWidth: '100%', textAlign: 'center', position: 'relative' }}>
            <button onClick={() => setQrFor(null)} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: '#71717a', cursor: 'pointer' }}>
              <X size={18} />
            </button>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>{qrFor.title}</h3>
            <p style={{ fontSize: 12, color: '#71717a', margin: '0 0 16px', wordBreak: 'break-all' }}>{shortUrlOf(qrFor.slug)}</p>
            {qrData
              ? <img src={qrData} alt="QR Code" style={{ width: 220, height: 220, background: '#fff', borderRadius: 8, padding: 8 }} />
              : <Loader2 size={22} className="animate-spin" />}
            <a href={qrData} download={`qr-${qrFor.slug}.png`} style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 8, background: '#0ea5e9', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>
              <Download size={16} /> Baixar QR Code
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
