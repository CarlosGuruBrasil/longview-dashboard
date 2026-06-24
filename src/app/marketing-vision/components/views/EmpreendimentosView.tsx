'use client'

import { useMemo, useState } from 'react'
import { Building2, Users, DollarSign, ChevronDown, ChevronUp } from 'lucide-react'
import { useData } from '../../context/DataContext'
import GlassCard from '../ui/GlassCard'

function formatCurrency(val: number) {
  return new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL', 
    maximumFractionDigits: 0 
  }).format(val || 0);
}

function AvailabilityBar({ disponivel, reservado, vendido, total }: { disponivel: number, reservado: number, vendido: number, total: number }) {
  const t = total || 1;
  const dispPct = (disponivel / t) * 100;
  const resPct = (reservado / t) * 100;
  const vendPct = (vendido / t) * 100;

  return (
    <div className="flex h-2 w-full rounded-full overflow-hidden gap-0.5 mt-2">
      <div className="transition-all" style={{ width: `${dispPct}%`, backgroundColor: '#10b981', minWidth: dispPct > 0 ? 4 : 0 }} />
      <div className="transition-all" style={{ width: `${resPct}%`, backgroundColor: '#f59e0b', minWidth: resPct > 0 ? 4 : 0 }} />
      <div className="transition-all" style={{ width: `${vendPct}%`, backgroundColor: '#0ea5e9', minWidth: vendPct > 0 ? 4 : 0 }} />
    </div>
  )
}

function StatPill({ label, count, color }: { label: string, count: number, color: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-lg font-bold" style={{ color }}>{count}</span>
      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
    </div>
  )
}

