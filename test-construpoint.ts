import { GET } from './src/app/api/construpoint/route';

async function test() {
  const req = new Request('http://localhost:3000/api/construpoint?startYear=2024&endYear=2026');
  const res = await GET(req);
  console.log(res.status);
  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
}

test().catch(console.error);
