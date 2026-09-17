import React, { useState } from 'react';
import { Download, X } from 'lucide-react';

export type ExportFormat = 'png' | 'jpeg';

export interface ExportOptions {
  format: ExportFormat;
  scale: number;
  quality: number;
}

interface ExportDialogProps {
  isOpen: boolean;
  title: string;
  width: number;
  height: number;
  onClose: () => void;
  onExport: (options: ExportOptions) => void | Promise<void>;
}

const ExportDialog: React.FC<ExportDialogProps> = ({
  isOpen,
  title,
  width,
  height,
  onClose,
  onExport,
}) => {
  const [format, setFormat] = useState<ExportFormat>('png');
  const [scale, setScale] = useState(1);
  const [quality, setQuality] = useState(0.9);
  const [exporting, setExporting] = useState(false);

  if (!isOpen) return null;

  const submit = async () => {
    setExporting(true);
    try {
      await onExport({ format, scale, quality });
      onClose();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4" role="presentation" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-800"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="export-dialog-title" className="text-lg font-semibold text-slate-900 dark:text-white">Export image</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{title}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Close export dialog">
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">Format</legend>
            <div className="grid grid-cols-2 gap-2">
              {(['png', 'jpeg'] as const).map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFormat(option)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium uppercase ${format === option ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'border-slate-200 text-slate-600 dark:border-slate-600 dark:text-slate-300'}`}
                >
                  {option === 'jpeg' ? 'JPG' : 'PNG'}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Output scale</span>
            <select value={scale} onChange={(event) => setScale(Number(event.target.value))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white">
              <option value={1}>1× — {width} × {height}px</option>
              <option value={2}>2× — {width * 2} × {height * 2}px</option>
              <option value={3}>3× — {width * 3} × {height * 3}px</option>
            </select>
          </label>

          {format === 'jpeg' && (
            <label className="block">
              <span className="mb-2 flex justify-between text-sm font-medium text-slate-700 dark:text-slate-200"><span>Quality</span><span>{Math.round(quality * 100)}%</span></span>
              <input type="range" min="0.5" max="1" step="0.05" value={quality} onChange={(event) => setQuality(Number(event.target.value))} className="w-full accent-brand-600" />
            </label>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">Cancel</button>
          <button type="button" disabled={exporting} onClick={() => void submit()} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
            <Download size={16} /> {exporting ? 'Exporting…' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportDialog;
