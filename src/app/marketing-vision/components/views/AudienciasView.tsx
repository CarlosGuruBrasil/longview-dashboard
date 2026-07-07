'use client'

import { useEffect, useState } from 'react'
import { Users, UserCheck, TrendingUp, XCircle, UserMinus, RefreshCw, CheckCircle, AlertCircle, Database } from 'lucide-react'
import { useData } from '../../context/DataContext'
import { isOpportunity, isLoss } from '../../utils/leads'
import GlassCard from '../ui/GlassCard'
import DataTable from '../ui/DataTable'
import { formatCurrency, formatNumber } from '../../utils/formatters'


interface MetaStatusResponse {
  // Estrutura real retornada por /api/meta/status
  sync?: { ok?: boolean | null; lastRun?: string | null; nextRun?: string; totalBuyers?: number | null; totalBase?: number | null }
  leads?: { ok?: boolean | null; lastRun?: string | null; nextRun?: string; newLeads?: number; capiSent?: number }
  scores?: { ok?: boolean | null; lastRun?: string | null; nextRun?: string; total?: number; quentes?: number; mornos?: number; frios?: number }
  capi?: { last?: string | null; todayCount?: number; recentEvents?: unknown[] }
  semConexao?: { lastReceived?: string | null; totalDisparos?: number; todayCount?: number }
  audiences?: { id?: string; name?: string; status?: string; count_min?: number; count_max?: number }[]
  // Legado (não vem da API, mas usamos como fallback)
  connected?: boolean
  accountName?: string | null
  accountId?: string | null
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
  const { filteredLeads: allLeads, metaData } = useData()
  const [metaStatus, setMetaStatus] = useState<MetaStatusResponse | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [syncingKey, setSyncingKey] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<Record<string, 'success' | 'error'>>({})
  const [activeTab, setActiveTab] = useState<'dashboard' | 'data'>('dashboard')
  const [dataSubTab, setDataSubTab] = useState<'segments' | 'demographics' | 'regions' | 'devices'>('segments')


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
      {/* Abas Superiores - Estilo Adidas */}
      <div className="flex border-b border-white/10 -mb-px">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
            activeTab === 'dashboard'
              ? 'border-sky-500 text-sky-400 bg-sky-500/10'
              : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
          }`}
        >
          Painel de Sincronização
        </button>
        <button
          onClick={() => setActiveTab('data')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
            activeTab === 'data'
              ? 'border-sky-500 text-sky-400 bg-sky-500/10'
              : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
          }`}
        >
          <Database size={14} /> Tabela de Dados
        </button>
      </div>

      {activeTab === 'dashboard' ? (
        <>
          {/* Meta connection status */}
          <GlassCard title="Status da Integração Meta">
            {statusLoading ? (
              <div className="flex items-center gap-2 py-2">
                <RefreshCw size={14} className="animate-spin opacity-50" style={{ color: '#71717a' }} />
                <span className="text-sm opacity-60" style={{ color: '#71717a' }}>
                  Verificando conexão com o Meta...
                </span>
              </div>
            ) : metaStatus?.connected ? (
              <div className="flex items-center gap-3">
                <CheckCircle size={18} style={{ color: '#10b981' }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: '#e4e4e7' }}>
                    Conectado ao Meta Ads
                  </p>
                  {(metaStatus.accountName || metaStatus.accountId) && (
                    <p className="text-xs mt-0.5" style={{ color: '#71717a' }}>
                      {metaStatus.accountName ?? metaStatus.accountId}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <AlertCircle size={18} style={{ color: '#f43f5e' }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: '#e4e4e7' }}>
                    Meta Ads não conectado
                  </p>
                  {metaStatus?.error && (
                    <p className="text-xs mt-0.5" style={{ color: '#71717a' }}>
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
                        <p className="text-sm font-semibold" style={{ color: '#e4e4e7' }}>
                          {seg.label}
                        </p>
                      </div>
                    </div>

                    {/* Count */}
                    <div>
                      <p className="text-3xl font-bold tracking-tight" style={{ color: seg.color }}>
                        {seg.count.toLocaleString('pt-BR')}
                      </p>
                      <p className="text-xs mt-1 leading-relaxed" style={{ color: '#71717a' }}>
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
        </>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Sub-abas de dados */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {[
              { key: 'segments', label: 'Segmentos de Audiência' },
              { key: 'demographics', label: 'Dados Demográficos (Idade/Gênero)' },
              { key: 'regions', label: 'Desempenho Regional' },
              { key: 'devices', label: 'Plataformas & Dispositivos' },
            ].map(sub => (
              <button
                key={sub.key}
                onClick={() => setDataSubTab(sub.key as any)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all whitespace-nowrap ${
                  dataSubTab === sub.key
                    ? 'bg-white text-zinc-900 border-transparent'
                    : 'bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10'
                }`}
              >
                {sub.label}
              </button>
            ))}
          </div>

          <GlassCard>
            {dataSubTab === 'segments' && (
              <DataTable<any>
                title="Segmentos de Audiência e Retargeting"
                rows={segments.map(s => ({ key: s.key, label: s.label, count: s.count, desc: s.description }))}
                exportFileName="segmentos_audiencia"
                searchFields={['label', 'desc']}
                searchPlaceholder="Buscar segmento..."
                defaultSortField="count"
                columns={[
                  { label: 'Segmento', field: 'label', render: row => <span className="font-semibold text-zinc-100">{row.label}</span> },
                  { label: 'Leads Encontrados', field: 'count', align: 'right', render: row => formatNumber(row.count) },
                  { label: 'Definição e Descrição do Público', field: 'desc' }
                ]}
              />
            )}

            {dataSubTab === 'demographics' && (
              <DataTable<any>
                title="Perfil Demográfico de Público (Meta Ads)"
                rows={metaData?.demographics || []}
                exportFileName="demograficos_audiencia"
                searchFields={['age', 'gender']}
                searchPlaceholder="Buscar idade ou gênero..."
                defaultSortField="impressions"
                columns={[
                  { label: 'Faixa Etária', field: 'age' },
                  { label: 'Gênero', field: 'gender', render: row => row.gender === 'male' ? 'Masculino' : row.gender === 'female' ? 'Feminino' : row.gender || 'Outros' },
                  { label: 'Gasto', field: 'spend', align: 'right', render: row => formatCurrency(Number(row.spend ?? 0)), csvValue: row => String(row.spend ?? 0) },
                  { label: 'Impressões', field: 'impressions', align: 'right', render: row => formatNumber(Number(row.impressions ?? 0)) },
                  { label: 'Cliques', field: 'clicks', align: 'right', render: row => formatNumber(Number(row.clicks ?? 0)) }
                ]}
              />
            )}

            {dataSubTab === 'regions' && (
              <DataTable<any>
                title="Distribuição Geográfica da Audiência"
                rows={metaData?.regions || []}
                exportFileName="regioes_audiencia"
                searchFields={['region']}
                searchPlaceholder="Buscar região..."
                defaultSortField="impressions"
                columns={[
                  { label: 'Estado / Região', field: 'region' },
                  { label: 'Gasto', field: 'spend', align: 'right', render: row => formatCurrency(Number(row.spend ?? 0)), csvValue: row => String(row.spend ?? 0) },
                  { label: 'Impressões', field: 'impressions', align: 'right', render: row => formatNumber(Number(row.impressions ?? 0)) },
                  { label: 'Cliques', field: 'clicks', align: 'right', render: row => formatNumber(Number(row.clicks ?? 0)) }
                ]}
              />
            )}

            {dataSubTab === 'devices' && (
              <DataTable<any>
                title="Desempenho por Dispositivo de Acesso"
                rows={metaData?.devices || []}
                exportFileName="dispositivos_audiencia"
                searchFields={['device_platform']}
                searchPlaceholder="Buscar dispositivo..."
                defaultSortField="impressions"
                columns={[
                  { label: 'Dispositivo / Plataforma', field: 'device_platform', render: row => <span className="capitalize">{row.device_platform}</span> },
                  { label: 'Gasto', field: 'spend', align: 'right', render: row => formatCurrency(Number(row.spend ?? 0)), csvValue: row => String(row.spend ?? 0) },
                  { label: 'Impressões', field: 'impressions', align: 'right', render: row => formatNumber(Number(row.impressions ?? 0)) },
                  { label: 'Cliques', field: 'clicks', align: 'right', render: row => formatNumber(Number(row.clicks ?? 0)) }
                ]}
              />
            )}
          </GlassCard>
        </div>
      )}
    </div>
  )
}
