import React from 'react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import jwt from 'jsonwebtoken';
import SalesVisionApp from './components/SalesVisionApp';

export const metadata: Metadata = {
  title: 'Sales Vision — LongView',
  description: 'Dashboard de performance de vendas e VGV',
};

const JWT_SECRET = process.env.JWT_SECRET || 'secret-longview-key';

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

export default async function SalesVisionPage() {
  const user = await verifyAuth();
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen bg-[#09090b] text-[#e5e5e5] font-sans">
      <SalesVisionApp />
    </div>
  );
}
