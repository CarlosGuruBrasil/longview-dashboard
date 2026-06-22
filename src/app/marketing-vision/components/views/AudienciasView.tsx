'use client'

import { useEffect, useState } from 'react'
import { Users, UserCheck, TrendingUp, XCircle, UserMinus, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'
import { useData } from '../../context/DataContext'
import { isOpportunity, isLoss } from '../../utils/leads'
import GlassCard from '../ui/GlassCard'

interface MetaStatusResponse {
  connected: boolean
  accountId?: string
  accountName?: string
  error?: string
}

interface AudienceSegment {
  key: string
  label: string
  description: string
  count: number
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  color: string
}

export default function AudienciasView() {
  const { filteredLeads: allLeads } = useData()
  const [metaStatus, setMetaStatus] = useState<MetaStatusResponse | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [syncingKey, setSyncingKey] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<Record<string, 'success' | 'error'>>({})

  useEffect(() => {
    async function fetchStatus() {
      setStatusLoading(true)
      try {
        const res = await fetch('/api/meta/status')
        if (res.ok) {
          const data = await res.json()
          setMetaStatus(data)
        } else {
          setMetaStatus({ connected: false, error: `HTTP ${res.status}` })
        }
      } catch {
        setMetaStatus({ connected: false, error: 'Não foi possível conectar ao servidor' })
      } finally {
        setStatusLoading(false)
      }
    }
    fetchStatus()
  }, [])

  const segments: AudienceSegment[] = [
    {
      key: 'todos',
      label: 'Todos os Leads',
      description: 'Base completa de leads do CRM para retargeting amplo.',
      count: allLeads.length,
      icon: Users,
      color: '#0ea5e9',
    },
    {
      key: 'visita',
      label: 'Com Visita',
      description: 'Leads que chegaram à etapa de visita agendada ou realizada.',
      count: allLeads.filter(l => (l.situacao?.nome ?? '').toLowerCase().includes('visita')).length,
      icon: UserCheck,
      color: '#10b981',
    },
    {
      key: 'oportunidades',
      label: 'Oportunidades Ativas',
      description: 'Leads com simulação, reserva ou em negociação ativa.',
      count: allLeads.filter(isOpportunity).length,
      icon: TrendingUp,
      color: '#a855f7',
    },
    {
      key: 'perdidos',
      label: 'Leads Perdidos',
      description: 'Leads descartados ou com motivo de cancelamento — ideal para exclusão de audiência.',
      count: allLeads.filter(isLoss).length,
      icon: XCircle,
      color: '#f43f5e',
    },
    {
      key: 'sem_corretor',
      label: 'Sem Corretor',
      description: 'Leads ainda não atribuídos a um corretor — potenciais a reengajar.',
      count: allLeads.filter(l => !l.corretor?.nome).length,
      icon: UserMinus,
      color: '#f59e0b',
    },
  ]

  async function handleSync(segment: AudienceSegment) {
    setSyncingKey(segment.key)
    try {
      const res = await fetch('/api/meta/audiences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment: segment.key }),
      })
      setSyncResult(prev => ({
        ...prev,
        [segment.key]: res.ok ? 'success' : 'error',
      }))
    } catch {
      setSyncResult(prev => ({ ...prev, [segment.key]: 'error' }))
    } finally {
      setSyncingKey(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Meta connection status */}
      <GlassCard title="Status da Integração Meta">
        {statusLoading ? (
          <div className="flex items-center gap-2 py-2">
            <RefreshCw size={14} className="animate-spin opacity-50" style={{ color: 'var(--text-secondary)' }} />
            <span className="text-sm opacity-60" style={{ color: 'var(--text-secondary)' }}>
              Verificando conexão com o Meta...
            </span>
          </div>
        ) : metaStatus?.connected ? (
          <div className="flex items-center gap-3">
            <CheckCircle size={18} style={{ color: '#10b981' }} />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Conectado ao Meta Ads
              </p>
              {(metaStatus.accountName || metaStatus.accountId) && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {metaStatus.accountName ?? metaStatus.accountId}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <AlertCircle size={18} style={{ color: '#f43f5e' }} />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Meta Ads não conectado
              </p>
              {metaStatus?.error && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {metaStatus.error}
                </p>
              )}
            </div>
          </div>
        )}
      </GlassCard>

      {/* Audience segments */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {segments.map(seg => {
          const result = syncResult[seg.key]
          const isSyncing = syncingKey === seg.key
          const Icon = seg.icon

          return (
            <GlassCard key={seg.key}>
              <div className="flex flex-col gap-4">
                {/* Header */}
                <div className="flex items-center gap-3">
                  <div
                    className="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0"
                    style={{ backgroundColor: `${seg.color}22` }}
                  >
                    <Icon size={18} style={{ color: seg.color }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {seg.label}
                    </p>
                  </div>
                </div>

                {/* Count */}
                <div>
                  <p className="text-3xl font-bold tracking-tight" style={{ color: seg.color }}>
                    {seg.count.toLocaleString('pt-BR')}
                  </p>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {seg.description}
                  </p>
                </div>

                {/* Sync button */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSync(seg)}
                    disabled={isSyncing || !metaStatus?.connected}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: `${seg.color}15`,
                      borderColor: `${seg.color}30`,
                      color: seg.color,
                    }}
                  >
                    <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
                    {isSyncing ? 'Sincronizando...' : 'Sincronizar com Meta'}
                  </button>

                  {result === 'success' && (
                    <CheckCircle size={16} style={{ color: '#10b981' }} className="flex-shrink-0" />
                  )}
                  {result === 'error' && (
                    <AlertCircle size={16} style={{ color: '#f43f5e' }} className="flex-shrink-0" />
                  )}
                </div>

                {result === 'success' && (
                  <p className="text-xs -mt-2" style={{ color: '#10b981' }}>
                    Audiência sincronizada com sucesso.
                  </p>
                )}
                {result === 'error' && (
                  <p className="text-xs -mt-2" style={{ color: '#f43f5e' }}>
                    Erro ao sincronizar. Verifique o endpoint /api/meta/audiences.
                  </p>
                )}
              </div>
            </GlassCard>
          )
        })}
      </div>
    </div>
  )
}
