import React, { useEffect, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';
import { TabData } from '../types';
import { documentHasContent } from '../utils/documents';

interface Props {
  tabs: TabData[];
  label: string;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
  onExportAll: () => Promise<void>;
}

export default function CloseTabsDialog({ tabs, label, busy, error, onCancel, onConfirm, onExportAll }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const [exporting, setExporting] = useState(false);
  const exportLock = useRef(false);
  const [exportMessage, setExportMessage] = useState('');
  const blocked = busy || exporting;
  const contentCount = tabs.filter(documentHasContent).length;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    cancel.current?.focus();
    return () => {
      queueMicrotask(() => {
        if (previous?.isConnected) previous.focus();
        else (document.querySelector('[data-active="true"]') as HTMLElement | null)?.focus();
      });
    };
  }, []);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopImmediatePropagation();
        if (!blocked) onCancel();
      } else if (event.key === 'Tab') {
        const buttons = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || !panel.current?.contains(document.activeElement))) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !panel.current?.contains(document.activeElement))) {
          event.preventDefault(); first.focus();
        }
      }
    };
    document.addEventListener('keydown', keydown, true);
    return () => document.removeEventListener('keydown', keydown, true);
  }, [blocked, onCancel]);

  const exportAll = async () => {
    if (exportLock.current || busy) return;
    exportLock.current = true; setExporting(true); setExportMessage('');
    try {
      await onExportAll();
      setExportMessage('已送出全部圖片的下載。請確認瀏覽器已完成下載，再按「確定關閉」；此操作不會自動關閉分頁。');
    } catch {
      setExportMessage('匯出失敗或尚未完成，所有分頁均保留。請稍後重試。');
    } finally { exportLock.current = false; setExporting(false); }
  };

  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 p-4" onKeyDown={event => event.stopPropagation()}>
    <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="close-tabs-title" aria-describedby="close-tabs-description" aria-busy={blocked}
      className="ui-dialog max-h-[calc(100dvh-32px)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 text-slate-800 shadow-2xl dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
      <div className="flex items-start justify-between gap-3">
        <h2 id="close-tabs-title" className="text-lg font-semibold">{label}</h2>
        <button type="button" disabled={blocked} aria-label="取消關閉分頁" onClick={onCancel} className="rounded-md p-1 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"><X size={18} /></button>
      </div>
      <p id="close-tabs-description" className="mt-3 text-sm leading-6">即將關閉 {tabs.length} 個分頁，其中 {contentCount} 個包含圖片或標註。關閉後內容會從本機工作區移除，無法使用畫布的復原功能找回。</p>
      <ul className="mt-3 max-h-32 overflow-y-auto rounded-lg bg-slate-100 p-3 text-sm dark:bg-slate-900">
        {tabs.map(tab => <li key={tab.id} className="truncate py-0.5" title={tab.title}>{tab.title}</li>)}
      </ul>
      <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">需要保留圖片時，可先全部匯出 PNG。瀏覽器可能要求允許多個檔案下載；匯出圖片不包含可編輯圖層。</p>
      {exportMessage && <p role="status" className="mt-3 text-sm leading-6">{exportMessage}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button ref={cancel} type="button" disabled={blocked} onClick={onCancel} className="rounded-lg px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50">取消</button>
        <button type="button" disabled={blocked} onClick={() => void exportAll()} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 disabled:opacity-50"><Download size={14} />{exporting ? '匯出中…' : '先全部匯出'}</button>
        <button type="button" disabled={blocked} onClick={onConfirm} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">{busy ? '關閉中…' : '確定關閉'}</button>
      </div>
    </div>
  </div>;
}
