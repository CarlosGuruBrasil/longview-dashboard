'use client';

import { useMemo } from 'react';
import type { Lead } from '../../types';
import { cvStageRank, getStatusColor, isSale, isLoss } from '../../utils/leads';

interface StageSummaryProps {
  leads: Lead[];
}

interface StageGroup {
  name: string;
  count: number;
  color: string;
}

export default function StageSummary({ leads }: StageSummaryProps) {
  const groups = useMemo<StageGroup[]>(() => {
    const map = new Map<string, number>();

    for (const lead of leads) {
      let stageName: string;

      if (
        !isSale(lead) &&
        !isLoss(lead) &&
        lead.qtde_reservas_associadas &&
        lead.qtde_reservas_associadas > 0
      ) {
        stageName = 'Com Reserva';
      } else {
        stageName = lead.situacao?.nome || 'Sem etapa';
      }

      map.set(stageName, (map.get(stageName) ?? 0) + 1);
    }

    const sorted = Array.from(map.entries())
      .map(([name, count]) => {
        const color = getStatusColor(name).bg;
        return { name, count, color };
      })
      .sort((a, b) => cvStageRank(a.name) - cvStageRank(b.name));

    return sorted;
  }, [leads]);

  return (
    <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* Total card */}
      <div className="shrink-0 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 min-w-[72px]"
           style={{ borderBottom: '2px solid rgba(255,255,255,0.25)' }}>
        <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{leads.length}</p>
        <p className="text-[11px] mt-0.5 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>Total</p>
      </div>

      {groups.map((group) => (
        <div
          key={group.name}
          className="shrink-0 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 min-w-[88px]"
          style={{ borderBottom: `2px solid ${group.color}` }}
        >
          <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{group.count}</p>
          <p className="text-[11px] mt-0.5 whitespace-nowrap leading-tight max-w-[110px] truncate"
             style={{ color: 'var(--text-secondary)' }}>
            {group.name}
          </p>
        </div>
      ))}
    </div>
  );
}
