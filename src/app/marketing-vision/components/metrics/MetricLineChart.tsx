'use client'

import { useMemo, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { Lead } from '../../types'
import { calculateMetricsByPeriod } from '../../utils/metrics'
import GlassCard from '../ui/GlassCard'

interface MetricLineChartProps {
  metric: 'taxa_novos_leads' | 'taxa_atendimento' | 'taxa_agendamento' | 'taxa_visitas'
  allLeads: Lead[]
  targetBaseline?: number
}

const METRIC_CONFIG = {
  taxa_novos_leads: {
    label: 'Taxa de Novos Leads',
    dataKey: 'newLeadsRate',
    color: '#0ea5e9',
    target: 1.0,
  },
  taxa_atendimento: {
    label: 'Taxa de Atendimento',
    dataKey: 'attendanceRate',
    color: '#10b981',
    target: 0.8,
  },
  taxa_agendamento: {
    label: 'Taxa de Agendamento',
    dataKey: 'schedulingRate',
    color: '#f59e0b',
    target: 0.7,
  },
  taxa_visitas: {
    label: 'Taxa de Visitas',
    dataKey: 'visitRate',
    color: '#a855f7',
    target: 0.8,
  },
}

const TICK_COLOR = '#71717a'
const GRID_COLOR = 'rgba(255,255,255,0.05)'

type TooltipPayloadEntry = { value: number; color: string; payload: { period: string; totalLeads?: number } }
type CustomTooltipProps = { active?: boolean; payload?: TooltipPayloadEntry[] }

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const rate = item.value ?? 0;
  return (
    <div style={{
      backgroundColor: '#18181b',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8,
      padding: '8px 12px',
      fontSize: 12,
    }}>
      <p style={{ color: '#e4e4e7', marginBottom: 4 }}>{item.payload?.period}</p>
      <p style={{ color: item.color }}>
        {(rate * 100).toFixed(1)}% ({item.payload?.totalLeads} leads)
      </p>
    </div>
  );
}

export default function MetricLineChart({
  metric,
  allLeads,
  targetBaseline,
}: MetricLineChartProps) {
  const [granularity, setGranularity] = useState<'month' | 'trimestre' | 'year'>('month');
  const config = METRIC_CONFIG[metric];
  const target = targetBaseline ?? config.target;

  const data = useMemo(() => {
    return calculateMetricsByPeriod(allLeads, granularity).map(item => ({
      ...item,
      [config.dataKey]: item[config.dataKey as keyof typeof item],
    }));
  }, [allLeads, granularity, config]);

  const periodLabel = granularity === 'month' ? 'Mensais' : granularity === 'trimestre' ? 'Trimestrais' : 'Anuais';

  return (
    <GlassCard title={`${config.label} — Histórico (${periodLabel})`}>
      {/* Period Toggle */}
      <div className="flex gap-2 mb-4">
        {(['month', 'trimestre', 'year'] as const).map(g => (
          <button
            key={g}
            onClick={() => setGranularity(g)}
            className={[
              'text-xs px-3 py-1.5 rounded font-medium transition-colors',
              granularity === g
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700',
            ].join(' ')}
          >
            {g === 'month' ? 'Mês' : g === 'trimestre' ? 'Trimestre' : 'Ano'}
          </button>
        ))}
      </div>

      {/* Chart */}
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
            <XAxis
              dataKey="period"
              tick={{ fill: TICK_COLOR, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              label={{ value: 'Taxa (%)', angle: -90, position: 'insideLeft', offset: -5 }}
              domain={[0, 'auto']}
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              tick={{ fill: TICK_COLOR, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine
              y={target}
              stroke={config.color}
              strokeDasharray="5 5"
              label={{
                value: `Meta: ${(target * 100).toFixed(0)}%`,
                position: 'right',
                fill: config.color,
                fontSize: 11,
              }}
            />
            <Line
              dataKey={config.dataKey}
              stroke={config.color}
              dot={{ fill: config.color, r: 4 }}
              activeDot={{ r: 6 }}
              isAnimationActive
              strokeWidth={2}
              name={config.label}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[280px] flex items-center justify-center text-zinc-500 text-sm">
          Sem dados para este período
        </div>
      )}
    </GlassCard>
  );
}
