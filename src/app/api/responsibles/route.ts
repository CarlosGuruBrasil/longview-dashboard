import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { readProjectData, mutateProjectData, Responsible } from '@/lib/db-kv';
import axios from 'axios';

const CACHE_KEY = 'cv_responsibles_cache';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutos

async function readCache(): Promise<Responsible[] | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { sql, ensureSchema } = await import('@/lib/pg');
    await ensureSchema();
    const rows = await sql`SELECT data FROM project_state WHERE key = ${CACHE_KEY} LIMIT 1`;
    if (!rows[0]) return null;
    const d = rows[0].data as any;
    if (d?.updatedAt && Date.now() - new Date(d.updatedAt).getTime() > CACHE_TTL_MS) {
      return null; // cache expirado
    }
    return d.responsibles || null;
  } catch (e) {
    console.warn('[responsibles/route] Falha ao ler cache do Postgres:', e);
    return null;
  }
}

async function saveCache(responsibles: Responsible[]): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    const { sql, ensureSchema } = await import('@/lib/pg');
    await ensureSchema();
    const payload = {
      responsibles,
      updatedAt: new Date().toISOString()
    };
    await sql`
      INSERT INTO project_state (key, data)
      VALUES (${CACHE_KEY}, ${JSON.stringify(payload)})
      ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data
    `;
  } catch (e) {
    console.warn('[responsibles/route] Falha ao salvar cache no Postgres:', e);
  }
}

async function fetchCvcrmCorretores(): Promise<Responsible[]> {
  const email = process.env.CV_CRM_EMAIL;
  const token = process.env.CV_CRM_TOKEN;
  if (!email || !token) return [];

  const cached = await readCache();
  if (cached) {
    return cached;
  }

  try {
    console.log('[responsibles/route] Buscando corretores do CV CRM (V1)...');
    const headers = { email, token, Accept: 'application/json' };
    const response = await axios.get('https://longviewempreendimentos.cvcrm.com.br/api/v1/cadastros/corretores', {
      headers,
      params: { limit: 1000 },
      timeout: 15000
    });

    const list = response.data || [];
    const mapped: Responsible[] = list.map((c: any) => {
      const phone = c.celular || c.telefone || '';
      let company = 'LongView';
      if (c.corretor_parceiro === 'S') {
        company = c.imobiliaria?.nome_fantasia || 'Parceiro';
      } else if (c.imobiliaria?.nome_fantasia) {
        company = c.imobiliaria.nome_fantasia;
      }
      const photo = c.imagem_perfil?.avatar_imagem || undefined;

      return {
        id: `resp-cv-${c.idcorretor}`,
        name: c.nome,
        phone,
        email: c.email || '',
        company,
        photo
      };
    });

    await saveCache(mapped);
    return mapped;
  } catch (e: any) {
    console.error('[responsibles/route] Erro ao buscar corretores no CV CRM:', e.message);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const db = await readProjectData();
    const localResponsibles = db.responsibles || [];

    let cvResponsibles: Responsible[] = [];
    if (process.env.CV_CRM_EMAIL && process.env.CV_CRM_TOKEN) {
      cvResponsibles = await fetchCvcrmCorretores();
    }

    const seenEmails = new Set<string>();
    const seenNames = new Set<string>();
    const merged: Responsible[] = [];

    cvResponsibles.forEach(r => {
      merged.push(r);
      if (r.email) seenEmails.add(r.email.toLowerCase().trim());
      if (r.name) seenNames.add(r.name.toLowerCase().trim());
    });

    localResponsibles.forEach(r => {
      const emailKey = r.email ? r.email.toLowerCase().trim() : '';
      const nameKey = r.name ? r.name.toLowerCase().trim() : '';
      const duplicate = (emailKey && seenEmails.has(emailKey)) || (nameKey && seenNames.has(nameKey));
      if (!duplicate) {
        merged.push(r);
        if (emailKey) seenEmails.add(emailKey);
        if (nameKey) seenNames.add(nameKey);
      }
    });

    return NextResponse.json({ responsibles: merged });
  } catch (error) {
    console.error('Erro na API de responsáveis:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}


export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const body = await request.json();
    let newResponsible: Responsible | undefined;

    await mutateProjectData((db) => {
      if (!db.responsibles) db.responsibles = [];
      const lastId = db.responsibles.length > 0
        ? Math.max(...db.responsibles.map(r => parseInt(r.id.replace('resp-', '')) || 0))
        : 0;
      newResponsible = {
        id: `resp-${lastId + 1}`,
        name: body.name.trim(),
        phone: body.phone.trim() || '',
        email: body.email.trim() || '',
        company: body.company.trim() || 'LongView',
        photo: body.photo || undefined,
      };
      db.responsibles.push(newResponsible!);
    });

    return NextResponse.json({ responsible: newResponsible }, { status: 201 });
  } catch (error) {
    console.error('Erro ao cadastrar responsável:', error);
    return NextResponse.json({ error: 'Erro ao processar requisição' }, { status: 500 });
  }
}
