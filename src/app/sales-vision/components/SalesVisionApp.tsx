'use client';
import React, { useState, Suspense, lazy } from 'react';
import SalesAppShell from './SalesAppShell';

const VisaoGeralView = lazy(() => import('./views/VisaoGeralView'));
const ReservasContratosView = lazy(() => import('./views/ReservasContratosView'));
const PerformanceEmpreendimentoView = lazy(() => import('./views/PerformanceEmpreendimentoView'));
const CorretoresView = lazy(() => import('./views/CorretoresView'));
const FunilComercialView = lazy(() => import('./views/FunilComercialView'));

export type SalesActiveView = 'visao-geral' | 'reservas-contratos' | 'performance-empreendimento' | 'corretores' | 'funil-comercial';

interface SalesViewContextValue {
  activeView: SalesActiveView;
  setActiveView: (view: SalesActiveView) => void;
}

export const SalesViewContext = React.createContext<SalesViewContextValue>({
  activeView: 'visao-geral',
  setActiveView: () => {},
});

export function useSalesView() {
  return React.useContext(SalesViewContext);
}

export default function SalesVisionApp() {
  const [activeView, setActiveView] = useState<SalesActiveView>('visao-geral');

  const viewMap: Record<string, React.ReactNode> = {
    'visao-geral':               <VisaoGeralView />,
    'reservas-contratos':        <ReservasContratosView />,
    'performance-empreendimento': <PerformanceEmpreendimentoView />,
    'corretores':                <CorretoresView />,
    'funil-comercial':           <FunilComercialView />,
  };

  return (
    <SalesViewContext.Provider value={{ activeView, setActiveView }}>
      <SalesAppShell>
        <Suspense fallback={
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          {viewMap[activeView] ?? <VisaoGeralView />}
        </Suspense>
      </SalesAppShell>
    </SalesViewContext.Provider>
  );
}
