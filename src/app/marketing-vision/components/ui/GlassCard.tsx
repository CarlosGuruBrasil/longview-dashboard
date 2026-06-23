'use client';

import { ReactNode } from 'react';

interface GlassCardProps {
  title?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

export default function GlassCard({ title, action, className = '', children }: GlassCardProps) {
  return (
    <div
      className={`bg-white/5 backdrop-blur border border-white/10 rounded-2xl ${className}`}
    >
      {(title || action) && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3 sm:px-5 sm:py-4 border-b border-white/10">
          {title && (
            <h3 className="text-sm font-semibold shrink-0" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h3>
          )}
          {action && <div className="sm:ml-auto overflow-x-auto">{action}</div>}
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}
