import { NextRequest, NextResponse } from 'next/server';
import { verifyPermission } from '@/lib/auth';
import { readUsers } from '@/lib/db-kv';
import { ensureSchema, sql } from '@/lib/pg';
import { pushUsuarios } from '@/lib/site-longview-client';
import logger from '@/lib/logger';

type TeamSettings = {
  visibleUserIds: string[];
};

function isBrokerCandidate(user: Awaited<ReturnType<typeof readUsers>>[number]) {
  const position = (user.profile?.position ?? '').toLowerCase();
  const professionalType = (user.profile?.professionalIdType ?? '').toLowerCase();
  return (
    user.role === 'Corretor' ||
    professionalType === 'creci' ||
    position.includes('corretor') ||
    position.includes('consultor')
  );
}

async function readTeamSettings(): Promise<TeamSettings> {
  await ensureSchema();
  const rows = await sql<{ value: TeamSettings }[]>`
    SELECT value
    FROM site_public_settings
    WHERE key = 'site_team_visibility'
    LIMIT 1
  `;
  return rows[0]?.value ?? { visibleUserIds: [] };
}

export async function GET() {
  const user = await verifyPermission('viewSiteVision');
  if (!user) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  try {
    const [users, settings] = await Promise.all([readUsers(), readTeamSettings()]);
    const hasSavedSelection = (settings.visibleUserIds ?? []).length > 0;
    const visibleIds = new Set(settings.visibleUserIds ?? []);
    // Lista completa do People Vision — nada fica escondido atrás de heurística.
    // Quem bate no heurístico de corretor vem pré-marcado como sugestão até o usuário salvar
    // uma seleção manual pela primeira vez.
    const team = users.map((entry) => ({
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
      suggested: isBrokerCandidate(entry),
      visibleOnSite: hasSavedSelection ? visibleIds.has(entry.id) : isBrokerCandidate(entry),
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
    const body = (await request.json()) as { visibleUserIds?: unknown };
    const visibleUserIds = Array.isArray(body.visibleUserIds)
      ? body.visibleUserIds.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];

    await ensureSchema();
    const previousSettings = await readTeamSettings();
    const previousVisibleIds = new Set(previousSettings.visibleUserIds ?? []);
    await sql`
      INSERT INTO site_public_settings (key, value, description, updated_by, updated_at)
      VALUES (
        'site_team_visibility',
        ${JSON.stringify({ visibleUserIds })},
        'Controle de corretores/equipe visiveis no site publico.',
        ${user.name},
        NOW()
      )
      ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        description = EXCLUDED.description,
        updated_by = EXCLUDED.updated_by,
        updated_at = EXCLUDED.updated_at
    `;

    // Empurra pro site real quem está selecionado agora, mais quem estava selecionado antes e
    // saiu da seleção (pra desativar de verdade lá, não só parar de mandar). Não manda a base
    // inteira de usuários — só quem é relevante pra essa mudança, pra não poluir a tabela do site.
    const visibleSet = new Set(visibleUserIds);
    const affectedIds = new Set([...visibleSet, ...previousVisibleIds]);
    const allUsers = await readUsers();
    const usuariosPush = allUsers
      .filter((entry) => affectedIds.has(entry.id) && entry.email)
      .map((entry) => ({
        nome: entry.name,
        email: entry.email,
        telefone: entry.profile?.whatsapp || entry.profile?.phone || null,
        creci: (entry.profile?.professionalIdType ?? '').toLowerCase() === 'creci' ? entry.profile?.professionalId ?? null : null,
        cargo: entry.profile?.position || entry.role,
        ativo: visibleSet.has(entry.id),
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

    return NextResponse.json({ ok: true, visibleUserIds });
  } catch (error) {
    logger.error({ error }, '[site-vision/team] erro ao salvar equipe:');
    return NextResponse.json({ error: 'Erro ao salvar equipe do site.' }, { status: 500 });
  }
}
