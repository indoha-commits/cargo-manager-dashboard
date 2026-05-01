/**
 * Parser for the Rwanda e-Single Window "Document List" PostScript report.
 *
 * Accepts two formats:
 *   1) Raw .ps file  → attempts to extract hex-encoded text strings and infer metadata
 *   2) .txt file     → ps2ascii output (fragmented multi-column text)
 *
 * For .txt (ps2ascii output), we use pattern-based column reconstruction
 * since ps2ascii renders each column character-by-character across multiple lines.
 */

export type ReportRow = {
  no: number;
  year: string;
  office: string;
  reg_ser: string;
  reg_num: string;
  reg_date: string;
  type: string;
  gen_proc: string;
  items: string;
  consignee: string;
  total_taxes: string;
  description: string;
  ast_ser: string;
  ast_num: string;
  ast_date: string;
  color: string;
  price_per_dmc: string;
};

export type ParseResult = {
  rows: ReportRow[];
  totalDmc: number;
  totalPrice: number;
  reportDate: string;
  selectionCriteria: Record<string, string>;
  errors: string[];
};

// ── Pattern-based extraction ──────────────────────────────────────────────────
const YEAR_RE    = /\b(20\d\d)\b/;
const OFFICE_RE  = /\b(1[0-9][A-Z]{2,5}|KE[A-Z]{2,4})\b/;
const TYPE_RE    = /\b(IM|EX|TT|TR)\b/;
const COLOR_RE   = /\b(Green|Blue|Red|Yellow|Orange|Grey)\b/i;
const TIN_RE     = /\b(1\d{8})\b/;

/**
 * Reconstruct a single data record from its N fragment lines (ps2ascii output).
 * Each record is rendered as multiple lines because each column character is
 * a separate bitmap in the original PostScript; ps2ascii stacks them vertically.
 */
function reconstructRecord(lines: string[]): string {
  if (lines.length === 0) return '';
  // Pad all lines to the same length
  const maxLen = Math.max(...lines.map((l) => l.length));
  const padded = lines.map((l) => l.padEnd(maxLen, ' '));
  // For each character position, take the first non-space character across lines
  const result: string[] = [];
  for (let col = 0; col < maxLen; col++) {
    let ch = ' ';
    for (const line of padded) {
      const c = line[col];
      if (c && c !== ' ') { ch = c; break; }
    }
    result.push(ch);
  }
  return result.join('');
}

/**
 * Extract field values from a reconstructed record line using regex patterns.
 * This is more robust than fixed column positions since ps2ascii alignment varies.
 */
function parseReconstructedRecord(combined: string, rowNo: number): ReportRow | null {
  const text = combined.trim();
  if (!text || text.length < 10) return null;

  // Extract all dates
  const dates: string[] = [];
  let m: RegExpExecArray | null;
  const dateRe = /\b(20\d\d-\d{2}-\d{2})\b/g;
  while ((m = dateRe.exec(text)) !== null) dates.push(m[1]);

  // Extract year (first 4-digit year, may not be standalone if dates present)
  const yearMatch = YEAR_RE.exec(text);
  const year = yearMatch ? yearMatch[1] : '2026';

  // Extract office code
  const officeMatch = OFFICE_RE.exec(text);
  const office = officeMatch ? officeMatch[1] : '';

  // Extract type
  const typeMatch = TYPE_RE.exec(text);
  const type = typeMatch ? typeMatch[1] : 'IM';

  // Extract color
  const colorMatch = COLOR_RE.exec(text);
  const color = colorMatch ? colorMatch[1] : '';

  // Extract consignee (9-digit TIN)
  const tinMatch = TIN_RE.exec(text);
  const consignee = tinMatch ? tinMatch[1] : '';

  // Extract all numbers
  const numbers: string[] = [];
  const numRe = /\b(\d{2,9})\b/g;
  while ((m = numRe.exec(text)) !== null) {
    // Skip dates we already found
    if (!dates.some((d) => d.includes(m![1]))) {
      numbers.push(m[1]);
    }
  }

  // Reg.Ser is typically "C" - find isolated single uppercase letter
  const regSerMatch = /\bC\b/.exec(text);
  const reg_ser = regSerMatch ? 'C' : '';

  // Reg.Num: typically a 2-4 digit number (after year and office)
  // Total Taxes: typically a 5-7 digit number
  // Ast.Num: similar to a 3-5 digit number

  // Heuristic: find numbers that could be Reg.Num (3-4 digits, after year)
  const shortNums = numbers.filter((n) => n.length >= 2 && n.length <= 4 && !['4', '12', '1', '2', '3'].includes(n));
  const longNums = numbers.filter((n) => n.length >= 5);

  const reg_num = shortNums[0] ?? '';
  const total_taxes = longNums.find((n) => n.length >= 5 && n.length <= 7 && n !== consignee) ?? '';
  const ast_num = shortNums.find((n) => n !== reg_num) ?? '';

  // Gen.Proc is typically "4"
  const genProcMatch = /\b4\b/.exec(text);
  const gen_proc = genProcMatch ? '4' : '';

  // Items: typically a small number
  const itemsMatch = /\b([1-9][0-9]?)\b/.exec(text.slice(50, 80));
  const items = itemsMatch ? itemsMatch[1] : '1';

  // Ast.Ser: typically "L"
  const astSerMatch = /\bL\b/.exec(text);
  const ast_ser = astSerMatch ? 'L' : '';

  // Description: often "-" or a product category
  const descMatch = /\b(Bottles|Spirits|Spirit|Wine|Beer|Beverages|-)\b/i.exec(text);
  const description = descMatch ? descMatch[1] : '-';

  if (!year || !office) return null;

  return {
    no: rowNo,
    year,
    office,
    reg_ser: reg_ser || 'C',
    reg_num,
    reg_date: dates[0] ?? '',
    type,
    gen_proc,
    items,
    consignee,
    total_taxes,
    description,
    ast_ser,
    ast_num,
    ast_date: dates[1] ?? '',
    color,
    price_per_dmc: '118,000 RWF',
  };
}

