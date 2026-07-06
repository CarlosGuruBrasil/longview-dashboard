'use client';
import React, { Suspense, lazy } from 'react';
import { DataProvider } from '../context/DataContext';
import AppShell from './AppShell';
import { useData } from '../context/DataContext';
import type { DashboardApiResponse } from '../types';

const DashboardView         = lazy(() => import('./views/DashboardView'));
const LeadsView             = lazy(() => import('./views/LeadsView'));
const VendasView            = lazy(() => import('./views/VendasView'));
const MetricsView           = lazy(() => import('./views/MetricsView'));
const MarketingAdsView      = lazy(() => import('./views/MarketingAdsView'));
const GestaoAdsView         = lazy(() => import('./views/GestaoAdsView'));
const IntelligenceView      = lazy(() => import('./views/IntelligenceView'));
const FunilInteligenteView  = lazy(() => import('./views/FunilInteligenteView'));
const CentralComandoView    = lazy(() => import('./views/CentralComandoView'));
const JornadaLeadView       = lazy(() => import('./views/JornadaLeadView'));
const AssistenteIAView      = lazy(() => import('./views/AssistenteIAView'));
const CentralSocialView     = lazy(() => import('./views/CentralSocialView'));
const HubIntegracoesView    = lazy(() => import('./views/HubIntegracoesView'));

function ViewRouter() {
  const { activeView } = useData();

  const viewMap: Record<string, React.ReactNode> = {
    dashboard:    <DashboardView />,
    leads:        <LeadsView />,
    funil:        <FunilInteligenteView />,
    vendas:       <VendasView />,
    metrics:      <MetricsView />,
    marketing:    <MarketingAdsView />,
    ads:          <GestaoAdsView />,
    intelligence: <IntelligenceView />,
    comando:      <CentralComandoView />,
    jornada:      <JornadaLeadView />,
    assistente:   <AssistenteIAView />,
    social:       <CentralSocialView />,
    integracoes:  <HubIntegracoesView />,
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
