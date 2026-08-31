/**
 * Builds a tiny, valid single-page PDF so the seed can put real, previewable
 * documents in storage without committing binaries to the repository.
 */
export function buildSamplePdf(title: string, body: string[]): Buffer {
  const lines = [
    `BT /F1 20 Tf 72 720 Td (${escapePdfText(title)}) Tj ET`,
    ...body.map(
      (line, index) =>
        `BT /F1 12 Tf 72 ${680 - index * 20} Td (${escapePdfText(line)}) Tj ET`,
    ),
  ].join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${lines.length} >>\nstream\n${lines}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];

  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'latin1');
}

function escapePdfText(value: string): string {
  return value.replace(/([\\()])/g, '\\$1');
}
