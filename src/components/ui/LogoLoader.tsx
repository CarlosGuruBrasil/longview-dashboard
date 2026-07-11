'use client';

import React from 'react';

type ModuleKey = 'project' | 'marketing' | 'people' | 'quality' | 'sales' | 'default';

interface LogoLoaderProps {
  module?: ModuleKey;
  text?: string;
  className?: string;
}

const moduleColors: Record<ModuleKey, { dropShadow: string, textClass: string, dotClass: string }> = {
  project: {
    dropShadow: 'drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]', // blue-500
    textClass: 'text-blue-500/80',
    dotClass: 'bg-blue-500'
  },
  marketing: {
    dropShadow: 'drop-shadow-[0_0_15px_rgba(249,115,22,0.3)]', // orange-500
    textClass: 'text-orange-500/80',
    dotClass: 'bg-orange-500'
  },
  people: {
    dropShadow: 'drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]', // emerald-500
    textClass: 'text-emerald-500/80',
    dotClass: 'bg-emerald-500'
  },
  quality: {
    dropShadow: 'drop-shadow-[0_0_15px_rgba(168,85,247,0.3)]', // purple-500
    textClass: 'text-purple-500/80',
    dotClass: 'bg-purple-500'
  },
  sales: {
    dropShadow: 'drop-shadow-[0_0_15px_rgba(6,182,212,0.3)]', // cyan-500
    textClass: 'text-cyan-500/80',
    dotClass: 'bg-cyan-500'
  },
  default: {
    dropShadow: 'drop-shadow-[0_0_15px_rgba(161,161,170,0.3)]', // zinc-400
    textClass: 'text-zinc-400/80',
    dotClass: 'bg-zinc-400'
  }
};

export default function LogoLoader({ module = 'default', text = 'Sincronizando Dados...', className = '' }: LogoLoaderProps) {
  const theme = moduleColors[module] || moduleColors.default;

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <img 
        src="/logolongview.png" 
        alt="Carregando..." 
        className={`w-28 h-auto object-contain animate-pulse ${theme.dropShadow}`} 
      />
      <div className="flex flex-col sm:flex-row items-center gap-2 mt-1">
        <div className="flex items-center gap-1.5">
          <div className={`w-1 h-1 rounded-full animate-bounce ${theme.dotClass}`} style={{ animationDelay: '0ms' }}></div>
          <div className={`w-1 h-1 rounded-full animate-bounce ${theme.dotClass}`} style={{ animationDelay: '150ms' }}></div>
          <div className={`w-1 h-1 rounded-full animate-bounce ${theme.dotClass}`} style={{ animationDelay: '300ms' }}></div>
        </div>
        <p className={`${theme.textClass} text-[9px] font-semibold tracking-[2px] uppercase animate-pulse whitespace-nowrap`}>
          {text}
        </p>
      </div>
    </div>
  );
}
