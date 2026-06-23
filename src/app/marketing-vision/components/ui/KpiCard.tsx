'use client';

import { ComponentType } from 'react';

interface KpiCardProps {
  icon: ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}

export default function KpiCard({ icon: Icon, label, value, subtitle, color = '#0ea5e9' }: KpiCardProps) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 sm:p-5 flex flex-col gap-2 sm:gap-3">
      {/* Icon + label — label truncada para nunca quebrar em 2 linhas */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div
          className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-xl shrink-0"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon size={15} className="sm:hidden" style={{ color }} />
          <Icon size={19} className="hidden sm:block" style={{ color }} />
        </div>
        <span
          className="text-[11px] sm:text-[13px] font-medium truncate leading-tight"
          style={{ color: 'var(--text-secondary)' }}
        >
          {label}
        </span>
      </div>

      {/* Valor — texto menor no mobile para não transbordar */}
      <div className="min-w-0">
        <p
          className="text-[21px] sm:text-3xl font-bold tracking-tight truncate"
          style={{ color: 'var(--text-primary)' }}
        >
          {value}
        </p>
        {subtitle && (
          <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
