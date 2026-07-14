import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { readResponsibles, nextResponsibleId, upsertResponsible, type Responsible } from '@/lib/db-kv';
import axios from 'axios';
import logger from '@/lib/logger'

const CACHE_KEY = 'cv_responsibles_cache';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutos

type ResponsiblesCache = {
  responsibles?: Responsible[];
  updatedAt?: string;
};

type CvCorretor = {
  idcorretor: string | number;
  nome: string;
  celular?: string;
  telefone?: string;
  email?: string;
  corretor_parceiro?: string;
  imobiliaria?: {
    nome_fantasia?: string;
  };
  imagem_perfil?: {
    avatar_imagem?: string;
  };
};

type ResponsibleBody = Pick<Responsible, 'name' | 'phone' | 'email' | 'company'> & {
  photo?: string;
  photoPosition?: Responsible['photoPosition'];
};

async function readCache(): Promise<Responsible[] | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { sql, ensureSchema } = await import('@/lib/pg');
    await ensureSchema();
    const rows = await sql`SELECT data FROM project_state WHERE key = ${CACHE_KEY} LIMIT 1`;
    if (!rows[0]) return null;
    const d = rows[0].data as ResponsiblesCache;
    if (d?.updatedAt && Date.now() - new Date(d.updatedAt).getTime() > CACHE_TTL_MS) {
      return null; // cache expirado
    }
    return d.responsibles || null;
  } catch (e) {
    logger.warn({ e }, '[responsibles/route] Falha ao ler cache do Postgres:');
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
    logger.warn({ e }, '[responsibles/route] Falha ao salvar cache no Postgres:');
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
    logger.info('[responsibles/route] Buscando corretores do CV CRM (V1)...');
    const headers = { email, token, Accept: 'application/json' };
    const response = await axios.get<CvCorretor[]>('https://longviewempreendimentos.cvcrm.com.br/api/v1/cadastros/corretores', {
      headers,
      params: { limit: 1000 },
      timeout: 15000
    });

    const list = response.data || [];
    const mapped: Responsible[] = list.map((c) => {
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
  } catch (e: unknown) {
    const message = axios.isAxiosError(e) ? e.message : e;
    logger.error({ message }, '[responsibles/route] Erro ao buscar corretores no CV CRM:');
    return [];
  }
}

export async function GET() {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const localResponsibles = await readResponsibles();

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
    logger.error({ error }, 'Erro na API de responsáveis:');
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}


export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const body = await request.json() as ResponsibleBody;

    const newResponsible: Responsible = {
      id: await nextResponsibleId(),
      name: body.name.trim(),
      phone: body.phone.trim() || '',
      email: body.email.trim() || '',
      company: body.company.trim() || 'LongView',
      photo: body.photo || undefined,
      photoPosition: body.photoPosition || undefined,
    };
    await upsertResponsible(newResponsible);

    return NextResponse.json({ responsible: newResponsible }, { status: 201 });
  } catch (error) {
    logger.error({ error }, 'Erro ao cadastrar responsável:');
    return NextResponse.json({ error: 'Erro ao processar requisição' }, { status: 500 });
  }
}
