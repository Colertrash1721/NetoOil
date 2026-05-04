const numberFormat = new Intl.NumberFormat('es-DO', { maximumFractionDigits: 1 });

export function volume(value: number) {
  return `${numberFormat.format(value)} L`;
}

export function escapeCell(value: unknown) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
