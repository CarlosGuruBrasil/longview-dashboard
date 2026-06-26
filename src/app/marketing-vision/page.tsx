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
    return jwt.verify(token, JWT_SECRET) as { userId: string; email: string; role: string; name: string };
  } catch {
    return null;
  }
}

function filterLeadsForUser<T extends { corretor?: { email?: string; nome?: string }; gestor?: { email?: string; nome?: string } }>(
  leads: T[],
  user: { email: string; name: string; role: string }
): T[] {
  const privileged = ['Gestor', 'Diretoria', 'Desenvolvedor'];
  if (privileged.includes(user.role)) return leads;

  const myEmail = String(user.email || '').toLowerCase().trim();
  const myName = String(user.name || '').toLowerCase().trim();
  return leads.filter((lead) => {
    const emails = [lead.corretor?.email, lead.gestor?.email]
      .filter(Boolean)
      .map((email) => String(email).toLowerCase().trim());
    if (myEmail && emails.includes(myEmail)) return true;

    const names = [lead.corretor?.nome, lead.gestor?.nome]
      .filter(Boolean)
      .map((name) => String(name).toLowerCase().trim());
    return !!myName && names.includes(myName);
  });
}

async function fetchDashboardData(user: { email: string; role: string; name: string }): Promise<DashboardApiResponse | null> {
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
    // Sempre serve do Postgres independente da idade — o cron é responsável por
    // manter o cache fresco. Não expiramos aqui para evitar chamadas ao vivo
    // durante o carregamento de página (isso travava o dashboard por 15-30s).
    const cacheRows = await sql<{ key: string; data: unknown }[]>`
      SELECT key, data FROM project_state WHERE key IN ('meta_cache', 'estoque_cache')
    `;

    let metaData = null;
    let estoqueData = { estoque: {} };

    for (const row of cacheRows) {
      const d = row.data as { updatedAt?: string; data?: unknown; estoque?: unknown };
      if (row.key === 'meta_cache' && d?.data) metaData = d.data;
      if (row.key === 'estoque_cache' && d?.estoque) estoqueData = d as typeof estoqueData;
    }

    const emptyMeta = {
      global: null, campaigns: [], campaignDetails: [], adsets: [],
      demographics: [], regions: [], platforms: [], devices: [],
      daily: [], leadForms: [], page: null,
    };

    const scopedLeads = filterLeadsForUser(leads as DashboardApiResponse['leads']['leads'], user);

    return {
      leads:     { leads: scopedLeads, total: scopedLeads.length, crmTotal: scopedLeads.length },
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

  const initialData = await fetchDashboardData(user);

  return (
    <div className="min-h-screen bg-[#09090b] text-[#e5e5e5] font-sans">
      <MarketingVisionApp initialData={initialData ?? undefined} />
    </div>
  );
}
