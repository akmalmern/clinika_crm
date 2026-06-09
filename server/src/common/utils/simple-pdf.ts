/**
 * Tashqi kutubxonasiz minimal, to'g'ri PDF 1.4 hujjati (standart Helvetica).
 * latin1 (1 belgi = 1 bayt) -> xref ofsetlari aniq. To'liq Unicode — Phase 9.
 * Chek/hisob-faktura kabi oddiy matnli hujjatlar uchun (spec 5.5 / 7.9).
 */
export interface PdfLine {
  x: number;
  y: number;
  size: number;
  text: string;
}

export function renderSimplePdf(lines: PdfLine[]): Buffer {
  const content = lines
    .filter((l) => l.text.length > 0)
    .map(
      (l) =>
        `BT /F1 ${l.size} Tf 1 0 0 1 ${l.x} ${l.y} Tm (${escapePdf(toLatin1(l.text))}) Tj ET`,
    )
    .join('\n');

  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ' +
      '/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  const count = objects.length + 1;
  pdf += `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, 'latin1');
}

function escapePdf(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function toLatin1(s: string): string {
  let out = '';
  for (const ch of s) out += ch.charCodeAt(0) <= 0xff ? ch : '?';
  return out;
}
