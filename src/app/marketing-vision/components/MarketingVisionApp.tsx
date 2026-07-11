'use client';
import React, { Suspense, lazy } from 'react';
import { DataProvider } from '../context/DataContext';
import AppShell from './AppShell';
import { useData } from '../context/DataContext';
import type { DashboardApiResponse } from '../types';
import LogoLoader from '@/components/ui/LogoLoader';

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
const FontesView            = lazy(() => import('./views/FontesView'));

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
    fontes:       <FontesView />,
  };

  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center p-12" style={{ minHeight: '60vh' }}>
        <LogoLoader module="marketing" text="Carregando módulo..." />
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
