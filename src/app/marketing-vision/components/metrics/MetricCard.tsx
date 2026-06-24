'use client'

import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import GlassCard from '../ui/GlassCard'

interface MetricCardProps {
  metric: 'taxa_novos_leads' | 'taxa_atendimento' | 'taxa_agendamento' | 'taxa_visitas'
  currentRate: number // decimal (e.g., 1.15)
  numerator: number
  denominator: number
  targetBaseline?: number // e.g., 1.0 for 100%
  loading?: boolean
}

const METRIC_CONFIG = {
  taxa_novos_leads: {
    label: 'Taxa de Novos Leads',
    icon: '📈',
    color: '#0ea5e9',
    target: 1.0,
  },
  taxa_atendimento: {
    label: 'Taxa de Atendimento',
    icon: '👥',
    color: '#10b981',
    target: 0.8,
  },
  taxa_agendamento: {
    label: 'Taxa de Agendamento',
    icon: '📅',
    color: '#f59e0b',
    target: 0.7,
  },
  taxa_visitas: {
    label: 'Taxa de Visitas',
    icon: '🏢',
    color: '#a855f7',
    target: 0.8,
  },
}

function getMetricStatus(rate: number, target: number) {
  const variance = (rate - target) / target;
  if (variance >= 0.05) return { color: '#10b981', status: 'acima' };
  if (variance < -0.05) return { color: '#ef4444', status: 'abaixo' };
  return { color: '#f59e0b', status: 'meta' };
}

export default function MetricCard({
  metric,
  currentRate,
  numerator,
  denominator,
  targetBaseline,
  loading = false,
}: MetricCardProps) {
  const [showPercentage, setShowPercentage] = useState(true);
  const config = METRIC_CONFIG[metric];
  const target = targetBaseline ?? config.target;
  const { color: statusColor, status } = getMetricStatus(currentRate, target);

  const displayValue = useMemo(() => {
    if (showPercentage) {
      return `${(currentRate * 100).toFixed(1)}%`;
    }
    return `${numerator}/${denominator}`;
  }, [showPercentage, currentRate, numerator, denominator]);

  const targetDisplay = `${(target * 100).toFixed(0)}%`;

  return (
    <GlassCard>
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{config.icon}</span>
              <h3 className="text-sm font-semibold text-zinc-300">{config.label}</h3>
            </div>
            <p className="text-xs text-zinc-500">Meta: {targetDisplay}</p>
          </div>
          <button
            onClick={() => setShowPercentage(!showPercentage)}
            className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors flex items-center gap-1"
            title={showPercentage ? 'Mostrar contagem' : 'Mostrar porcentagem'}
          >
            {showPercentage ? '%' : '#'}
            <ChevronDown size={14} />
          </button>
        </div>

        {/* Gauge/Value Area */}
        <div className="flex flex-col items-center gap-3">
          {/* Circular gauge */}
          <div className="relative w-32 h-32 flex items-center justify-center">
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
                stroke={statusColor}
                strokeWidth="8"
                strokeDasharray={`${Math.min(currentRate / 2, 1) * Math.PI * 100} ${Math.PI * 100}`}
                style={{ transition: 'stroke-dasharray 0.3s ease' }}
              />
            </svg>

            {/* Center text */}
            <div className="flex flex-col items-center z-10">
              <div className="text-2xl font-bold text-zinc-100">{displayValue}</div>
              <div className="text-xs text-zinc-500 mt-1">{status}</div>
            </div>
          </div>

          {/* Status badge */}
          <div
            className="px-3 py-1 rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: statusColor, opacity: 0.9 }}
          >
            {status === 'acima' && '↑ Acima da meta'}
            {status === 'meta' && '→ Conforme meta'}
            {status === 'abaixo' && '↓ Abaixo da meta'}
          </div>

          {/* Loading state */}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded backdrop-blur-sm">
              <div className="animate-spin">⟳</div>
            </div>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
