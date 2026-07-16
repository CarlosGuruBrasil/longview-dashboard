import { NextResponse } from 'next/server';
import { verifyPermission } from '@/lib/auth';
import { readProjects, readUsers } from '@/lib/db-kv';
import { sql } from '@/lib/pg';
import logger from '@/lib/logger';

type CountRow = { total: string | number };
type LatestSyncRow = { latest: string | null };
type LeadStatusRow = { status: string | null; total: string | number };

function asNumber(value: string | number | null | undefined): number {
  return Number(value ?? 0);
}

export async function GET() {
  const user = await verifyPermission('viewSiteVision');
  if (!user) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  }

  try {
    const [projects, users] = await Promise.all([readProjects(), readUsers()]);

    const [
      crmProjectsCountRows,
      leadsCountRows,
      leadsStatusRows,
      unitsCountRows,
      soldUnitsCountRows,
      materialsCountRows,
      latestLeadSyncRows,
      latestStockSyncRows,
    ] = await Promise.all([
      sql<CountRow[]>`SELECT COUNT(*) AS total FROM cv_empreendimentos`,
      sql<CountRow[]>`SELECT COUNT(*) AS total FROM leads`,
      sql<LeadStatusRow[]>`
        SELECT COALESCE(status, 'Sem status') AS status, COUNT(*) AS total
        FROM leads
        GROUP BY status
      `,
      sql<CountRow[]>`SELECT COUNT(*) AS total FROM cv_unidades`,
      sql<CountRow[]>`SELECT COUNT(*) AS total FROM cv_unidades WHERE status ILIKE '%vend%' OR status_venda = 3`,
      sql<CountRow[]>`SELECT COUNT(*) AS total FROM cv_materiais`,
      sql<LatestSyncRow[]>`SELECT MAX(synced_at)::text AS latest FROM leads`,
      sql<LatestSyncRow[]>`SELECT MAX(synced_at)::text AS latest FROM cv_empreendimentos`,
    ]);

    const userBreakdown = users.reduce(
      (acc, current) => {
        acc.total += 1;
        if (current.permissions?.isAdmin === true || current.role === 'Desenvolvedor') acc.admins += 1;
        if (current.role === 'Corretor') acc.corretores += 1;
        if (current.role === 'Parceiro') acc.parceiros += 1;
        return acc;
      },
      { total: 0, admins: 0, corretores: 0, parceiros: 0 }
    );

    return NextResponse.json({
      overview: {
        crmProjects: asNumber(crmProjectsCountRows[0]?.total),
        leads: asNumber(leadsCountRows[0]?.total),
        units: asNumber(unitsCountRows[0]?.total),
        soldUnits: asNumber(soldUnitsCountRows[0]?.total),
        materials: asNumber(materialsCountRows[0]?.total),
        users: userBreakdown,
      },
      leadStatus: leadsStatusRows.map((row) => ({
        status: row.status ?? 'Sem status',
        total: asNumber(row.total),
      })),
      timestamps: {
        leadsSyncAt: latestLeadSyncRows[0]?.latest ?? null,
        estoqueSyncAt: latestStockSyncRows[0]?.latest ?? null,
      },
    });
  } catch (error) {
    logger.error({ error }, '[site-vision/overview] error:');
    return NextResponse.json({ error: 'Erro ao carregar overview.' }, { status: 500 });
  }
}
