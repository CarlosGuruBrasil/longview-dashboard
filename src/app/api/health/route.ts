import { NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/pg';

export async function GET() {
  try {
    await ensureSchema();
    return NextResponse.json(
      {
        ok: true,
        service: 'longview-dashboard',
        checkedAt: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        service: 'longview-dashboard',
        checkedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 503 }
    );
  }
}
