'use client';
import React, { Suspense, lazy } from 'react';
import { DataProvider } from '../context/DataContext';
import AppShell from './AppShell';
import { useData } from '../context/DataContext';
import type { DashboardApiResponse } from '../types';

// Lazy-load views to keep initial bundle small
const DashboardView      = lazy(() => import('./views/DashboardView'));
const LeadsView          = lazy(() => import('./views/LeadsView'));
const OportunidadesView  = lazy(() => import('./views/OportunidadesView'));
const EmpreendimentosView = lazy(() => import('./views/EmpreendimentosView'));
const VendasView         = lazy(() => import('./views/VendasView'));
const MetricsView        = lazy(() => import('./views/MetricsView'));
const MarketingAdsView   = lazy(() => import('./views/MarketingAdsView'));
const TrafegoView        = lazy(() => import('./views/TrafegoView'));
const PublicarView       = lazy(() => import('./views/PublicarView'));
const AudienciasView     = lazy(() => import('./views/AudienciasView'));
const ScoreView          = lazy(() => import('./views/ScoreView'));
const LinksView          = lazy(() => import('../LinksView'));
const BiView             = lazy(() => import('./views/BiView'));

function ViewRouter() {
  const { activeView } = useData();

  const viewMap: Record<string, React.ReactNode> = {
    dashboard:       <DashboardView />,
    leads:           <LeadsView />,
    oportunidades:   <OportunidadesView />,
    empreendimentos: <EmpreendimentosView />,
    vendas:          <VendasView />,
    insights:        <BiView />,
    metrics:         <MetricsView />,
    marketing:       <MarketingAdsView />,
    trafego:         <TrafegoView />,
    publicar:        <PublicarView />,
    audiences:       <AudienciasView />,
    links:           <LinksView />,
    score:           <ScoreView />,
  };

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      {viewMap[activeView] ?? <DashboardView />}
    </Suspense>
  );
}

interface MarketingVisionAppProps {
  initialData?: DashboardApiResponse;
}

export default function MarketingVisionApp({ initialData }: MarketingVisionAppProps) {
  const providerData = initialData ? {
    leads:     initialData.leads?.leads ?? [],
    crmTotal:  initialData.leads?.crmTotal ?? 0,
    meta:      initialData.meta,
    estoque:   initialData.estoque,
    leadForms: initialData.leadForms ?? [],
    page:      initialData.page,
    updatedAt: initialData.updatedAt,
  } : undefined;

  return (
    <DataProvider initialData={providerData}>
      <AppShell>
        <ViewRouter />
      </AppShell>
    </DataProvider>
  );
}
