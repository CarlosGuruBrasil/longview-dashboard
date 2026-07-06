'use client'

import { useState, useEffect } from 'react'
import {
  Zap, Plus, CheckCircle2, AlertCircle, Clock, Trash2,
  X, ChevronRight, ExternalLink, Copy, Eye, EyeOff, RefreshCw
} from 'lucide-react'
import type { Integration, IntegrationPlatform, IntegrationStatus } from '../../types'

// ── Platform catalog ──────────────────────────────────────────────────────────

interface PlatformCatalog {
  platform: IntegrationPlatform
  name: string
  description: string
  color: string
  logo: string // emoji fallback
  docsUrl: string
  fields: Array<{ key: string; label: string; type: 'text' | 'password'; placeholder: string; helpText: string }>
  steps: Array<{ step: number; title: string; description: string }>
}

const PLATFORMS: PlatformCatalog[] = [
  {
    platform: 'meta',
    name: 'Meta Ads',
    description: 'Facebook & Instagram Ads — campanhas, criativos e leads',
    color: '#1877f2', logo: '📘',
    docsUrl: 'https://developers.facebook.com/docs/marketing-api/',
    fields: [
      { key: 'apiToken', label: 'Access Token', type: 'password', placeholder: 'EAABsB...', helpText: 'Token de acesso do Meta Business Manager' },
      { key: 'accountId', label: 'ID da Conta de Anúncios', type: 'text', placeholder: 'act_1234567890', helpText: 'Encontre em Gerenciador de Anúncios > Configurações' },
    ],
    steps: [
      { step: 1, title: 'Acesse o Meta Business Manager', description: 'Entre em business.facebook.com e selecione sua conta.' },
      { step: 2, title: 'Vá em Configurações > Contas de Anúncios', description: 'Copie o ID da sua conta (ex: 1234567890).' },
      { step: 3, title: 'Gere um Token de Acesso', description: 'Vá em Ferramentas > Explorador de API do Graph. Selecione o app e gere o token com permissões ads_read, ads_management e leads_retrieval.' },
      { step: 4, title: 'Cole aqui e salve', description: 'Cole o token e o ID da conta nos campos ao lado e clique em Conectar.' },
    ],
  },
  {
    platform: 'google_ads',
    name: 'Google Ads',
    description: 'Campanhas de pesquisa, display e YouTube',
    color: '#4285f4', logo: '🟦',
    docsUrl: 'https://developers.google.com/google-ads/api/docs/start',
    fields: [
      { key: 'apiKey', label: 'Developer Token', type: 'password', placeholder: 'XXXXX-XXXXX-XXXXX', helpText: 'Encontre em Google Ads API Center' },
      { key: 'accountId', label: 'Customer ID', type: 'text', placeholder: '123-456-7890', helpText: 'ID da conta Google Ads (formato XXX-XXX-XXXX)' },
    ],
    steps: [
      { step: 1, title: 'Acesse o Google Ads API Center', description: 'Vá em ads.google.com > Ferramentas > API do Google Ads.' },
      { step: 2, title: 'Solicite um Developer Token', description: 'Se ainda não possui, solicite acesso básico.' },
      { step: 3, title: 'Copie o Customer ID', description: 'O ID de 10 dígitos aparece no topo direito da interface do Google Ads.' },
      { step: 4, title: 'Configure OAuth 2.0', description: 'Gere as credenciais de OAuth para autenticação server-to-server.' },
    ],
  },
  {
    platform: 'google_business',
    name: 'Google Meu Negócio',
    description: 'Avaliações, localização e engajamento local',
    color: '#34a853', logo: '📍',
    docsUrl: 'https://developers.google.com/my-business',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'AIza...', helpText: 'Chave da Google Cloud Console' },
      { key: 'accountId', label: 'ID do Local', type: 'text', placeholder: 'accounts/xxx/locations/yyy', helpText: 'ID do local no Google Business Profile' },
    ],
    steps: [
      { step: 1, title: 'Acesse o Google Cloud Console', description: 'Vá em console.cloud.google.com e crie um projeto.' },
      { step: 2, title: 'Ative a Business Profile API', description: 'Busque por "Business Profile API" e ative.' },
      { step: 3, title: 'Crie uma Chave de API', description: 'Em Credenciais, clique em + Criar Credencial > Chave de API.' },
      { step: 4, title: 'Copie o ID do seu local', description: 'Acesse business.google.com, selecione o local e copie o ID da URL.' },
    ],
  },
  {
    platform: 'rd_station',
    name: 'RD Station',
    description: 'CRM e automação de marketing',
    color: '#00b4d8', logo: '📊',
    docsUrl: 'https://developers.rdstation.com/',
    fields: [
      { key: 'apiToken', label: 'Token de API', type: 'password', placeholder: 'RD-xxx-xxx', helpText: 'Encontre em Configurações > Integrações > API' },
    ],
    steps: [
      { step: 1, title: 'Acesse o RD Station Marketing', description: 'Vá em app.rdstation.com.br.' },
      { step: 2, title: 'Abra Configurações > Integrações', description: 'No menu lateral, clique em "Integrações".' },
      { step: 3, title: 'Acesse a seção API', description: 'Copie o token de API gerado para sua conta.' },
    ],
  },
]

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CFG: Record<IntegrationStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  connected:    { label: 'Conectada',  color: '#10b981', bg: 'rgba(16,185,129,0.1)',  icon: CheckCircle2 },
  error:        { label: 'Erro',       color: '#f43f5e', bg: 'rgba(244,63,94,0.1)',   icon: AlertCircle  },
  disconnected: { label: 'Desconectada', color: '#71717a', bg: 'rgba(113,113,122,0.1)', icon: AlertCircle },
  pending:      { label: 'Pendente',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  icon: Clock        },
}

