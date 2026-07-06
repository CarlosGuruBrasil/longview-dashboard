/**
 * lib/auth.ts
 * Helpers centralizados de autenticação — evita duplicação de código
 * nas API routes (verifyAuth estava replicado em 4+ arquivos).
 */

import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET ?? (() => { throw new Error('[LongView] JWT_SECRET nao configurado. Defina no .env.local') })();

export interface AuthUser {
  userId:      string;
  name:        string;
  email:       string;
  role:        'Desenvolvedor' | 'Diretoria' | 'Operador' | 'Gestor' | 'Parceiro' | 'Corretor' | 'Visualizador';
  permissions: Record<string, boolean>;
}

/**
 * Verifica o JWT do cookie e retorna o payload decodificado.
 * Retorna null se não autenticado ou token inválido.
 */
export async function verifyAuth(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return null;
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
}

/**
 * Verifica se o usuário autenticado é administrador (Desenvolvedor ou isAdmin).
 */
export async function verifyAdminAuth(): Promise<AuthUser | null> {
  const user = await verifyAuth();
  if (!user) return null;
  if (user.role === 'Desenvolvedor' || user.permissions?.isAdmin === true) {
    return user;
  }
  return null;
}

/**
 * Verifica permissão específica no payload do JWT.
 */
export async function verifyPermission(permission: string): Promise<AuthUser | null> {
  const user = await verifyAuth();
  if (!user) return null;
  if (user.role === 'Desenvolvedor') return user; // Desenvolvedor tem tudo
  if (user.permissions?.[permission] === true) return user;
  return null;
}
