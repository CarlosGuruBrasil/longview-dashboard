import { NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth';
import { hasProjectVisionData, readKv, readLocalProjectData, readProjectData, writeKv, writeProjectData } from '@/lib/db-kv';

export const runtime = 'nodejs';

function summarize(state: Awaited<ReturnType<typeof readProjectData>>) {
  return {
    tasks: state.tasks.length,
    projects: state.projects.length,
    responsibles: state.responsibles.length,
    healthy: hasProjectVisionData(state),
  };
}

export async function GET() {
  const admin = await verifyAdminAuth();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const [current, fallback, lastImport] = await Promise.all([
      readProjectData(),
      Promise.resolve(readLocalProjectData()),
      readKv('project_sheet_import_last', null),
    ]);

    return NextResponse.json({
      current: summarize(current),
      fallback: summarize(fallback),
      lastImport,
    });
  } catch (error) {
    console.error('[project-vision/health] error:', error);
    return NextResponse.json({ error: 'Erro ao diagnosticar Project Vision.' }, { status: 500 });
  }
}

export async function POST() {
  const admin = await verifyAdminAuth();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const current = await readProjectData();
    const fallback = readLocalProjectData();

    if (!hasProjectVisionData(fallback)) {
      return NextResponse.json({ error: 'Fallback local sem tarefas para restaurar.' }, { status: 400 });
    }

    await writeKv('project_vision_restore_backup', {
      backedUpAt: new Date().toISOString(),
      restoredBy: {
        userId: admin.userId,
        email: admin.email,
        name: admin.name,
      },
      summary: summarize(current),
      state: current,
    });

    await writeProjectData(fallback);

    return NextResponse.json({
      success: true,
      restored: summarize(fallback),
      previous: summarize(current),
    });
  } catch (error) {
    console.error('[project-vision/health] restore error:', error);
    return NextResponse.json({ error: 'Erro ao restaurar dados do Project Vision.' }, { status: 500 });
  }
}
