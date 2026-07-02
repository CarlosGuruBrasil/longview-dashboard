'use client';

import React, { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[project-vision] Error caught:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center bg-[#09090b] border border-red-500/10 rounded-2xl lv-card">
      <div className="p-3 bg-red-500/10 text-red-400 rounded-full border border-red-500/20 mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h2 className="text-base font-bold text-white mb-2">Falha no Project Vision</h2>
      <p className="text-xs text-zinc-500 max-w-sm mb-6 leading-relaxed">
        Não foi possível carregar o módulo de projetos. O restante do dashboard continua disponível.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 rounded-lg transition-colors"
        >
          Recarregar
        </button>
        <button
          onClick={() => reset()}
          className="px-4 py-2 text-xs font-semibold text-black bg-white hover:bg-zinc-200 rounded-lg transition-colors"
        >
          Tentar Novamente
        </button>
      </div>
    </div>
  );
}
