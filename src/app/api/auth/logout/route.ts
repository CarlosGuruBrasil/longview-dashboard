import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const proto = request.headers.get('x-forwarded-proto') ?? 'http';
  const host  = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? 'localhost:3000';
  const response = NextResponse.redirect(`${proto}://${host}/login`);
  response.cookies.delete('auth_token');
  return response;
}
