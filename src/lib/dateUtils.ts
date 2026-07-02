export function parseCrmDate(val: unknown): Date | null {
  if (!val) return null;
  const str = String(val).trim();
  if (str.includes('/')) {
    const parts = str.split(' ');
    const datePart = parts[0];
    const timePart = parts[1] || '00:00:00';
    const [d, m, y] = datePart.split('/');
    if (d && m && y) {
      const isoStr = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${timePart}`;
      const parsed = new Date(isoStr);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
  }
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}