// ── TSV / tab-separated format parser ────────────────────────────────────────
// When the .txt file exported from Rwanda e-Single Window uses tabs as delimiters
// (one line = one declaration row) we parse it directly without column reconstruction.
//
// Confirmed column layout from sample data:
//  [0]  Year          [1]  Office        [2]  Agent TIN (skip)
//  [3]  Reg.Ref/Num   [4]  Reg.Ser       [5]  Seq# (skip)
//  [6]  Reg.Date      [7]  Type          [8]  Gen.Proc
//  [9]  Items         [10] (empty)       [11] Consignee TIN
//  [12] Total Taxes   [13] Ast.Ser       [14] Ast.Num
//  [15] (empty)       [16] Ast.Date      [17] Color
//  [18] Assessor Ofc  [19-20] dates      [21] Examiner name …

function parseTsvFormat(text: string, pricePerDmc: string): ParseResult {
  const rows: ReportRow[] = [];
  const selectionCriteria: Record<string, string> = {};
  let reportDate = '';
  let rowNo = 1;

  for (const rawLine of text.split('\n')) {
    if (!rawLine.includes('\t')) continue;
    const cols = rawLine.split('\t');

    // First column must be a valid 4-digit year — skip header/blank lines
    const year = cols[0]?.trim() ?? '';
    if (!/^20\d{2}$/.test(year)) continue;

    rows.push({
      no:           rowNo++,
      year,
      office:       cols[1]?.trim()  ?? '',
      reg_num:      cols[3]?.trim()  ?? '',
      reg_ser:      cols[4]?.trim()  ?? '',
      reg_date:     cols[6]?.trim()  ?? '',
      type:         cols[7]?.trim()  ?? '',
      gen_proc:     cols[8]?.trim()  ?? '',
      items:        cols[9]?.trim()  ?? '',
      consignee:    cols[11]?.trim() ?? '',
      total_taxes:  cols[12]?.trim() ?? '',
      description:  cols[3]?.trim()  ?? '',   // reuse reg ref as description
      ast_ser:      cols[13]?.trim() ?? '',
      ast_num:      cols[14]?.trim() ?? '',
      ast_date:     cols[16]?.trim() ?? '',
      color:        cols[17]?.trim() ?? '',
      price_per_dmc: pricePerDmc,
    });
  }

  // Try to find a report date from the first non-data lines
  for (const line of text.split('\n').slice(0, 10)) {
    const m = line.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
    if (m) { reportDate = m[1]; break; }
  }

  const totalDmc = rows.length;
  const totalPrice = rows.reduce((sum, r) => {
    const n = parseInt(r.total_taxes.replace(/[^0-9]/g, ''), 10);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);

  const errors: string[] = rows.length === 0
    ? ['No data rows found. Make sure the file is the tab-separated export from Rwanda e-Single Window.']
    : [];

  return { rows, totalDmc, totalPrice, reportDate, selectionCriteria, errors };
}

// ── Main entry point ──────────────────────────────────────────────────────────

export function parsePsAsciiText(text: string, pricePerDmc = '118,000 RWF'): ParseResult {
  // Detect tab-separated format: if most non-empty lines contain tabs, use the TSV branch
  const nonEmptyLines = text.split('\n').filter((l) => l.trim().length > 0);
  const tabLineCount = nonEmptyLines.filter((l) => l.includes('\t')).length;
  if (nonEmptyLines.length > 0 && tabLineCount / nonEmptyLines.length > 0.4) {
    return parseTsvFormat(text, pricePerDmc);
  }
  const errors: string[] = [];
  const rows: ReportRow[] = [];
  const selectionCriteria: Record<string, string> = {};
  let reportDate = '';

  const lines = text.split('\n');
  let i = 0;

  // ── Phase 1: Extract metadata ─────────────────────────────────────────────
  for (let j = 0; j < Math.min(lines.length, 40); j++) {
    const line = lines[j];
    // Selection criteria
    const criteriaMatch = line.match(/([A-Za-z. ]+)\s+(?:equal[s]?|equals):\s+(.+)/i);
    if (criteriaMatch) {
      selectionCriteria[criteriaMatch[1].trim()] = criteriaMatch[2].trim();
    }
    // Report date
    const dateMatch = line.match(/Date\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/);
    if (dateMatch) reportDate = dateMatch[1];
    // Timestamp like "4/27/26 8:26 AM"
    const tsMatch = line.match(/(\d{1,2}\/\d{1,2}\/\d{2,4}\s+\d{1,2}:\d{2}\s+[AP]M)/);
    if (tsMatch && !reportDate) reportDate = tsMatch[1];
  }

  // ── Phase 2: Find data record blocks ─────────────────────────────────────
  // Records in ps2ascii output appear as blocks of 2-6 lines between blank lines
  // or between footer/header lines.
  // Key signal: a record block starts with a line containing a 2-digit year fragment
  // at approximately column 1-2 (the year "2026" = "2", "0", "2", "6")

  // Group lines into "blocks" separated by footers (page headers/footers)
  const FOOTER_PATTERNS = [
    /Rwanda e.Single Window/i,
    /Page\s*[−-]\s*\d/i,
    /Document List/i,
    /Selection:/i,
    /^\s*Y\s+Of\s+Decl/,   // column header line
    /^\s*e\s+fic\s+aran/,  // column header continuation
    /^\s*a\s+e\s+t/,
    /^\s*r\s+$/,
    /^\s*Dec\.\s+reference/i,
    /^\s*TOTAL\s+DMC/i,
  ];

  const isFooterOrHeader = (line: string): boolean =>
    FOOTER_PATTERNS.some((p) => p.test(line)) || line.trim().length === 0;

  // Collect data lines (non-header, non-footer)
  const dataLines: string[] = lines.filter((l) => !isFooterOrHeader(l));

  // The ps2ascii output for each record spans RECORD_HEIGHT lines (typically 4-6)
  // Detect record boundaries: a new record starts when the first character position
  // changes from a continuation to a fresh "year digit" value.

  // Simple approach: split into chunks where each chunk starts with a line
  // that has a digit at position 1 (the leading year digit).
  // Records are grouped in blocks of 4 consecutive lines.

  const LINES_PER_RECORD = 4; // typical for this document format

  // Find blocks more reliably: look for lines that start with " 2 " or " 0 " etc.
  // A data block starts with the line for the first row of a record.
  // We use the pattern: lines where the text is not all continuation whitespace.

  const recordBlocks: string[][] = [];
  let currentBlock: string[] = [];

  for (const line of dataLines) {
    // A block break: if the line is very short and looks like it's starting fresh
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentBlock.length >= 2) {
        recordBlocks.push(currentBlock);
        currentBlock = [];
      }
      continue;
    }
    currentBlock.push(line);
    // After collecting LINES_PER_RECORD lines, save the block
    if (currentBlock.length >= LINES_PER_RECORD) {
      recordBlocks.push(currentBlock);
      currentBlock = [];
    }
  }
  if (currentBlock.length >= 2) recordBlocks.push(currentBlock);

  // ── Phase 3: Parse each record block ─────────────────────────────────────
  let rowNo = 1;
  for (const block of recordBlocks) {
    const combined = reconstructRecord(block);
    const row = parseReconstructedRecord(combined, rowNo);
    if (row) {
      row.price_per_dmc = pricePerDmc;
      rows.push(row);
      rowNo++;
    }
  }

  // ── Phase 4: Parse TOTAL from footer ─────────────────────────────────────
  const totalDmc = rows.length;
  let totalPrice = 0;
  totalPrice = rows.reduce((sum, r) => {
    const n = parseInt(r.total_taxes.replace(/[^0-9]/g, ''), 10);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);

  if (rows.length === 0) {
    errors.push('No data rows could be extracted. Make sure to upload the ps2ascii text output (.txt).');
  }

  return { rows, totalDmc, totalPrice, reportDate, selectionCriteria, errors };
}

