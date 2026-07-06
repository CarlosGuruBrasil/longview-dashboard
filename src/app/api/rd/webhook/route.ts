import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@/lib/kv';
import logger from '@/lib/logger'

type JsonObject = Record<string, unknown>;

function obj(value: unknown): JsonObject {
  return typeof value === 'object' && value !== null ? value as JsonObject : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

export async function POST(request: NextRequest) {
  let body: JsonObject;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const event = obj(body.event);
  const primaryData = obj(body.primary_data);
  const data = obj(body.data);
  const leadData = obj(data.LeadData);
  const payload = obj(body.payload);

  const event_type = text(body.event_type || event.type);
  const email = text(primaryData.email || leadData.email || payload.email);

  logger.info(`[rd/webhook] $ | $`);

  if (email) {
    try {
      await kv.set(`rd_event:${email}:${Date.now()}`, {
        event_type, email,
        nome: primaryData.name || leadData.name,
        uuid: primaryData.uuid,
        received_at: new Date().toISOString(),
        raw: body,
      }, { ex: 86400 });
    } catch { /* non-critical */ }
  }

  return NextResponse.json({ received: true, event_type, email });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  try {
    const pattern = email ? `rd_event:${email}:*` : 'rd_event:*';
    const keys = await kv.keys(pattern);
    const events = await Promise.all(keys.slice(-20).map(k => kv.get(k)));
    return NextResponse.json({ events: events.filter(Boolean), count: events.length });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
