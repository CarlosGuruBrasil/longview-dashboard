'use client'

import { useEffect, useMemo, useState } from 'react'
import { useData } from '../../context/DataContext'
import GlassCard from '../ui/GlassCard'
import FunnelVisualization from '../ui/FunnelVisualization'
import LeadsTable from '../ui/LeadsTable'
import GrowthLineChart from '../charts/GrowthLineChart'
import PieDonutChart from '../charts/PieDonutChart'
import FilterBar from '../ui/FilterBar'
import { getOrigin } from '../../utils/leads'

type SubTab = 'crm' | 'meta-validation' | 'score'

type OrphanedLead = { id: string; name?: string; email?: string; phone?: string; formName?: string; createdTime: string }

export default function LeadsView() {
  const { 
    allLeads,
    filteredLeads, 
    metaData, 
    metaValidation, 
    loading, 
    refresh,
    detailedLeads,
    detailedPage,
    detailedLimit,
    detailedTotal,
    detailedLoading,
    fetchDetailedLeads
  } = useData()
  const [activeTab, setActiveTab] = useState<SubTab>('crm')
  const [growthMode, setGrowthMode] = useState<'day' | 'month'>('day')
  const [syncing, setSyncing] = useState(false)

  // Paginação local do frontend para responder reativamente aos filtros globais/locais
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 50

  const paginatedLeads = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage
    return filteredLeads.slice(startIdx, startIdx + itemsPerPage)
  }, [filteredLeads, currentPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [filteredLeads])

  // Filtros locais independentes para o Gráfico de Crescimento
  const [growthStart, setGrowthStart] = useState('')
  const [growthEnd, setGrowthEnd]     = useState('')

  const growthFilteredLeads = useMemo(() => {
    let result = allLeads
    if (growthStart || growthEnd) {
      result = result.filter(l => {
        const raw = l.data_cad || l.data_cadastro || l.data_cadastramento
        if (!raw) return false
        const d = String(raw).trim().split(' ')[0].split('T')[0]
        if (growthStart && d < growthStart) return false
        if (growthEnd && d > growthEnd) return false
        return true
      })
    }
    return result
  }, [allLeads, growthStart, growthEnd])

  const growthFilteredDaily = useMemo(() => {
    let result = metaData?.daily ?? []
    if (growthStart || growthEnd) {
      result = result.filter(d => {
        if (!d.date_start) return false
        if (growthStart && d.date_start < growthStart) return false
        if (growthEnd && d.date_start > growthEnd) return false
        return true
      })
    }
    return result
  }, [metaData?.daily, growthStart, growthEnd])

  const sourcesPerformance = useMemo(() => {
    const map = new Map<string, { count: number; spend: number }>()
    const totalMetaSpend = growthFilteredDaily.reduce((sum, d) => sum + (parseFloat(d.spend || '0') || 0), 0)

    growthFilteredLeads.forEach(lead => {
      const orig = getOrigin(lead)
      const existing = map.get(orig) ?? { count: 0, spend: 0 }
      existing.count += 1
      map.set(orig, existing)
    })

    const META_KEYWORDS = ['facebook', 'instagram', 'meta', 'ads', 'anúncio', 'midia paga']
    const isMetaSource = (name: string) => META_KEYWORDS.some(kw => name.toLowerCase().includes(kw))

    const metaSources = Array.from(map.keys()).filter(isMetaSource)
    const metaLeadsCount = metaSources.reduce((sum, k) => sum + (map.get(k)?.count ?? 0), 0)

    if (metaLeadsCount > 0) {
      metaSources.forEach(k => {
        const entry = map.get(k)!
        entry.spend = (entry.count / metaLeadsCount) * totalMetaSpend
      })
    }

    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        leads: data.count,
        spend: data.spend,
        cpl: data.count > 0 ? data.spend / data.count : 0,
      }))
      .sort((a, b) => b.leads - a.leads)
  }, [growthFilteredLeads, growthFilteredDaily])

  const handleSyncOrphans = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/meta/sync-orphans', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro na sincronização')
      alert(`Sucesso! ${data.leads_sincronizados} leads órfãos foram integrados no CV CRM e localmente.`)
      refresh(true, undefined, { validateMeta: true })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Falha ao sincronizar: ${msg}`)
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'meta-validation' && !metaValidation && !loading) {
      refresh(false, undefined, { validateMeta: true })
    }
  }, [activeTab, loading, metaValidation, refresh])

  // Chart: Top 7 Origens (dados reais — campo midia_principal/origem da API)
  const origensData = useMemo(() => {
    const map = new Map<string, number>()
    for (const lead of filteredLeads) {
      const origem = getOrigin(lead)
      map.set(origem, (map.get(origem) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7)
  }, [filteredLeads])

  // Chart: Top 5 Cidades (campo cidade da API — mais preenchido que gênero/estado civil)
  const cidadesData = useMemo(() => {
    const map = new Map<string, number>()
    for (const lead of filteredLeads) {
      const cidade = lead.cidade?.trim()
      if (cidade) map.set(cidade, (map.get(cidade) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  }, [filteredLeads])

  // Chart: Temperatura dos leads (quente/morno/frio — dado qualitativo do corretor)
  const temperaturaData = useMemo(() => {
    const map = new Map<string, number>()
    for (const lead of filteredLeads) {
      const temp = lead.temperatura?.trim() || 'Não informado'
      map.set(temp, (map.get(temp) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .filter(d => d.name !== 'Não informado' || d.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [filteredLeads])

  return (
    <div className="flex flex-col gap-6">
      {/* Sub-tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-0">
        {(['crm', 'meta-validation', 'score'] as SubTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-sky-500 text-sky-400 bg-sky-500/10'
                : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
            }`}
          >
            {tab === 'crm' ? 'Leads CRM' : tab === 'meta-validation' ? 'Validação Meta' : 'Score'}
          </button>
        ))}
      </div>

      {activeTab === 'crm' && (
        <div className="flex flex-col gap-6">
          {/* Filters */}
          <FilterBar />

          {/* Funil por etapa */}
          <GlassCard>
            <FunnelVisualization leads={filteredLeads} />
          </GlassCard>

          {/* ── CARD DE CRESCIMENTO COM FILTROS INDEPENDENTES ── */}
          <div className="bg-[#121214] border border-white/10 rounded-2xl p-4 sm:p-6 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white">Crescimento de Leads</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Comparativo do fluxo de entrada ao longo do tempo</p>
              </div>

              {/* Filtros de data locais e independentes */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-white/[0.02] border border-white/10 rounded-xl px-2.5 py-1 text-xs">
                  <span className="text-[10px] text-zinc-500">De</span>
                  <input
                    type="date"
                    value={growthStart}
                    onChange={e => setGrowthStart(e.target.value)}
                    className="bg-transparent text-zinc-300 focus:outline-none focus:border-transparent text-[11px] h-6 cursor-pointer"
                  />
                  <span className="text-[10px] text-zinc-500 ml-1">Até</span>
                  <input
                    type="date"
                    value={growthEnd}
                    onChange={e => setGrowthEnd(e.target.value)}
                    className="bg-transparent text-zinc-300 focus:outline-none focus:border-transparent text-[11px] h-6 cursor-pointer"
                  />
                </div>
                {/* Botão limpar filtro local */}
                {(growthStart || growthEnd) && (
                  <button
                    onClick={() => { setGrowthStart(''); setGrowthEnd('') }}
                    className="text-[10px] text-zinc-400 hover:text-orange-400 font-semibold px-2 py-1 bg-white/5 rounded-lg border border-white/10 transition-all"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>

            {/* Gráfico de crescimento real */}
            <GrowthLineChart
              leads={growthFilteredLeads}
              daily={growthFilteredDaily}
              mode={growthMode}
              onModeChange={setGrowthMode}
            />
          </div>

          {/* ── SEÇÃO DE FONTES & INVESTIMENTO DETALHADO (SUBSTITUI CIDADES/TEMPERATURA) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie Chart de Origens */}
            <PieDonutChart
              title="Origem dos Leads"
              data={origensData.length > 0 ? origensData : [{ name: 'Sem dados', value: 1 }]}
              height={280}
            />

            {/* Tabela de Investimento por Fonte */}
            <GlassCard title="Investimento & leads por Fonte (Período Crescimento)">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-zinc-400 font-semibold">
                      <th className="text-left py-2 px-3">Fonte / Mídia</th>
                      <th className="text-right py-2 px-3">Leads Gerados</th>
                      <th className="text-right py-2 px-3">Investimento</th>
                      <th className="text-right py-2 px-3">CPL Médio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sourcesPerformance.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-zinc-500">Sem dados para exibir no período selecionado.</td>
                      </tr>
                    ) : (
                      sourcesPerformance.map((source, i) => (
                        <tr key={source.name} className="border-b border-white/[0.03] hover:bg-white/[0.01]">
                          <td className="py-2.5 px-3 font-semibold text-zinc-200">{source.name}</td>
                          <td className="py-2.5 px-3 text-right text-zinc-300 font-mono">{source.leads}</td>
                          <td className="py-2.5 px-3 text-right text-amber-400 font-mono font-semibold">
                            {source.spend > 0 ? source.spend.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right text-emerald-400 font-mono font-semibold">
                            {source.spend > 0 ? source.cpl.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </div>

          {/* Leads table */}
          <LeadsTable 
            leads={paginatedLeads} 
            page={currentPage}
            limit={itemsPerPage}
            total={filteredLeads.length}
            loading={loading}
            onPageChange={(page) => setCurrentPage(page)}
            allLeadsForDropdowns={allLeads}
          />
        </div>
      )}

      {activeTab === 'meta-validation' && (
        <div className="flex flex-col gap-6">
          <GlassCard title="Validação de Integração de Leads (Meta Ads × CV CRM)">
            <p className="text-sm leading-relaxed text-zinc-400 max-w-4xl">
              Esta ferramenta compara em tempo real os contatos captados nos formulários ativos de campanhas de Meta Ads (Facebook e Instagram) com os leads cadastrados no CV CRM. Se o e-mail ou o telefone do lead captado no Meta não estiver cadastrado no CRM, ele será listado abaixo como uma inconsistência.
            </p>
          </GlassCard>

          {/* Ações de Sincronização de Leads Órfãos */}
          {metaValidation && metaValidation.orphanedLeads?.length > 0 && (
            <div className="p-5 rounded-xl bg-orange-500/10 border border-orange-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-orange-400">Leads Perdidos Detectados ({metaValidation.orphanedLeads.length})</span>
                <span className="text-xs text-zinc-400 max-w-xl">
                  Encontramos leads órfãos no Meta Ads que não constam no CRM. Você pode forçar a importação retroativa deles no CV CRM e banco local.
                </span>
              </div>
              <button
                onClick={handleSyncOrphans}
                disabled={syncing}
                className="shrink-0 h-10 px-5 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {syncing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  'Sincronizar Leads Órfãos no CRM'
                )}
              </button>
            </div>
          )}

          {loading && !metaValidation ? (
            <div className="bg-sky-500/10 border border-sky-500/20 text-sky-300 p-4 rounded-xl text-sm">
              Validando leads do Meta Ads...
            </div>
          ) : null}

          {!metaValidation ? null : metaValidation.error ? (
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-4 rounded-xl text-sm">
              <h4 className="font-semibold mb-1">Atenção na Validação</h4>
              <p>{metaValidation.error}</p>
              <p className="mt-2 text-xs opacity-75">
                Para listar e validar leads individuais, certifique-se de que o token do Meta Ads possui a permissão avançada de leitura de leads (<code className="bg-black/30 px-1 py-0.5 rounded font-mono text-white">leads_retrieval</code>) ativa nas configurações da página do Facebook.
              </p>
            </div>
          ) : (
            <>
              {/* KPIs de Validação */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex flex-col gap-1 p-4.5 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-xs font-medium text-zinc-400">Total Analisado (Meta)</span>
                  <span className="text-3xl font-black text-white">
                    {metaValidation?.totalMetaLeads ?? 0}
                  </span>
                  <span className="text-[11px] text-zinc-500">Leads encontrados nos formulários ativos do Facebook</span>
                </div>
                <div className="flex flex-col gap-1 p-4.5 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-xs font-medium text-zinc-400">Leads Órfãos (Inconsistentes)</span>
                  <span className={`text-3xl font-black ${(metaValidation?.orphanedLeads?.length ?? 0) > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {metaValidation?.orphanedLeads?.length ?? 0}
                  </span>
                  <span className="text-[11px] text-zinc-500">Leads que estão no Meta mas NÃO estão no CV CRM</span>
                </div>
                <div className="flex flex-col gap-1 p-4.5 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-xs font-medium text-zinc-400">Taxa de Sincronização</span>
                  <span className="text-sky-400 text-3xl font-black">
                    {metaValidation?.totalMetaLeads
                      ? `${Math.round(((metaValidation.totalMetaLeads - metaValidation.orphanedLeads.length) / metaValidation.totalMetaLeads) * 100)}%`
                      : '100%'}
                  </span>
                  <span className="text-[11px] text-zinc-500">Porcentagem de leads integrados com sucesso</span>
                </div>
              </div>

              {/* Tabela de Órfãos */}
              <GlassCard title={`Leads no Meta Ads Não Cadastrados no CV CRM (${metaValidation?.orphanedLeads?.length ?? 0})`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-zinc-500 text-xs uppercase font-semibold">
                        <th className="text-left py-2 px-3">Nome</th>
                        <th className="text-left py-2 px-3">E-mail</th>
                        <th className="text-left py-2 px-3">Telefone</th>
                        <th className="text-left py-2 px-3">Formulário de Origem</th>
                        <th className="text-left py-2 px-3">Data de Captação</th>
                        <th className="text-right py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!metaValidation?.orphanedLeads || metaValidation.orphanedLeads.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-zinc-500 text-sm">
                            🎉 Excelente! Todos os leads captados nas campanhas do Meta Ads estão integrados no CV CRM.
                          </td>
                        </tr>
                      ) : (
                        (metaValidation.orphanedLeads as OrphanedLead[]).map(lead => (
                          <tr key={lead.id} className="border-b border-white/5 hover:bg-white/5 transition-colors text-zinc-300">
                            <td className="py-2.5 px-3 font-medium text-white">{lead.name || 'Sem Nome'}</td>
                            <td className="py-2.5 px-3 font-mono text-xs">{lead.email || '—'}</td>
                            <td className="py-2.5 px-3 font-mono text-xs">{lead.phone || '—'}</td>
                            <td className="py-2.5 px-3 text-xs text-zinc-400">{lead.formName || '—'}</td>
                            <td className="py-2.5 px-3 text-xs text-zinc-400">
                              {new Date(lead.createdTime).toLocaleString('pt-BR')}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <span className="bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider">
                                Não Integrado
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            </>
          )}
        </div>
      )}

      {activeTab === 'score' && (
        <GlassCard title="Score de Leads">
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <p
              className="text-lg font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              Em desenvolvimento
            </p>
            <p
              className="text-sm text-center max-w-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              O módulo de Score de Leads estará disponível em breve, com
              classificação automática baseada em comportamento e perfil.
            </p>
          </div>
        </GlassCard>
      )}
    </div>
  )
}