/**
 * Parse a raw .ps file — extracts only the metadata from hex-encoded strings.
 * Full table data is NOT available without Ghostscript.
 */
export function parsePsFile(psContent: string): { metadata: Record<string, string>; isPsBitmap: boolean } {
  const metadata: Record<string, string> = {};

  // Extract hex-encoded text strings
  const hexRe = /<([0-9A-Fa-f]{4,})>/g;
  let m: RegExpExecArray | null;
  const texts: string[] = [];
  while ((m = hexRe.exec(psContent)) !== null) {
    try {
      let str = '';
      const bytes = m[1];
      for (let i = 0; i < bytes.length; i += 2) {
        str += String.fromCharCode(parseInt(bytes.slice(i, i + 2), 16));
      }
      if (str.trim() && str.split('').every((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) < 127)) {
        texts.push(str.trim());
      }
    } catch {}
  }

  // Parse Selection criteria from extracted text
  for (const text of texts) {
    const crit = text.match(/([A-Za-z .]+)(?:equal|equals):\s*(.+)/i);
    if (crit) metadata[crit[1].trim()] = crit[2].trim();
  }

  // Check if it uses colorimage (bitmap text — needs Ghostscript)
  const isPsBitmap = psContent.includes('colorimage');

  // Extract page size / date from comments or setup
  const dateMatch = psContent.match(/Date\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/);
  if (dateMatch) metadata['report_date'] = dateMatch[1];

  return { metadata, isPsBitmap };
}

