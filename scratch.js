import postgres from 'postgres';
const sql = postgres({ max: 1 });

const obra = 'Test';
const status = null;

const inspFilters = sql`
  ${obra ? sql`AND i.obra = ${obra}` : sql``}
  ${status ? sql`AND i.status = ${status}` : sql``}
`;

const q = sql`
  SELECT * FROM test
  WHERE true
  ${inspFilters}
  GROUP BY 1
`;

console.log(q);
process.exit(0);
