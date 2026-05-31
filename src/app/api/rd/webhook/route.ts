import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export async function POST(request: NextRequest) {
  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const event_type = body.event_type || body.event?.type;
  const email = body.primary_data?.email || body.data?.LeadData?.email || body.payload?.email;

  console.log(`[rd/webhook] ${event_type} | ${email || 'sem email'}`);

  if (email) {
    try {
      await kv.set(`rd_event:${email}:${Date.now()}`, {
        event_type, email,
        nome: body.primary_data?.name || body.data?.LeadData?.name,
        uuid: body.primary_data?.uuid,
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
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
