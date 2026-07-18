import { NextRequest, NextResponse } from 'next/server';
import { verifyPermission } from '@/lib/auth';
import { readUsers } from '@/lib/db-kv';
import { ensureSchema, sql } from '@/lib/pg';
import { pushUsuarios } from '@/lib/site-longview-client';
import logger from '@/lib/logger';

type TeamSettings = {
  hiddenUserIds: string[];
};

// Critério único e automático: quem é do time comercial ou corretor entra na lista do site
// sozinho, sem precisar de cadastro manual aqui. Colaborador novo com esse perfil no People
// Vision já aparece na próxima carga da página — a lista não é cacheada, é recalculada a cada
// request a partir do People Vision.
function isComercialTeam(user: Awaited<ReturnType<typeof readUsers>>[number]) {
  const department = (user.profile?.department ?? '').toLowerCase();
  return user.role === 'Corretor' || department === 'comercial';
}

async function readTeamSettings(): Promise<TeamSettings> {
  await ensureSchema();
  const rows = await sql<{ value: TeamSettings }[]>`
    SELECT value
    FROM site_public_settings
    WHERE key = 'site_team_visibility'
    LIMIT 1
  `;
  return rows[0]?.value ?? { hiddenUserIds: [] };
}

export async function GET() {
  const user = await verifyPermission('viewSiteVision');
  if (!user) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  try {
    const [users, settings] = await Promise.all([readUsers(), readTeamSettings()]);
    const hiddenIds = new Set(settings.hiddenUserIds ?? []);
    // Só entra na lista quem é Comercial ou Corretor — critério automático, não uma sugestão
    // manual. Visível por padrão; o toggle serve só pra exceção pontual (ex: alguém do time
    // comercial que não deve aparecer publicamente), não pra decidir quem é elegível.
    const team = users
      .filter(isComercialTeam)
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        email: entry.email,
        role: entry.role,
        phone: entry.profile?.phone ?? '',
        whatsapp: entry.profile?.whatsapp ?? '',
        position: entry.profile?.position ?? '',
        department: entry.profile?.department ?? '',
        company: entry.profile?.company ?? '',
        category: entry.profile?.category ?? '',
        avatarUrl: entry.profile?.avatarUrl ?? '',
        status: entry.profile?.status ?? 'ativo',
        professionalId: entry.profile?.professionalId ?? '',
        professionalIdType: entry.profile?.professionalIdType ?? '',
        suggested: entry.role === 'Corretor',
        visibleOnSite: !hiddenIds.has(entry.id),
      }));

    return NextResponse.json({ team, settings });
  } catch (error) {
    logger.error({ error }, '[site-vision/team] erro ao carregar equipe:');
    return NextResponse.json({ error: 'Erro ao carregar equipe do site.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const user = await verifyPermission('viewSiteVision');
  if (!user) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  try {
    const body = (await request.json()) as { hiddenUserIds?: unknown };
    const hiddenUserIds = Array.isArray(body.hiddenUserIds)
      ? body.hiddenUserIds.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];

    await ensureSchema();
    await sql`
      INSERT INTO site_public_settings (key, value, description, updated_by, updated_at)
      VALUES (
        'site_team_visibility',
        ${JSON.stringify({ hiddenUserIds })},
        'Excecoes manuais: quem do time comercial/corretor NAO deve aparecer no site publico.',
        ${user.name},
        NOW()
      )
      ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        description = EXCLUDED.description,
        updated_by = EXCLUDED.updated_by,
        updated_at = EXCLUDED.updated_at
    `;

    // Empurra pro site real todo o time comercial/corretor atual — a lista já é auto-filtrada
    // pelo perfil, então isso automaticamente inclui gente nova adicionada no People Vision e
    // desativa quem saiu do time comercial ou foi marcado como exceção.
    const hiddenSet = new Set(hiddenUserIds);
    const allUsers = await readUsers();
    const usuariosPush = allUsers
      .filter((entry) => isComercialTeam(entry) && entry.email)
      .map((entry) => ({
        nome: entry.name,
        email: entry.email,
        telefone: entry.profile?.whatsapp || entry.profile?.phone || null,
        creci: (entry.profile?.professionalIdType ?? '').toLowerCase() === 'creci' ? entry.profile?.professionalId ?? null : null,
        cargo: entry.profile?.position || entry.role,
        ativo: !hiddenSet.has(entry.id),
      }));

    if (usuariosPush.length > 0) {
      try {
        await pushUsuarios(usuariosPush);
      } catch (pushError) {
        logger.error({ pushError }, '[site-vision/team] falha ao sincronizar equipe com o site real');
        return NextResponse.json(
          { error: `Salvo localmente, mas não foi possível sincronizar com o site real: ${pushError instanceof Error ? pushError.message : pushError}` },
          { status: 502 }
        );
      }
    }

    return NextResponse.json({ ok: true, hiddenUserIds });
  } catch (error) {
    logger.error({ error }, '[site-vision/team] erro ao salvar equipe:');
    return NextResponse.json({ error: 'Erro ao salvar equipe do site.' }, { status: 500 });
  }
}
