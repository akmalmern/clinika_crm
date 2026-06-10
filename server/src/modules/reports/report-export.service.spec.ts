import { ReportExportService } from './report-export.service';

/**
 * Eksport (CSV/PDF) — DoD: eksport ishlaydi. CSV: UTF-8 BOM + RFC-4180 qochirish.
 * PDF: to'g'ri %PDF hujjati. Pul string bo'lib keladi (Decimal — Float EMAS).
 */
describe('ReportExportService', () => {
  const service = new ReportExportService();
  const table = {
    title: 'Daromad',
    headers: ['Davr', 'Soni', 'Summa'],
    rows: [
      ['2026-06-01', 3, '1500000'],
      ['2026-06-02', 1, '500000'],
    ] as (string | number)[][],
  };

  it('csv: BOM + sarlavha + qatorlar (CRLF)', () => {
    const out = service.build('csv', table, 'daromad');
    expect(out.contentType).toContain('text/csv');
    expect(out.fileName).toBe('daromad.csv');
    const text = out.buffer.toString('utf8');
    expect(text.charCodeAt(0)).toBe(0xfeff); // BOM
    expect(text).toContain('Davr,Soni,Summa');
    expect(text).toContain('2026-06-01,3,1500000');
    expect(text).toContain('\r\n');
  });

  it('csv: vergul/qo`shtirnoq qochiriladi (RFC-4180)', () => {
    const buf = service.csv({
      title: 't',
      headers: ['Nom'],
      rows: [['Klinika, "A"']],
    });
    const text = buf.toString('utf8');
    expect(text).toContain('"Klinika, ""A"""');
  });

  it('pdf: %PDF hujjat qaytaradi', () => {
    const out = service.build('pdf', table, 'daromad');
    expect(out.contentType).toBe('application/pdf');
    expect(out.fileName).toBe('daromad.pdf');
    expect(out.buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it("noma'lum format -> CSV (default xavfsiz)", () => {
    const out = service.build('xlsx', table, 'x');
    expect(out.contentType).toContain('text/csv');
  });
});
