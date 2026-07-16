'use client';

import { useCallback, useEffect, useState } from 'react';
import logger from '@/lib/logger'

export interface SiteVisionPayload {
  overview: {
    internalProjects: number;
    crmProjects: number;
    siteProjects: number;
    publishedProjects: number;
    draftProjects: number;
    featuredProjects: number;
    linkedCrmProjects: number;
    leads: number;
    siteLeads: number;
    pendingSiteLeads: number;
    deliveredSiteLeads: number;
    failedSiteLeads: number;
    units: number;
    soldUnits: number;
    materials: number;
    mediaAssets: number;
    resales: number;
    publishedResales: number;
    internalTables: number;
    gatedAssets: number;
    analyticsEvents: number;
    cookieConsents: number;
    pageSnapshots: number;
  };
  leadStatus: Array<{ status: string; total: number }>;
  siteLeadStatus: Array<{ status: string; total: number }>;
  crmPortfolio: Array<{ id: number; nome: string; situacao: string | null; tipo: string | null }>;
  sitePortfolio: Array<{
    id: string;
    slug: string;
    nome: string;
    status: 'draft' | 'published' | 'archived';
    destaque: boolean;
    crmProjectId: number | null;
    crmNome: string | null;
    cidade: string;
    bairro: string;
    heroImageUrl: string;
    mediaCount: number;
    updatedAt: string;
  }>;
  inventory: Array<{
    id: number;
    nome: string;
    totalUnits: number;
    availableUnits: number;
    reservedUnits: number;
    soldUnits: number;
    linkedPages: number;
  }>;
  resales: Array<{
    id: string;
    slug: string;
    title: string;
    status: 'draft' | 'published' | 'archived' | 'sold';
    destaque: boolean;
    projectName: string | null;
    cvUnitId: number;
    heroImageUrl: string;
    brokerName: string;
    price: number | null;
    unitLabel: string;
    updatedAt: string;
  }>;
  internalTables: Array<{
    id: string;
    title: string;
    projectName: string | null;
    versionLabel: string;
    sizeBytes: number | null;
    createdAt: string;
  }>;
  gatedAssets: Array<{
    id: string;
    title: string;
    slug: string;
    type: 'ebook' | 'brochure' | 'document';
    active: boolean;
    projectName: string | null;
    sizeBytes: number | null;
    leads: number;
    updatedAt: string;
  }>;
  analytics: {
    sessions: number;
    pageViews: number;
    ctaClicks: number;
    whatsappClicks: number;
    ebookDownloads: number;
    analyticsConsents: number;
    marketingConsents: number;
  };
  topPages: Array<{
    pageType: string;
    pageKey: string;
    path: string;
    views: number;
    uniqueSessions: number;
    leads: number;
    ctaClicks: number;
    whatsappClicks: number;
    updatedAt: string;
  }>;
  topCtas: Array<{
    name: string;
    total: number;
    latestAt: string | null;
  }>;
  timestamps: {
    leadsSyncAt: string | null;
    estoqueSyncAt: string | null;
    siteContentSyncAt: string | null;
    latestSiteLeadAt: string | null;
    latestLeadDispatchAt: string | null;
  };
  integrations: Array<{
    key: string;
    label: string;
    status: string;
    value: string;
    description: string;
  }>;
  projectPortfolio: Array<{
    id: string;
    name: string;
    description: string;
    status: string;
    progress: number;
    banner: string;
  }>;
  userBreakdown: {
    total: number;
    admins: number;
    corretores: number;
    parceiros: number;
  };
  contentWarnings: Array<{
    key: string;
    label: string;
    total: number;
    description: string;
  }>;
  syncRuns: Array<{
    id: number;
    integration: string;
    status: 'success' | 'warning' | 'error' | 'running';
    scope: string;
    summary: string;
    createdAt: string;
  }>;
  integrationHealth: Array<{
    key: string;
    latestStatus: string | null;
    latestSummary: string | null;
    latestAt: string | null;
    events24h: number;
    issues24h: number;
    ok24h: number;
  }>;
  schema: {
    siteTables: number;
    siteReady: boolean;
  };
}

export function useSiteVision() {
  const [data, setData] = useState<SiteVisionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/site-vision', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || 'Não foi possível carregar o módulo.');
        setData(null);
        return;
      }
      setData(json);
    } catch (err) {
      logger.error({ err }, '[site-vision] falha ao carregar payload:');
      setError('Não foi possível carregar o módulo.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}
