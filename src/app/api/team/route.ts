import { NextResponse } from 'next/server';
import { listPublicTeamMembers } from '@/lib/site-public';
import logger from '@/lib/logger';

export async function GET() {
  try {
    const team = await listPublicTeamMembers();
    return NextResponse.json(team);
  } catch (error) {
    logger.error({ error }, '[api/team] error');
    return NextResponse.json({ error: 'Erro ao carregar equipe' }, { status: 500 });
  }
}
