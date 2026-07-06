'use client'

import { useState, useMemo } from 'react'
import {
  MapPin, Clock, ArrowRight, ExternalLink, Filter,
  Users, Megaphone, ShoppingBag, ChevronRight, Radio, Search, Database
} from 'lucide-react'
import { useData } from '../../context/DataContext'
import type { Lead } from '../../types'
import FilterBar from '../ui/FilterBar'
import DataTable from '../ui/DataTable'
import { formatDate } from '../../utils/formatters'


// ── Helpers ───────────────────────────────────────────────────────────────────

function getLeadDate(lead: Lead): string {
  return lead.data_cad ?? lead.data_cadastro ?? lead.data_cadastramento ?? ''
}

function getLeadOrigin(lead: Lead): string {
  const o = lead.origem
  if (!o) return 'Desconhecida'
  return typeof o === 'string' ? o : o.nome
}

function getLeadEmpreendimento(lead: Lead): string {
  return lead.empreendimento?.[0]?.nome ?? 'Sem Empreendimento'
}

function getLeadStageColor(status: string): { bg: string; color: string } {
  const s = status.toLowerCase()
  if (s.includes('venda') || s.includes('contract')) return { bg: 'rgba(16,185,129,0.12)', color: '#10b981' }
  if (s.includes('reserva')) return { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' }
  if (s.includes('visita')) return { bg: 'rgba(168,85,247,0.12)', color: '#a855f7' }
  if (s.includes('cancel') || s.includes('perd')) return { bg: 'rgba(244,63,94,0.12)', color: '#f43f5e' }
  return { bg: 'rgba(14,165,233,0.12)', color: '#0ea5e9' }
}

const JOURNEY_STEPS = [
  { key: 'origem',         label: 'Origem',       icon: Megaphone,   color: '#f59e0b' },
  { key: 'campanha',       label: 'Campanha',      icon: Radio,       color: '#a855f7' },
  { key: 'lead',           label: 'Lead Gerado',   icon: Users,       color: '#0ea5e9' },
  { key: 'etapa_crm',      label: 'Etapa CRM',     icon: Filter,      color: '#10b981' },
  { key: 'sales',          label: 'Sales Vision',  icon: ShoppingBag, color: '#06b6d4' },
]

// ── Journey Mini-Timeline ─────────────────────────────────────────────────────

function LeadJourneyRow({ lead }: { lead: Lead }) {
  const [expanded, setExpanded] = useState(false)
  const origin = getLeadOrigin(lead)
  const empName = getLeadEmpreendimento(lead)
  const status = lead.situacao?.nome ?? 'Novo Lead'
  const stageClr = getLeadStageColor(status)
  const date = getLeadDate(lead)
  const dateStr = date ? new Date(date).toLocaleDateString('pt-BR') : '—'
  const cvId = lead.idlead ?? lead.id

  const tags = [
    typeof lead.origem === 'string' ? lead.origem : (lead.origem as { nome: string })?.nome,
    lead.midia_principal,
    ...(lead.tags ?? []).map(t => typeof t === 'string' ? t : t.nome).filter(Boolean),
  ].filter(Boolean).slice(0, 3) as string[]

  return (
    <div className="border border-white/[0.06] rounded-2xl overflow-hidden bg-white/[0.01] hover:bg-white/[0.03] transition-all">
      {/* Row principal */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-orange-500/15 border border-orange-500/20 flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-orange-400">
            {(lead.nome ?? 'A').charAt(0).toUpperCase()}
          </span>
        </div>

        {/* Nome e etapa */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-100 truncate">{lead.nome ?? 'Lead sem nome'}</p>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            <span className="text-[11px] text-zinc-500">{empName}</span>
            <span className="text-zinc-700">·</span>
            <span className="text-[11px] text-zinc-500">{dateStr}</span>
          </div>
        </div>

        {/* Origem */}
        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-zinc-400 bg-white/[0.03] border border-white/[0.06] px-2.5 py-1 rounded-full shrink-0">
          <MapPin size={10} className="text-orange-400" /> {origin}
        </span>

        {/* Status badge */}
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0"
          style={{ backgroundColor: stageClr.bg, color: stageClr.color }}>
          {status}
        </span>

        {/* Abrir no CRM */}
        {cvId && (
          <a
            href={`https://app.cvcrm.com.br/leads/${cvId}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="hidden sm:flex items-center gap-1 text-[11px] font-semibold text-sky-400 hover:text-sky-300 shrink-0"
          >
            CV CRM <ExternalLink size={11} />
          </a>
        )}

        <ChevronRight size={14} className={`text-zinc-600 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </div>

      {/* Timeline expandida */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-white/[0.05]">
          {/* Jornada visual */}
          <div className="flex items-center gap-0 overflow-x-auto pb-2 mt-3">
            {JOURNEY_STEPS.map((step, i) => {
              const Icon = step.icon
              const isActive =
                (step.key === 'origem' && !!getLeadOrigin(lead)) ||
                (step.key === 'campanha' && !!lead.midia_principal) ||
                (step.key === 'lead') ||
                (step.key === 'etapa_crm' && !!lead.situacao) ||
                (step.key === 'sales' && !!(lead.data_venda))

              return (
                <div key={step.key} className="flex items-center shrink-0">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{
                        background: isActive ? `${step.color}18` : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${isActive ? `${step.color}30` : 'rgba(255,255,255,0.06)'}`,
                      }}>
                      <Icon size={15} style={{ color: isActive ? step.color : '#3f3f46' }} />
                    </div>
                    <span className="text-[10px] font-medium text-center leading-tight"
                      style={{ color: isActive ? step.color : '#52525b' }}>
                      {step.label}
                    </span>
                  </div>
                  {i < JOURNEY_STEPS.length - 1 && (
                    <div className="w-8 h-[2px] mx-1.5 rounded-full mb-4"
                      style={{ backgroundColor: isActive ? `${step.color}40` : 'rgba(255,255,255,0.05)' }} />
                  )}
                </div>
              )
            })}
          </div>

          {/* Detalhes do lead */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
            {[
              { label: 'Email', value: lead.email },
              { label: 'Telefone', value: lead.celular ?? lead.telefone },
              { label: 'Mídia', value: lead.midia_principal },
              { label: 'Corretor', value: lead.corretor?.nome },
              { label: 'Temperatura', value: lead.temperatura },
              { label: 'Score', value: lead.score?.toString() },
            ].filter(d => d.value).map(d => (
              <div key={d.label} className="bg-white/[0.02] border border-white/[0.05] rounded-xl px-3 py-2">
                <p className="text-[10px] text-zinc-600 font-medium">{d.label}</p>
                <p className="text-xs text-zinc-300 font-semibold truncate">{d.value}</p>
              </div>
            ))}
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {tags.map(t => (
                <span key={t} className="text-[10px] font-medium px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.07] text-zinc-400">
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Link CRM mobile */}
          {cvId && (
            <a href={`https://app.cvcrm.com.br/leads/${cvId}`} target="_blank" rel="noopener noreferrer"
              className="sm:hidden mt-3 flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300">
              <ExternalLink size={12} /> Abrir no CV CRM
            </a>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function JornadaLeadView() {
  const { filteredLeads, loading } = useData()
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'dashboard' | 'data'>('dashboard')

  const leads = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return filteredLeads
    return filteredLeads.filter(l =>
      (l.nome ?? '').toLowerCase().includes(q) ||
      (l.email ?? '').toLowerCase().includes(q) ||
      getLeadOrigin(l).toLowerCase().includes(q) ||
      getLeadEmpreendimento(l).toLowerCase().includes(q)
    )
  }, [filteredLeads, search])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <MapPin size={18} className="text-orange-400" />
            Rastreamento & Jornada do Lead
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {leads.length.toLocaleString('pt-BR')} leads · Da origem até o Sales Vision
          </p>
        </div>
      </div>

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
          Visualização em Linha do Tempo
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
          {/* Filtro + busca */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input
                type="text"
                placeholder="Buscar por nome, email, origem ou empreendimento…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-4 text-sm bg-white/[0.03] border border-white/[0.08] rounded-xl text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/40 focus:bg-white/[0.05] transition-all"
              />
            </div>
            <FilterBar />
          </div>

          {/* Legenda da jornada */}
          <div className="flex items-center gap-2 flex-wrap">
            {JOURNEY_STEPS.map((step, i) => (
              <div key={step.key} className="flex items-center gap-1">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: `${step.color}15`, color: step.color }}>
                  {step.label}
                </span>
                {i < JOURNEY_STEPS.length - 1 && <ArrowRight size={10} className="text-zinc-700" />}
              </div>
            ))}
          </div>

          {/* Lista de leads com jornada */}
          <div className="flex flex-col gap-2">
            {leads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Users size={32} className="text-zinc-700" />
                <p className="text-zinc-500 text-sm">Nenhum lead encontrado com esses filtros</p>
              </div>
            ) : (
              leads.slice(0, 100).map(lead => (
                <LeadJourneyRow key={lead.idlead ?? lead.id} lead={lead} />
              ))
            )}
            {leads.length > 100 && (
              <p className="text-xs text-zinc-500 text-center py-2">
                Mostrando 100 de {leads.length} leads · Use filtros para refinar
              </p>
            )}
          </div>
        </>
      ) : (
        <DataTable<any>
          title="Tabela de Rastreamento e Atribuição de Mídia"
          rows={leads}
          exportFileName="jornada_atribuicao_leads"
          searchFields={['nome', 'email', 'telefone', 'celular', 'midia_principal']}
          searchPlaceholder="Buscar lead por nome, contato, mídia..."
          defaultSortField="data_cadastro"
          columns={[
            { label: 'Nome', field: 'nome', render: row => <span className="font-semibold text-zinc-100">{row.nome || 'Sem Nome'}</span> },
            { label: 'Contato', render: row => (
                <div className="flex flex-col text-[11px] text-zinc-400">
                  <span>{row.email || '—'}</span>
                  <span>{row.celular || row.telefone || '—'}</span>
                </div>
              ),
              csvValue: row => `${row.email || ''} / ${row.celular || row.telefone || ''}`
            },
            { label: 'Origem de Mídia', render: row => getLeadOrigin(row), csvValue: row => getLeadOrigin(row) },
            { label: 'Mídia / Campanha', field: 'midia_principal', render: row => row.midia_principal || '—' },
            { label: 'Etapa CRM', field: 'situacao', render: row => (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/5 border border-white/10 text-zinc-300">
                  {row.situacao?.nome || 'Sem Situação'}
                </span>
              ),
              csvValue: row => row.situacao?.nome || ''
            },
            { label: 'Lançamento', render: row => getLeadEmpreendimento(row), csvValue: row => getLeadEmpreendimento(row) },
            { label: 'Corretor', render: row => row.corretor?.nome || '—', csvValue: row => row.corretor?.nome || '' },
            { label: 'Temperatura', field: 'temperatura', render: row => row.temperatura || '—' },
            { label: 'Cadastro', field: 'data_cadastro', render: row => formatDate(getLeadDate(row)) }
          ]}
        />
      )}
    </div>
  )
}
