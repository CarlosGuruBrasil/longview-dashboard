import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import jwt from 'jsonwebtoken';
import { SiteVisionOverview } from './components/SiteVisionShell';

export const metadata: Metadata = {
  title: 'Site Vision — LongView',
  description: 'Admin do site e leitura operacional das integrações LongView',
};

const JWT_SECRET = process.env.JWT_SECRET ?? (() => { throw new Error('[LongView] JWT_SECRET nao configurado. Defina no .env.local') })();

async function verifyAuth() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return null;
    return jwt.verify(token, JWT_SECRET) as { userId: string; email: string; role: string; name: string };
  } catch {
    return null;
  }
}

export default async function SiteVisionPage() {
  const user = await verifyAuth();
  if (!user) redirect('/login');

  return <SiteVisionOverview />;
}