export default function EmpreendimentosView() {
  const { estoque, filteredLeads } = useData();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const empreendimentos = Array.isArray(estoque?.empreendimentos) ? estoque.empreendimentos : [];
  const resumo = Array.isArray(estoque?.resumo) ? estoque.resumo : [];
  const unidades = Array.isArray(estoque?.unidades) ? estoque.unidades : [];

  const leadCountByProject = useMemo(() => {
    const map = new Map<string, number>()
    for (const lead of filteredLeads) {
      for (const emp of lead.empreendimento ?? []) {
        if (emp.nome) {
          map.set(emp.nome, (map.get(emp.nome) ?? 0) + 1)
        }
      }
    }
    return map
  }, [filteredLeads])

  if (empreendimentos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Building2 size={48} className="opacity-20" style={{ color: 'var(--text-secondary)' }} />
        <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          Nenhum empreendimento encontrado
        </p>
        <p className="text-sm text-center max-w-md" style={{ color: 'var(--text-secondary)' }}>
          A sincronização com o banco de dados local pode estar em andamento ou a tabela ainda está vazia. Aguarde alguns instantes.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {empreendimentos.map((emp) => {
          const stats = resumo.find(r => r.id_empreendimento === emp.id) || {
            total: 0, disponivel: 0, reservado: 0, vendido: 0, vgv_disponivel: 0, vgv_vendido: 0
          };
          const leadCount = leadCountByProject.get(emp.nome) ?? 0;
          const isExpanded = expandedId === emp.id;
          const unidadesProjeto = unidades.filter(u => u.id_empreendimento === emp.id && u.status === 'Disponivel');

          return (
            <GlassCard key={emp.id}>
              <div className="flex flex-col gap-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex items-center justify-center w-12 h-12 rounded-xl flex-shrink-0"
                      style={{ backgroundColor: '#0ea5e922' }}
                    >
                      <Building2 size={24} style={{ color: '#0ea5e9' }} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
                        {emp.nome}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        <span className="px-2 py-0.5 rounded bg-white/5">{emp.situacao || 'Desconhecido'}</span>
                        <span className="px-2 py-0.5 rounded bg-white/5">{emp.tipo || 'Desconhecido'}</span>
                      </div>
                    </div>
                  </div>
                  {leadCount > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 flex-shrink-0">
                      <Users size={14} style={{ color: '#a855f7' }} />
                      <span className="text-sm font-bold" style={{ color: '#a855f7' }}>{leadCount} Leads</span>
                    </div>
                  )}
                </div>

                {/* VGV and Financial Metrics */}
                <div className="grid grid-cols-2 gap-4 py-4 mt-2 border-y border-white/10">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>VGV Disponível</span>
                    <span className="text-2xl font-bold" style={{ color: '#10b981' }}>{formatCurrency(stats.vgv_disponivel)}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>VGV Vendido / Res.</span>
                    <span className="text-2xl font-bold" style={{ color: '#0ea5e9' }}>{formatCurrency(stats.vgv_vendido)}</span>
                  </div>
                </div>

                {/* Unit counts */}
                <div className="grid grid-cols-4 gap-2 pt-2">
                  <StatPill label="Total" count={stats.total} color="var(--text-primary)" />
                  <StatPill label="Disponível" count={stats.disponivel} color="#10b981" />
                  <StatPill label="Reservado" count={stats.reservado} color="#f59e0b" />
                  <StatPill label="Vendido" count={stats.vendido} color="#0ea5e9" />
                </div>

                {/* Availability bar */}
                {stats.total > 0 ? (
                  <div className="flex flex-col gap-2 mt-2">
                    <AvailabilityBar 
                      disponivel={stats.disponivel} 
                      reservado={stats.reservado} 
                      vendido={stats.vendido} 
                      total={stats.total} 
                    />
                    <div className="flex items-center justify-between text-xs font-medium mt-1" style={{ color: 'var(--text-secondary)' }}>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: '#10b981' }} />
                        {((stats.disponivel / stats.total) * 100).toFixed(1)}% disp.
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: '#f59e0b' }} />
                        {((stats.reservado / stats.total) * 100).toFixed(1)}% res.
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: '#0ea5e9' }} />
                        {((stats.vendido / stats.total) * 100).toFixed(1)}% vend.
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-center py-2 opacity-40" style={{ color: 'var(--text-secondary)' }}>
                    Dados de unidades não contabilizados
                  </p>
                )}

                {/* Expand / Collapse Units Table */}
                {stats.disponivel > 0 && (
                  <div className="mt-2">
                    <button 
                      onClick={() => setExpandedId(isExpanded ? null : emp.id)}
                      className="flex items-center justify-center w-full gap-2 py-2 text-xs font-medium transition-colors rounded-lg hover:bg-white/5"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {isExpanded ? 'Ocultar Disponibilidade' : 'Ver Unidades Disponíveis'}
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    
                    {isExpanded && (
                      <div className="mt-4 overflow-hidden rounded-lg border border-white/10 bg-black/20">
                        <div className="max-h-60 overflow-y-auto custom-scrollbar">
                          <table className="w-full text-left text-xs">
                            <thead className="sticky top-0 bg-[#1e293b] text-white/70">
                              <tr>
                                <th className="p-3 font-medium">Bloco/Unid.</th>
                                <th className="p-3 font-medium">Metragem</th>
                                <th className="p-3 font-medium text-right">Valor</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {unidadesProjeto.length > 0 ? unidadesProjeto.map(u => (
                                <tr key={u.id} className="hover:bg-white/5 transition-colors">
                                  <td className="p-3" style={{ color: 'var(--text-primary)' }}>
                                    {u.bloco ? `${u.bloco} - ` : ''}{u.numero}
                                  </td>
                                  <td className="p-3" style={{ color: 'var(--text-secondary)' }}>
                                    {u.metragem ? `${u.metragem} m²` : '-'}
                                  </td>
                                  <td className="p-3 text-right font-medium text-[#10b981]">
                                    {u.valor ? formatCurrency(u.valor) : 'Consulte'}
                                  </td>
                                </tr>
                              )) : (
                                <tr>
                                  <td colSpan={3} className="p-4 text-center opacity-50">Nenhuma unidade disponível mapeada</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </GlassCard>
          )
        })}
      </div>
    </div>
  )
}
