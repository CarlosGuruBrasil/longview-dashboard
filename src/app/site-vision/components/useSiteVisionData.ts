'use client';

import { useCallback, useEffect, useState } from 'react';
import logger from '@/lib/logger';

// ============================================================================
// OVERVIEW HOOK
// ============================================================================

export interface OverviewData {
  overview: {
    crmProjects: number;
    leads: number;
    units: number;
    soldUnits: number;
    materials: number;
    users: { total: number; admins: number; corretores: number; parceiros: number };
  };
  leadStatus: Array<{ status: string; total: number }>;
  timestamps: {
    leadsSyncAt: string | null;
    estoqueSyncAt: string | null;
  };
}

export function useOverview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/site-vision/overview');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json);
        setError(null);
      } catch (err) {
        logger.error({ error: err }, '[useSiteVisionData] useOverview failed');
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  return { data, loading, error };
}

// ============================================================================
// PROJECTS HOOK
// ============================================================================

export interface ProjectsData {
  crmProjects: Array<{ id: number; nome: string; situacao: string | null; tipo: string | null }>;
  siteProjects: Array<{
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
    updatedAt: string;
    mediaCount: number;
  }>;
}

export function useProjects() {
  const [data, setData] = useState<ProjectsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/site-vision/projects');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json);
        setError(null);
      } catch (err) {
        logger.error({ error: err }, '[useSiteVisionData] useProjects failed');
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  return { data, loading, error };
}

// ============================================================================
// INVENTORY HOOK
// ============================================================================

export interface InventoryData {
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
    status: 'draft' | 'published' | 'archived' | 'sold';
    destaque: boolean;
    title: string;
    price: number | null;
    brokerName: string;
    heroImageUrl: string;
    updatedAt: string;
    cvUnitId: number;
    projectName: string | null;
    unitLabel: string;
  }>;
}

export function useInventory() {
  const [data, setData] = useState<InventoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/site-vision/inventory');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json);
        setError(null);
      } catch (err) {
        logger.error({ error: err }, '[useSiteVisionData] useInventory failed');
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  return { data, loading, error };
}

// ============================================================================
// ANALYTICS HOOK
// ============================================================================

export interface AnalyticsData {
  gatedAssets: Array<{
    id: string;
    title: string;
    slug: string;
    type: 'ebook' | 'brochure' | 'document';
    active: boolean;
    sizeBytes: number;
    updatedAt: string;
    projectName: string | null;
    leads: number;
  }>;
  topPages: Array<{
    pageType: string;
    pageKey: string;
    pagePath: string;
    views: number;
    uniqueSessions: number;
    leadSubmissions: number;
    ctaClicks: number;
    whatsappClicks: number;
    updatedAt: string;
  }>;
  topCtas: Array<{
    buttonName: string;
    total: number;
    latest: string | null;
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
  timestamps: {
    siteContentSyncAt: string | null;
  };
}

export function useAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/site-vision/analytics');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json);
        setError(null);
      } catch (err) {
        logger.error({ error: err }, '[useSiteVisionData] useAnalytics failed');
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  return { data, loading, error };
}
