import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', request.url));
  
  // Apaga o cookie contendo o token de autenticação
  response.cookies.delete('auth_token');
  
  return response;
}
