'use client'

import { useMemo } from 'react'
import GlassCard from '../ui/GlassCard'
import { calculateProposalVsSales } from '../../utils/metrics'
import type { Lead } from '../../types'

interface ProposalVsSalesCardProps {
  leads: Lead[]
  loading?: boolean
}

function getStatus(current: number, meta: number) {
  const variance = (current - meta) / meta
  if (variance >= 0.05) return { color: '#10b981', status: 'acima' }
  if (variance < -0.05) return { color: '#ef4444', status: 'abaixo' }
  return { color: '#f59e0b', status: 'meta' }
}

export default function ProposalVsSalesCard({ leads, loading = false }: ProposalVsSalesCardProps) {
  const metrics = useMemo(() => calculateProposalVsSales(leads), [leads])

  const proposalStatus = getStatus(metrics.comPropostaCount, metrics.comPropostaMeta)
  const salesStatus = getStatus(metrics.vendasCount, metrics.vendaRealizadaMeta)

  const proposalRatio = metrics.comPropostaMeta > 0 ? (metrics.comPropostaCount / metrics.comPropostaMeta) * 100 : 0
  const salesRatio = metrics.vendaRealizadaMeta > 0 ? (metrics.vendasCount / metrics.vendaRealizadaMeta) * 100 : 0

  return (
    <GlassCard title="Com Proposta vs Vendas Realizadas">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Com Proposta Gauge */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-40 h-40 flex items-center justify-center">
            {/* Background circle */}
            <svg
              className="absolute inset-0 transform -rotate-90"
              viewBox="0 0 120 120"
              style={{ width: '100%', height: '100%' }}
            >
              {/* Gray background arc */}
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="8"
              />
              {/* Progress arc */}
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke={proposalStatus.color}
                strokeWidth="8"
                strokeDasharray={`${Math.min(proposalRatio / 200, 1) * Math.PI * 100} ${Math.PI * 100}`}
                style={{ transition: 'stroke-dasharray 0.3s ease' }}
              />
            </svg>

            {/* Center text */}
            <div className="flex flex-col items-center z-10">
              <div className="text-3xl font-bold text-zinc-100">
                {metrics.comPropostaCount}
              </div>
              <div className="text-xs text-zinc-500 mt-1">/ {metrics.comPropostaMeta}</div>
            </div>
          </div>

          <div className="text-center">
            <p className="text-sm font-semibold text-zinc-300 mb-2">Com Proposta</p>
            <div
              className="px-3 py-1 rounded-full text-xs font-medium text-white inline-block"
              style={{ backgroundColor: proposalStatus.color, opacity: 0.9 }}
            >
              {proposalStatus.status === 'acima' && '↑ Acima da meta'}
              {proposalStatus.status === 'meta' && '→ Conforme meta'}
              {proposalStatus.status === 'abaixo' && '↓ Abaixo da meta'}
            </div>
          </div>
        </div>

        {/* Vendas Realizadas Gauge */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-40 h-40 flex items-center justify-center">
            {/* Background circle */}
            <svg
              className="absolute inset-0 transform -rotate-90"
              viewBox="0 0 120 120"
              style={{ width: '100%', height: '100%' }}
            >
              {/* Gray background arc */}
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="8"
              />
              {/* Progress arc */}
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke={salesStatus.color}
                strokeWidth="8"
                strokeDasharray={`${Math.min(salesRatio / 200, 1) * Math.PI * 100} ${Math.PI * 100}`}
                style={{ transition: 'stroke-dasharray 0.3s ease' }}
              />
            </svg>

            {/* Center text */}
            <div className="flex flex-col items-center z-10">
              <div className="text-3xl font-bold text-zinc-100">
                {metrics.vendasCount}
              </div>
              <div className="text-xs text-zinc-500 mt-1">/ {metrics.vendaRealizadaMeta}</div>
            </div>
          </div>

          <div className="text-center">
            <p className="text-sm font-semibold text-zinc-300 mb-2">Vendas Realizadas</p>
            <div
              className="px-3 py-1 rounded-full text-xs font-medium text-white inline-block"
              style={{ backgroundColor: salesStatus.color, opacity: 0.9 }}
            >
              {salesStatus.status === 'acima' && '↑ Acima da meta'}
              {salesStatus.status === 'meta' && '→ Conforme meta'}
              {salesStatus.status === 'abaixo' && '↓ Abaixo da meta'}
            </div>
          </div>
        </div>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded backdrop-blur-sm">
          <div className="animate-spin">⟳</div>
        </div>
      )}
    </GlassCard>
  )
}
