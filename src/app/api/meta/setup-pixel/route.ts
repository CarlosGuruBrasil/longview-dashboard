/**
 * ENDPOINT TEMPORÁRIO — será removido após setup
 * Cria um pixel Meta para a conta e retorna o ID.
 */
import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET() {
  const token  = process.env.META_TOKEN;
  const actId  = process.env.META_ACT_ID;

  if (!token || !actId) {
    return NextResponse.json({ error: 'META_TOKEN ou META_ACT_ID não configurados' }, { status: 500 });
  }

  // Verifica se já existe um pixel
  try {
    const listRes = await axios.get(`https://graph.facebook.com/v21.0/${actId}/adspixels`, {
      params: { fields: 'id,name,code', access_token: token },
      timeout: 10000,
    });
    const pixels = listRes.data?.data || [];
    if (pixels.length > 0) {
      return NextResponse.json({ existing: true, pixels });
    }
  } catch (e: any) {
    return NextResponse.json({ error: 'listar pixels: ' + (e.response?.data?.error?.message || e.message) }, { status: 500 });
  }

  // Cria novo pixel
  try {
    const res = await axios.post(
      `https://graph.facebook.com/v21.0/${actId}/adspixels`,
      null,
      {
        params: {
          name: 'Longview Empreendimentos — CAPI',
          access_token: token,
        },
        timeout: 15000,
      }
    );
    return NextResponse.json({ created: true, pixel_id: res.data.id, data: res.data });
  } catch (e: any) {
    return NextResponse.json({ error: 'criar pixel: ' + (e.response?.data?.error?.message || e.message) }, { status: 500 });
  }
}
