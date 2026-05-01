import { useLayoutEffect, useRef, useState } from 'react';
import {
  FileText,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  X,
  Terminal,
  Info,
  RefreshCw,
} from 'lucide-react';
import {
  parsePsAsciiText,
  parsePsFile,
  downloadReportCsv,
  REPORT_COLUMNS,
  type ParseResult,
  type ReportRow,
} from '@/app/lib/psReportParser';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pre-fill price per DMC from the current payment or client config */
  defaultPricePerDmc?: string;
}

type UploadState = 'idle' | 'reading' | 'parsed' | 'error';

export function GenerateReportDialog({ open, onClose, defaultPricePerDmc = '118,000 RWF' }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [fileName, setFileName] = useState('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isBitmap, setIsBitmap] = useState(false);
  const [pricePerDmc, setPricePerDmc] = useState(defaultPricePerDmc);

  // Reset state synchronously before the browser paints whenever the dialog opens.
  // useLayoutEffect fires before paint so the user never sees stale data from a previous session.
  useLayoutEffect(() => {
    if (open) {
      setUploadState('idle');
      setFileName('');
      setParseResult(null);
      setErrorMsg('');
      setIsBitmap(false);
      setPricePerDmc(defaultPricePerDmc);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setUploadState('reading');
    setIsBitmap(false);
    setErrorMsg('');
    setParseResult(null);

    try {
      const text = await file.text();
      const isPsFile = file.name.toLowerCase().endsWith('.ps');

      if (isPsFile) {
        // Try to detect if it's a bitmap PS (from Rwanda e-Single Window)
        const { metadata, isPsBitmap } = parsePsFile(text);
        setIsBitmap(isPsBitmap);

        if (isPsBitmap) {
          // Can't extract table data without Ghostscript
          setUploadState('error');
          setErrorMsg(
            'This PostScript file renders text as bitmap images and cannot be parsed directly in the browser. ' +
            'Please convert it first using the command shown below, then re-upload the .txt output.'
          );
          return;
        }

        // Try to parse as ps2ascii-style text anyway
        const result = parsePsAsciiText(text, pricePerDmc);
        if (result.rows.length > 0) {
          setParseResult(result);
          setUploadState('parsed');
        } else {
          setUploadState('error');
          setErrorMsg('Could not extract rows from the PS file. Please use the ps2ascii conversion command below.');
        }
      } else {
        // .txt — ps2ascii output
        const result = parsePsAsciiText(text, pricePerDmc);
        if (result.rows.length > 0) {
          setParseResult(result);
          setUploadState('parsed');
        } else {
          setUploadState('error');
          setErrorMsg(
            'No data rows found. Make sure the file is the ps2ascii text output of the Document List report ' +
            '(not the raw .ps file).'
          );
        }
      }
    } catch (err) {
      setUploadState('error');
      setErrorMsg(String(err));
    }
  };

  const handleReset = () => {
    // Clear the native input value so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
    setUploadState('idle');
    setFileName('');
    setParseResult(null);
    setErrorMsg('');
    setIsBitmap(false);
  };

  /** Reset state AND immediately open the file picker (must be called inside a user-gesture handler). */
  const handleResetAndPick = () => {
    handleReset();
    // Call .click() synchronously here — still inside the browser's user-gesture context.
    // setTimeout would break that context and the browser would silently block the picker.
    fileInputRef.current?.click();
  };

  const handleDownload = () => {
    if (!parseResult) return;
    // Apply the current pricePerDmc to all rows
    const result = {
      ...parseResult,
      rows: parseResult.rows.map((r) => ({ ...r, price_per_dmc: pricePerDmc })),
    };
    downloadReportCsv(result, `Galaxy_Customs_Report_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog */}
      <div className="relative z-10 bg-card border rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
        style={{ borderColor: 'var(--border)' }}>

        {/* Header */}
        <div className="px-6 py-5 border-b flex items-center justify-between shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-500/10 flex items-center justify-center">
              <FileText className="size-5 text-sky-500" />
            </div>
            <div>
              <h2 className="font-bold text-base">Generate Customs Report</h2>
              <p className="text-xs text-muted-foreground">Rwanda e-Single Window → Excel/CSV</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Price per DMC selector */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium shrink-0">Price per DMC:</label>
            <select
              value={pricePerDmc}
              onChange={(e) => setPricePerDmc(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm bg-background"
              style={{ borderColor: 'var(--border)' }}
            >
              <option value="118,000 RWF">118,000 RWF</option>
              <option value="142,600 RWF">142,600 RWF</option>
            </select>
          </div>

          {/* How-to instructions */}
          <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-sky-700 dark:text-sky-400">
              <Info className="size-4 shrink-0" />
              <span className="text-sm font-semibold">How to prepare the file</span>
            </div>
            <p className="text-xs text-sky-700 dark:text-sky-400 leading-relaxed">
              The Rwanda e-Single Window exports PostScript (.ps) files that render text as bitmap images.
              Run the command below to convert to plain text first, then upload the <strong>.txt</strong> output:
            </p>
            <div className="flex items-start gap-2 bg-gray-900 rounded-lg px-4 py-3">
              <Terminal className="size-4 text-green-400 mt-0.5 shrink-0" />
              <code className="text-green-400 text-xs font-mono leading-relaxed">
                ps2ascii your-report.ps &gt; customs_report.txt
              </code>
            </div>
            <p className="text-xs text-muted-foreground">
              Then upload <code className="font-mono bg-muted rounded px-1">customs_report.txt</code> below.
              You can also try uploading the .ps file directly — it may work if the file uses text operators.
            </p>
          </div>

          {/* Hidden file input — always in the DOM so the ref is never null */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".ps,.txt,.text"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Upload drop-zone (visible only when idle) */}
          {uploadState === 'idle' && (
            <div
              className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-sky-400 hover:bg-sky-50/5 transition-colors"
              style={{ borderColor: 'var(--border)' }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-semibold">Upload your report file</p>
              <p className="text-xs text-muted-foreground mt-1">
                Accepts <strong>.txt</strong> (ps2ascii output) or <strong>.ps</strong> (PostScript)
              </p>
            </div>
          )}

          {/* Reading */}
          {uploadState === 'reading' && (
            <div className="flex items-center gap-3 py-6 justify-center">
              <RefreshCw className="size-5 animate-spin text-sky-500" />
              <span className="text-sm text-muted-foreground">Parsing {fileName}…</span>
            </div>
          )}

          {/* Error state */}
          {uploadState === 'error' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl p-4">
                <AlertTriangle className="size-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-700 dark:text-red-400">Could not parse file</p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1 leading-relaxed">{errorMsg}</p>
                </div>
              </div>
              {isBitmap && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl p-4">
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold mb-2">
                    Bitmap PS detected. Convert first:
                  </p>
                  <div className="bg-gray-900 rounded-lg px-4 py-3 flex items-center gap-2">
                    <Terminal className="size-4 text-green-400 shrink-0" />
                    <code className="text-green-400 text-xs font-mono">
                      ps2ascii your-report.ps &gt; report.txt
                    </code>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={handleResetAndPick}
                className="w-full py-2.5 rounded-xl border text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2"
                style={{ borderColor: 'var(--border)' }}
              >
                <Upload className="size-4" />
                Try another file
              </button>
            </div>
          )}

          {/* Parsed successfully */}
          {uploadState === 'parsed' && parseResult && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex items-start gap-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4">
                <CheckCircle2 className="size-5 text-emerald-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    Successfully parsed {parseResult.rows.length} records from {fileName}
                  </p>
                  <div className="flex gap-4 mt-1.5 flex-wrap">
                    <span className="text-xs text-emerald-600 dark:text-emerald-400">
                      DMC: <strong>{parseResult.totalDmc}</strong>
                    </span>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400">
                      Total Taxes: <strong>{parseResult.totalPrice.toLocaleString('en-GB')} RWF</strong>
                    </span>
                    {Object.entries(parseResult.selectionCriteria).slice(0, 2).map(([k, v]) => (
                      <span key={k} className="text-xs text-emerald-600 dark:text-emerald-400">
                        {k}: <strong>{v}</strong>
                      </span>
                    ))}
                  </div>
                  {parseResult.errors.length > 0 && (
                    <p className="text-xs text-amber-600 mt-1">{parseResult.errors.join(' ')}</p>
                  )}
                </div>
              </div>

              {/* Preview table */}
              <PreviewTable rows={parseResult.rows} pricePerDmc={pricePerDmc} />
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t flex items-center justify-between gap-3 shrink-0"
          style={{ borderColor: 'var(--border)' }}>
          <div className="flex gap-2">
            {uploadState !== 'idle' && (
              <button
                type="button"
                onClick={handleResetAndPick}
                className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted transition-colors flex items-center gap-1.5"
                style={{ borderColor: 'var(--border)' }}
              >
                <Upload className="size-3.5" />
                Upload new file
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted transition-colors"
              style={{ borderColor: 'var(--border)' }}
            >
              Cancel
            </button>
            {uploadState === 'parsed' && parseResult && (
              <button
                type="button"
                onClick={handleDownload}
                className="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold transition-colors flex items-center gap-2"
              >
                <Download className="size-4" />
                Download Excel / CSV
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Preview table ─────────────────────────────────────────────────────────────

function PreviewTable({ rows, pricePerDmc }: { rows: ReportRow[]; pricePerDmc: string }) {
  const [expanded, setExpanded] = useState(false);
  const displayRows = expanded ? rows : rows.slice(0, 8);

  const visibleCols: Array<keyof ReportRow> = [
    'no', 'year', 'office', 'reg_ser', 'reg_num', 'reg_date',
    'type', 'items', 'total_taxes', 'description', 'ast_date', 'color',
  ];

  return (
    <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      <div className="px-4 py-3 border-b flex items-center justify-between bg-muted/30"
        style={{ borderColor: 'var(--border)' }}>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Preview — {rows.length} rows
        </span>
        <span className="text-xs text-muted-foreground">
          Price per DMC: <strong>{pricePerDmc}</strong>
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50">
              {visibleCols.map((col) => {
                const def = REPORT_COLUMNS.find((c) => c.key === col);
                return (
                  <th key={col} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">
                    {def?.label ?? col}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, i) => (
              <tr key={row.no} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                {visibleCols.map((col) => (
                  <td key={col} className="px-3 py-2 whitespace-nowrap">
                    {col === 'color' ? (
                      <ColorBadge color={String(row[col])} />
                    ) : (
                      String(row[col] ?? '')
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {/* Total row */}
          <tfoot>
            <tr className="bg-muted/40 border-t font-bold" style={{ borderColor: 'var(--border)' }}>
              <td className="px-3 py-2" colSpan={visibleCols.length - 3}>
                TOTAL DMC: {rows.length}
              </td>
              <td className="px-3 py-2 text-right" colSpan={3}>
                {pricePerDmc} × {rows.length} = {' '}
                <strong>
                  {(parseInt(pricePerDmc.replace(/[^0-9]/g, ''), 10) * rows.length).toLocaleString('en-GB')} RWF
                </strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {rows.length > 8 && (
        <div className="px-4 py-2 border-t text-center" style={{ borderColor: 'var(--border)' }}>
          <button
            type="button"
            onClick={() => setExpanded((x) => !x)}
            className="text-xs text-sky-600 hover:underline"
          >
            {expanded ? 'Show less' : `Show all ${rows.length} rows`}
          </button>
        </div>
      )}
    </div>
  );
}

function ColorBadge({ color }: { color: string }) {
  const map: Record<string, string> = {
    Green:  'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    Blue:   'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    Red:    'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    Yellow: 'bg-yellow-100 text-yellow-700',
    Orange: 'bg-orange-100 text-orange-700',
  };
  const cls = map[color] ?? 'bg-muted text-muted-foreground';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {color || '—'}
    </span>
  );
}
