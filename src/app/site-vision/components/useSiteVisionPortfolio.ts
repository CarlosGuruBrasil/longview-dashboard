'use client';

import { useCallback, useEffect, useState } from 'react';
import logger from '@/lib/logger';

export type SiteVisionPortfolioPayload = {
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
};

export function useSiteVisionPortfolio() {
  const [data, setData] = useState<SiteVisionPortfolioPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/site-vision?scope=portfolio', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || 'Não foi possível carregar os empreendimentos.');
        setData(null);
        return;
      }
      setData(json);
    } catch (err) {
      logger.error({ err }, '[site-vision] falha ao carregar portfolio:');
      setError('Não foi possível carregar os empreendimentos.');
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
