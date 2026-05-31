import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Função auxiliar para decodificar o payload do JWT de forma compatível com Edge Runtime
function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    // O Edge Runtime suporta atob nativamente
    const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = atob(payloadBase64);
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('auth_token')?.value;

  // 1. Permitir livre acesso a assets, imagens, favicon e à própria tela de login
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') || // rotas de api de auth (/api/auth/login)
    pathname === '/login' ||
    pathname === '/favicon.ico' ||
    pathname.includes('logo') || // imagens de logo
    pathname.includes('.')
  ) {
    // Se o usuário já está logado e tenta ir para /login, redireciona para a seleção de apps
    if (pathname === '/login' && token) {
      const payload = decodeJwtPayload(token);
      if (payload) {
        return NextResponse.redirect(new URL('/select-app', request.url));
      }
    }
    return NextResponse.next();
  }

  // 2. Se não possuir o token de autenticação, redireciona para /login
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 3. Decodificar o payload para ler permissões e perfil
  const payload = decodeJwtPayload(token);
  if (!payload) {
    // Token corrompido ou inválido, limpa e manda pro login
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('auth_token');
    return response;
  }

  const { permissions, role } = payload;

  // 4. Validação de rotas com base em permissões
  
  // Rota de Administração de Usuários
  if (pathname.startsWith('/admin')) {
    const isAdmin = role === 'Desenvolvedor' || permissions?.isAdmin === true;
    if (!isAdmin) {
      // Sem permissão de administrador, manda para seleção
      return NextResponse.redirect(new URL('/select-app', request.url));
    }
  }

  // Rota do Project Vision (App Michele)
  if (pathname.startsWith('/project-vision')) {
    const hasAccess = role === 'Desenvolvedor' || permissions?.viewProjectVision === true;
    if (!hasAccess) {
      return NextResponse.redirect(new URL('/select-app', request.url));
    }
  }

  // Rota do Marketing Vision (App Relatório)
  if (pathname.startsWith('/marketing-vision')) {
    const hasAccess = role === 'Desenvolvedor' || permissions?.viewMarketingDashboard === true;
    if (!hasAccess) {
      return NextResponse.redirect(new URL('/select-app', request.url));
    }
  }

  return NextResponse.next();
}

// Configurar as rotas que serão interceptadas
export const config = {
  matcher: [
    /*
     * Intercepta todas as rotas de páginas, exceto as descritas no matcher
     */
    '/((?!_next/static|_next/image|favicon.ico|api/auth).*)',
  ],
};
