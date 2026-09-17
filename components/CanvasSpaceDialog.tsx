import React, { useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Expand, X } from 'lucide-react';

export type CanvasEdge = 'top' | 'right' | 'bottom' | 'left';

interface CanvasSpaceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (edge: CanvasEdge, amount: number) => void | Promise<void>;
}

const edges = [
  { id: 'top', label: 'Top', icon: ArrowUp },
  { id: 'right', label: 'Right', icon: ArrowRight },
  { id: 'bottom', label: 'Bottom', icon: ArrowDown },
  { id: 'left', label: 'Left', icon: ArrowLeft },
] as const;

const CanvasSpaceDialog: React.FC<CanvasSpaceDialogProps> = ({ isOpen, onClose, onApply }) => {
  const [edge, setEdge] = useState<CanvasEdge>('bottom');
  const [amount, setAmount] = useState(200);
  const [applying, setApplying] = useState(false);

  if (!isOpen) return null;

  const apply = async () => {
    setApplying(true);
    try {
      await onApply(edge, Math.max(10, amount));
      onClose();
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4" role="presentation" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="canvas-space-title" className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-800" onMouseDown={event => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="canvas-space-title" className="text-lg font-semibold text-slate-900 dark:text-white">Add blank space</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Choose where the extra writing area should appear.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Close add space dialog"><X size={18} /></button>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-2">
          {edges.map(option => (
            <button key={option.id} type="button" onClick={() => setEdge(option.id)} className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-medium ${edge === option.id ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'border-slate-200 text-slate-600 dark:border-slate-600 dark:text-slate-300'}`}>
              <option.icon size={18} /> {option.label}
            </button>
          ))}
        </div>

        <label className="mt-4 block">
          <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Space to add</span>
          <div className="flex items-center gap-2">
            <input type="number" min="10" step="10" value={amount} onChange={event => setAmount(Number(event.target.value) || 10)} className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
            <span className="text-sm text-slate-500">px</span>
          </div>
        </label>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">Cancel</button>
          <button type="button" disabled={applying} onClick={() => void apply()} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
            <Expand size={16} /> {applying ? 'Adding…' : 'Add space'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CanvasSpaceDialog;
