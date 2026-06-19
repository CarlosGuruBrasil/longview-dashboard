import React from 'react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import jwt from 'jsonwebtoken';
import MarketingVisionApp from './components/MarketingVisionApp';
import type { DashboardApiResponse } from './types';
import './style.css';

export const metadata: Metadata = {
  title: 'Marketing Vision — LongView',
  description: 'Dashboard de análise de clientes e negociações',
};

const JWT_SECRET = process.env.JWT_SECRET || 'secret-longview-key';

async function verifyAuth() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return null;
    return jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: string; name: string };
  } catch {
    return null;
  }
}

async function fetchDashboardData(): Promise<DashboardApiResponse | null> {
  try {
    // Import pg directly — avoids an extra HTTP round-trip since we're on the server
    const { sql, ensureSchema } = await import('@/lib/pg');
    await ensureSchema();

    // ── Leads from Postgres ───────────────────────────────────────────────────
    const [countRow] = await sql<{ count: string }[]>`SELECT COUNT(*) AS count FROM leads`;
    const totalLeads = parseInt(countRow?.count ?? '0', 10);
    let leads: unknown[] = [];
    if (totalLeads > 0) {
      const rows = await sql`SELECT raw FROM leads ORDER BY data_cadastro DESC NULLS LAST` as { raw: unknown }[];
      leads = rows.map(r =>
        typeof r.raw === 'object' ? r.raw : JSON.parse(r.raw as string)
      );
    }

    // ── Meta + Estoque from cache ─────────────────────────────────────────────
    const CACHE_MAX_AGE_MS = 4 * 60 * 60 * 1000;
    const now = Date.now();

    const cacheRows = await sql<{ key: string; data: unknown }[]>`
      SELECT key, data FROM project_state WHERE key IN ('meta_cache', 'estoque_cache')
    `;

    let metaData = null;
    let estoqueData = { estoque: {} };

    for (const row of cacheRows) {
      const d = row.data as { updatedAt?: string; data?: unknown; estoque?: unknown };
      const age = d?.updatedAt ? now - new Date(d.updatedAt).getTime() : Infinity;
      if (age > CACHE_MAX_AGE_MS) continue;
      if (row.key === 'meta_cache' && d?.data) metaData = d.data;
      if (row.key === 'estoque_cache' && d?.estoque) estoqueData = d as typeof estoqueData;
    }

    const emptyMeta = {
      global: null, campaigns: [], campaignDetails: [], adsets: [],
      demographics: [], regions: [], platforms: [], devices: [],
      daily: [], leadForms: [], page: null,
    };

    return {
      leads:     { leads: leads as DashboardApiResponse['leads']['leads'], total: leads.length, crmTotal: leads.length },
      meta:      (metaData ?? emptyMeta) as DashboardApiResponse['meta'],
      estoque:   (estoqueData?.estoque ?? {}) as DashboardApiResponse['estoque'],
      leadForms: ((metaData as { leadForms?: DashboardApiResponse['leadForms'] } | null)?.leadForms) ?? [],
      page:      ((metaData as { page?: DashboardApiResponse['page'] } | null)?.page) ?? null,
      updatedAt: new Date().toISOString(),
      _cached:   true,
    };
  } catch (e) {
    console.error('[marketing-vision/page] SSR data fetch failed:', e);
    return null;
  }
}

export default async function MarketingVisionPage() {
  const user = await verifyAuth();
  if (!user) redirect('/login');

  const initialData = await fetchDashboardData();

  return (
    <div className="min-h-screen bg-[#09090b] text-[#e5e5e5] font-sans">
      <MarketingVisionApp initialData={initialData ?? undefined} />
    </div>
  );
}
