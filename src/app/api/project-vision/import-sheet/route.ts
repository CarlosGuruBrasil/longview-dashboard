import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth';
import { readProjectData, writeKv, writeProjectData } from '@/lib/db-kv';
import { buildProjectDataFromCsv, buildProjectDataFromXlsx, readProjectDataFromDefaultSheet } from '@/lib/project-sheet-import';

export const runtime = 'nodejs';

interface ImportSheetBody {
  csv?: string;
  xlsxBase64?: string;
  fileName?: string;
  dryRun?: boolean;
}

async function parseImport(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const file = form.get('file');
    const dryRun = form.get('dryRun') !== 'false';

    if (!(file instanceof File)) {
      throw new Error('Arquivo obrigatório.');
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const fileName = file.name || 'upload';
    const lowerName = fileName.toLowerCase();

    if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xlsm') || lowerName.endsWith('.xls')) {
      return {
        dryRun,
        ...buildProjectDataFromXlsx(bytes, fileName),
      };
    }

    if (lowerName.endsWith('.csv') || file.type.includes('csv')) {
      return {
        dryRun,
        ...buildProjectDataFromCsv(bytes.toString('utf-8'), fileName),
      };
    }

    throw new Error('Formato não suportado. Envie .xlsx ou .csv.');
  }

  const body = await request.json().catch(() => ({})) as ImportSheetBody;
  if (body.xlsxBase64?.trim()) {
    return {
      dryRun: body.dryRun !== false,
      ...buildProjectDataFromXlsx(Buffer.from(body.xlsxBase64, 'base64'), body.fileName || 'request body xlsx'),
    };
  }

  if (body.csv?.trim()) {
    return {
      dryRun: body.dryRun !== false,
      ...buildProjectDataFromCsv(body.csv, 'request body'),
    };
  }

  return {
    dryRun: body.dryRun !== false,
    ...readProjectDataFromDefaultSheet(),
  };
}

export async function GET() {
  const admin = await verifyAdminAuth();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { report } = readProjectDataFromDefaultSheet();
    return NextResponse.json({ dryRun: true, report });
  } catch (error) {
    console.error('[project-vision/import-sheet] dry-run error:', error);
    return NextResponse.json({ error: 'Erro ao ler planilha.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdminAuth();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { dryRun, state, report } = await parseImport(request);

    if (dryRun) {
      return NextResponse.json({ dryRun: true, report });
    }

    const previousState = await readProjectData();
    await writeKv('project_sheet_import_backup', {
      backedUpAt: new Date().toISOString(),
      tasks: previousState.tasks.length,
      projects: previousState.projects.length,
      responsibles: previousState.responsibles.length,
      state: previousState,
    });

    await writeProjectData(state);
    await writeKv('project_sheet_import_last', {
      ...report,
      importedBy: {
        userId: admin.userId,
        email: admin.email,
        name: admin.name,
      },
    });

    return NextResponse.json({ success: true, report });
  } catch (error) {
    console.error('[project-vision/import-sheet] import error:', error);
    return NextResponse.json({ error: 'Erro ao importar planilha.' }, { status: 500 });
  }
}
