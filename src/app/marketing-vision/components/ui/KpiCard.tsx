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
    <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0"
          style={{ backgroundColor: `${color}22` }}
        >
          <Icon size={20} style={{ color }} />
        </div>
        <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </span>
      </div>
      <div>
        <p className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {value}
        </p>
        {subtitle && (
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