function StatusBadge({ status }: { status: IntegrationStatus }) {
  const cfg = STATUS_CFG[status]
  const Icon = cfg.icon
  return (
    <span className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}>
      <Icon size={11} /> {cfg.label}
    </span>
  )
}

// ── Connection Panel ──────────────────────────────────────────────────────────

function ConnectPanel({
  catalog,
  onClose,
  onSave,
}: {
  catalog: PlatformCatalog
  onClose: () => void
  onSave: (data: Record<string, string>) => Promise<void>
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [visible, setVisible] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  function copy(val: string, key: string) {
    void navigator.clipboard.writeText(val)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  async function handleSave() {
    setSaving(true)
    try { await onSave(values) } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-2xl sm:rounded-3xl bg-[#0f0f12] border border-white/[0.09] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07]">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{catalog.logo}</span>
            <div>
              <h3 className="text-base font-bold text-zinc-100">Conectar {catalog.name}</h3>
              <p className="text-xs text-zinc-500">{catalog.description}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-600 transition-all">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-6">
          {/* Instruções passo a passo */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Zap size={14} className="text-orange-400" />
              <p className="text-sm font-bold text-zinc-200">Como obter as credenciais</p>
              <a href={catalog.docsUrl} target="_blank" rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300">
                Documentação <ExternalLink size={10} />
              </a>
            </div>
            <div className="flex flex-col gap-3">
              {catalog.steps.map(s => (
                <div key={s.step} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-black"
                    style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316' }}>
                    {s.step}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-300">{s.title}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{s.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Campos de credencial */}
          <div className="flex flex-col gap-3">
            <p className="text-sm font-bold text-zinc-200">Credenciais</p>
            {catalog.fields.map(f => (
              <div key={f.key} className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400">{f.label}</label>
                <div className="relative">
                  <input
                    type={f.type === 'password' && !visible[f.key] ? 'password' : 'text'}
                    placeholder={f.placeholder}
                    value={values[f.key] ?? ''}
                    onChange={e => setValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="w-full h-10 px-4 pr-16 text-sm bg-white/[0.04] border border-white/[0.1] rounded-xl text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-orange-500/40 focus:bg-white/[0.06] transition-all"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {f.type === 'password' && (
                      <button onClick={() => setVisible(v => ({ ...v, [f.key]: !v[f.key] }))}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-600 hover:text-zinc-400 transition-all">
                        {visible[f.key] ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    )}
                    {values[f.key] && (
                      <button onClick={() => copy(values[f.key], f.key)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-600 hover:text-zinc-400 transition-all">
                        {copied === f.key ? <CheckCircle2 size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-zinc-600">{f.helpText}</p>
              </div>
            ))}
          </div>

          {/* Botões */}
          <div className="flex items-center gap-3 pb-1">
            <button onClick={onClose}
              className="flex-1 h-10 rounded-xl border border-white/[0.08] bg-white/[0.02] text-zinc-400 text-sm font-semibold hover:bg-white/[0.05] transition-all">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 h-10 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
              style={{ background: `linear-gradient(135deg, ${catalog.color}, ${catalog.color}cc)` }}>
              {saving ? 'Conectando…' : `Conectar ${catalog.name}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function HubIntegracoesView() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [connectingPlatform, setConnectingPlatform] = useState<PlatformCatalog | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/integrations')
      const data = await res.json() as { integrations?: Integration[] }
      setIntegrations(data.integrations ?? [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  async function handleSave(catalog: PlatformCatalog, values: Record<string, string>) {
    await fetch('/api/integrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: catalog.platform,
        name: catalog.name,
        apiKey: values.apiKey,
        apiToken: values.apiToken,
        accountId: values.accountId,
      }),
    })
    setConnectingPlatform(null)
    await load()
  }

  async function handleDelete(id: string) {
    if (id.startsWith('env-')) return // não remove as configuradas via env
    setDeletingId(id)
    await fetch(`/api/integrations?id=${id}`, { method: 'DELETE' })
    await load()
    setDeletingId(null)
  }

  const connectedPlatforms = new Set(integrations.map(i => i.platform))

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Zap size={18} className="text-orange-400" />
            Hub de Integrações
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Gerencie as conexões com plataformas de anúncios e redes sociais
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 h-9 px-4 rounded-full text-xs font-medium border border-white/[0.07] bg-white/[0.02] text-zinc-400 hover:text-zinc-100 transition-all disabled:opacity-50">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {/* Integrações ativas */}
      {integrations.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Conectadas</p>
          {integrations.map(integration => {
            const catalog = PLATFORMS.find(p => p.platform === integration.platform)
            const isEnv = integration.id.startsWith('env-')
            return (
              <div key={integration.id} className="flex items-center gap-4 p-4 bg-white/[0.02] border border-white/[0.07] rounded-2xl hover:bg-white/[0.04] transition-all">
                <span className="text-2xl shrink-0">{catalog?.logo ?? '🔌'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-zinc-100">{integration.name}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {integration.accountName && (
                      <span className="text-[11px] text-zinc-500">{integration.accountName}</span>
                    )}
                    {integration.lastSync && (
                      <span className="text-[10px] text-zinc-700">· Última sync: {new Date(integration.lastSync).toLocaleDateString('pt-BR')}</span>
                    )}
                    {isEnv && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-500">via variável de ambiente</span>
                    )}
                  </div>
                </div>
                <StatusBadge status={integration.status} />
                {!isEnv && (
                  <button
                    onClick={() => void handleDelete(integration.id)}
                    disabled={deletingId === integration.id}
                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-500/5 border border-red-500/15 text-red-500/60 hover:bg-red-500/15 hover:text-red-400 transition-all disabled:opacity-50">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Catálogo de plataformas */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
          {integrations.length > 0 ? 'Adicionar mais plataformas' : 'Plataformas disponíveis'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PLATFORMS.map(catalog => {
            const isConnected = connectedPlatforms.has(catalog.platform)
            return (
              <div key={catalog.platform}
                className="flex items-center gap-4 p-4 bg-white/[0.02] border border-white/[0.07] rounded-2xl hover:bg-white/[0.04] transition-all">
                <span className="text-2xl shrink-0">{catalog.logo}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-zinc-100">{catalog.name}</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5 leading-tight">{catalog.description}</p>
                </div>
                {isConnected ? (
                  <span className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400">
                    <CheckCircle2 size={11} /> Ativa
                  </span>
                ) : (
                  <button
                    onClick={() => setConnectingPlatform(catalog)}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-bold border border-white/[0.1] bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08] transition-all shrink-0">
                    <Plus size={12} /> Conectar
                  </button>
                )}
                <ChevronRight size={14} className="text-zinc-700 shrink-0" />
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal de conexão */}
      {connectingPlatform && (
        <ConnectPanel
          catalog={connectingPlatform}
          onClose={() => setConnectingPlatform(null)}
          onSave={(values) => handleSave(connectingPlatform, values)}
        />
      )}
    </div>
  )
}
