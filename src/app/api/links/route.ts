import { NextRequest, NextResponse } from 'next/server';
import { verifyPermission } from '@/lib/auth';
import { readLinks, writeLinks, getClicks, delClick, ShortLink } from '@/lib/db-kv';

const PERM = 'viewMarketingDashboard'; // mesma permissão da tela de marketing

function genSlug(): string {
  return Math.random().toString(36).slice(2, 8);
}

// GET — lista links com contagem de cliques
export async function GET() {
  const user = await verifyPermission(PERM);
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const links = await readLinks();
  const clicks = await getClicks(links.map(l => l.slug));
  const withClicks = links
    .map(l => ({ ...l, clicks: clicks[l.slug] || 0 }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return NextResponse.json({ links: withClicks });
}

// POST — cria um link
export async function POST(request: NextRequest) {
  const user = await verifyPermission(PERM);
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = await request.json();
  const url = (body.url || '').trim();
  const title = (body.title || '').trim();
  let slug = (body.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');

  if (!title) return NextResponse.json({ error: 'Título é obrigatório.' }, { status: 400 });
  try { new URL(url); } catch { return NextResponse.json({ error: 'URL de destino inválida.' }, { status: 400 }); }

  const links = await readLinks();
  if (slug && links.some(l => l.slug === slug)) {
    return NextResponse.json({ error: 'Esse atalho (slug) já está em uso.' }, { status: 409 });
  }
  if (!slug) {
    do { slug = genSlug(); } while (links.some(l => l.slug === slug));
  }

  const link: ShortLink = {
    slug, url, title, active: true,
    createdAt: new Date().toISOString(),
    createdBy: user.name,
  };
  links.push(link);
  await writeLinks(links);

  return NextResponse.json({ link: { ...link, clicks: 0 } }, { status: 201 });
}

// PATCH — ativa/desativa ou edita destino/título  (body: { slug, active?, url?, title? })
export async function PATCH(request: NextRequest) {
  const user = await verifyPermission(PERM);
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = await request.json();
  const links = await readLinks();
  const i = links.findIndex(l => l.slug === body.slug);
  if (i === -1) return NextResponse.json({ error: 'Link não encontrado.' }, { status: 404 });

  if (typeof body.active === 'boolean') links[i].active = body.active;
  if (typeof body.title === 'string' && body.title.trim()) links[i].title = body.title.trim();
  if (typeof body.url === 'string' && body.url.trim()) {
    try { new URL(body.url.trim()); links[i].url = body.url.trim(); }
    catch { return NextResponse.json({ error: 'URL de destino inválida.' }, { status: 400 }); }
  }

  await writeLinks(links);
  return NextResponse.json({ link: links[i] });
}

// DELETE — remove o link e o contador  (?slug=...)
export async function DELETE(request: NextRequest) {
  const user = await verifyPermission(PERM);
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const slug = new URL(request.url).searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'slug é obrigatório.' }, { status: 400 });

  const links = await readLinks();
  await writeLinks(links.filter(l => l.slug !== slug));
  await delClick(slug);

  return NextResponse.json({ ok: true });
}
