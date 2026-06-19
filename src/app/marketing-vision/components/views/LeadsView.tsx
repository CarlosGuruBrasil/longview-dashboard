'use client'

import { useMemo, useState } from 'react'
import { useData } from '../../context/DataContext'
import GlassCard from '../ui/GlassCard'
import StageSummary from '../ui/StageSummary'
import LeadsTable from '../ui/LeadsTable'
import GrowthLineChart from '../charts/GrowthLineChart'
import PieDonutChart from '../charts/PieDonutChart'

type SubTab = 'crm' | 'meta-validation' | 'score'

export default function LeadsView() {
  const { filteredLeads, metaValidation } = useData()
  const [activeTab, setActiveTab] = useState<SubTab>('crm')
  const [growthMode, setGrowthMode] = useState<'month' | 'year'>('month')

  // Chart: Gênero
  const generoData = useMemo(() => {
    const map = new Map<string, number>()
    for (const lead of filteredLeads) {
      const genero = lead.genero?.trim() || 'Não informado'
      map.set(genero, (map.get(genero) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [filteredLeads])

  // Chart: Top 5 Cidades
  const cidadesData = useMemo(() => {
    const map = new Map<string, number>()
    for (const lead of filteredLeads) {
      const cidade = lead.cidade?.trim() || 'Não informado'
      map.set(cidade, (map.get(cidade) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  }, [filteredLeads])

  // Chart: Estado Civil
  const estadoCivilData = useMemo(() => {
    const map = new Map<string, number>()
    for (const lead of filteredLeads) {
      const estadoCivil = lead.estado_civil?.trim() || 'Não informado'
      map.set(estadoCivil, (map.get(estadoCivil) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
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
          {/* Stage summary */}
          <StageSummary leads={filteredLeads} />

          {/* Growth line chart */}
          <GrowthLineChart
            leads={filteredLeads}
            mode={growthMode}
            onModeChange={setGrowthMode}
          />

          {/* Demographic pie charts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <PieDonutChart
              title="Gênero"
              data={generoData}
              height={260}
            />
            <PieDonutChart
              title="Top 5 Cidades"
              data={cidadesData}
              height={260}
            />
            <PieDonutChart
              title="Estado Civil"
              data={estadoCivilData}
              height={260}
            />
          </div>

          {/* Leads table */}
          <LeadsTable leads={filteredLeads} />
        </div>
      )}

      {activeTab === 'meta-validation' && (
        <div className="flex flex-col gap-6">
          <GlassCard title="Validação de Integração de Leads (Meta Ads × CV CRM)">
            <p className="text-sm leading-relaxed text-zinc-400 max-w-4xl">
              Esta ferramenta compara em tempo real os contatos captados nos formulários ativos de campanhas de Meta Ads (Facebook e Instagram) com os leads cadastrados no CV CRM. Se o e-mail ou o telefone do lead captado no Meta não estiver cadastrado no CRM, ele será listado abaixo como uma inconsistência.
            </p>
          </GlassCard>

          {metaValidation?.error ? (
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
                  <span className="text-[10px] text-zinc-500">Leads encontrados nos formulários ativos do Facebook</span>
                </div>
                <div className="flex flex-col gap-1 p-4.5 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-xs font-medium text-zinc-400">Leads Órfãos (Inconsistentes)</span>
                  <span className={`text-3xl font-black ${(metaValidation?.orphanedLeads?.length ?? 0) > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {metaValidation?.orphanedLeads?.length ?? 0}
                  </span>
                  <span className="text-[10px] text-zinc-500">Leads que estão no Meta mas NÃO estão no CV CRM</span>
                </div>
                <div className="flex flex-col gap-1 p-4.5 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-xs font-medium text-zinc-400">Taxa de Sincronização</span>
                  <span className="text-sky-400 text-3xl font-black">
                    {metaValidation?.totalMetaLeads
                      ? `${Math.round(((metaValidation.totalMetaLeads - metaValidation.orphanedLeads.length) / metaValidation.totalMetaLeads) * 100)}%`
                      : '100%'}
                  </span>
                  <span className="text-[10px] text-zinc-500">Porcentagem de leads integrados com sucesso</span>
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
                        metaValidation.orphanedLeads.map((lead: any) => (
                          <tr key={lead.id} className="border-b border-white/5 hover:bg-white/5 transition-colors text-zinc-300">
                            <td className="py-2.5 px-3 font-medium text-white">{lead.name || 'Sem Nome'}</td>
                            <td className="py-2.5 px-3 font-mono text-xs">{lead.email || '—'}</td>
                            <td className="py-2.5 px-3 font-mono text-xs">{lead.phone || '—'}</td>
                            <td className="py-2.5 px-3 text-xs text-zinc-400">{lead.formName || '—'}</td>
                            <td className="py-2.5 px-3 text-xs text-zinc-400">
                              {new Date(lead.createdTime).toLocaleString('pt-BR')}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <span className="bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider">
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
