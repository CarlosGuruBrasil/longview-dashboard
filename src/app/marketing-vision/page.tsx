import React from 'react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import jwt from 'jsonwebtoken';
import MarketingVisionApp from './components/MarketingVisionApp';
import './style.css';

export const metadata: Metadata = {
  title: 'Marketing Vision — LongView',
  description: 'Dashboard de análise de clientes e negociações',
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

export default async function MarketingVisionPage() {
  const user = await verifyAuth();
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen bg-[#09090b] text-[#e5e5e5] font-sans">
      <MarketingVisionApp />
    </div>
  );
}
