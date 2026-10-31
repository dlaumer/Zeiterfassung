export interface SubjectImportRow {
  number: string;
  key: string;
  label: string;
  credits: number;
}

function normalizeImportCell(value: unknown) {
  return String(value ?? '').trim();
}

function getImportCell(row: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    const value = normalizeImportCell(row[name]);
    if (value) {
      return value;
    }
  }

  return '';
}

export async function parseSubjectImportRows(fileData: ArrayBuffer): Promise<SubjectImportRow[]> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(fileData, { type: 'array' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' });
  const seenKeys = new Set<string>();

  return rows
    .map((row) => {
      const label = getImportCell(row, ['Modulname DE / EN', 'Modulname', 'Module name', 'Label']);
      const key = getImportCell(row, ['Key', 'Kürzel', 'Kuerzel']) || label;
      const credits = Number(getImportCell(row, ['Anzahl ECTS', 'ECTS', 'Credits']) || 0);

      return {
        number: getImportCell(row, ['LE-Nummer', 'LE Nummer', 'Number']),
        key,
        label,
        credits: Number.isFinite(credits) ? Math.max(0, credits) : 0,
      };
    })
    .filter((row) => row.key && row.label)
    .filter((row) => {
      const normalizedKey = row.key.toLowerCase();
      if (seenKeys.has(normalizedKey)) {
        return false;
      }
      seenKeys.add(normalizedKey);
      return true;
    });
}
