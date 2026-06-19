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
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          {title && (
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h3>
          )}
          {action && <div className="ml-auto">{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