// ── Excel generation ──────────────────────────────────────────────────────────

export const REPORT_COLUMNS: Array<{ key: keyof ReportRow; label: string; width: number }> = [
  { key: 'no',            label: 'NO',              width: 5  },
  { key: 'year',          label: 'Year',             width: 6  },
  { key: 'office',        label: 'Office',           width: 8  },
  { key: 'reg_ser',       label: 'Reg.Ser',          width: 7  },
  { key: 'reg_num',       label: 'Reg.Num',          width: 8  },
  { key: 'reg_date',      label: 'Reg.Date',         width: 12 },
  { key: 'type',          label: 'Type',             width: 5  },
  { key: 'gen_proc',      label: 'Gen.Proc',         width: 8  },
  { key: 'items',         label: 'Items',            width: 6  },
  { key: 'consignee',     label: 'Consignee',        width: 12 },
  { key: 'total_taxes',   label: 'Total Taxes',      width: 12 },
  { key: 'description',   label: 'Description',      width: 14 },
  { key: 'ast_ser',       label: 'Ast.Ser',          width: 7  },
  { key: 'ast_num',       label: 'Ast.Num',          width: 8  },
  { key: 'ast_date',      label: 'Ast.Date',         width: 12 },
  { key: 'color',         label: 'Color',            width: 8  },
  { key: 'price_per_dmc', label: 'PRICE PER DMC',    width: 15 },
];

/**
 * Generate a CSV string from the parsed report rows.
 * The CSV is formatted so it opens cleanly in Excel.
 */
export function generateReportCsv(result: ParseResult, reportDateStr?: string): string {
  const todayStr = reportDateStr ?? new Date().toLocaleDateString('en-GB').replace(/\//g, '_');

  const lines: string[] = [];

  // Title block
  lines.push(`"GALAXY CLEARING AND FORWARDING AGENCY LTD"`);
  lines.push(`"Document List — Rwanda e-Single Window"`);
  lines.push(`"Report Date:","${todayStr}"`);
  if (result.selectionCriteria['Consignee equals']) {
    lines.push(`"Consignee:","${result.selectionCriteria['Consignee equals']}"`);
  }
  lines.push('');

  // Header row
  lines.push(REPORT_COLUMNS.map((c) => `"${c.label}"`).join(','));

  // Data rows
  for (const row of result.rows) {
    lines.push(
      REPORT_COLUMNS.map((c) => {
        const val = String(row[c.key] ?? '');
        return `"${val.replace(/"/g, '""')}"`;
      }).join(',')
    );
  }

  // Total row
  lines.push('');
  lines.push(`"TOTAL DMC","${result.totalDmc}"`);
  lines.push(`"TOTAL PRICE","${result.totalPrice.toLocaleString('en-GB')} RWF"`);

  return lines.join('\r\n');
}

/**
 * Generate and download the report CSV.
 */
export function downloadReportCsv(result: ParseResult, filename?: string): void {
  const csv = generateReportCsv(result);
  const bom = '\uFEFF'; // UTF-8 BOM for Excel compatibility
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename ?? `Galaxy_Customs_Report_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
