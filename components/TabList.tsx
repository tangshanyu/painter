import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { X, Plus, FolderOpen, Image as ImageIcon } from 'lucide-react';
import { TabData } from '../types';
import { DocumentCloseAction, getDocumentCloseIds } from '../utils/documents';
import './TabList.css';

interface TabListProps {
  tabs: TabData[];
  activeTabId: string;
  onSwitch: (id: string) => void;
  onClose: (id: string, e: React.MouseEvent) => void;
  onCloseBatch: (ids: string[], label: string) => void;
  onAdd: () => void;
  onOpen: () => void;
  onRename: (id: string, newTitle: string) => void;
}

export const preventTabMiddleScroll = (event: React.MouseEvent) => {
  if (event.button === 1) event.preventDefault();
};

export const closeTabWithMiddleClick = (id: string, event: React.MouseEvent, onClose: TabListProps['onClose']) => {
  if (event.button !== 1) return;
  event.preventDefault();
  event.stopPropagation();
  onClose(id, event);
};

const BATCH_ACTIONS: { action: DocumentCloseAction; label: string }[] = [
  { action: 'others', label: '關閉其他分頁' },
  { action: 'right', label: '關閉右側分頁' },
  { action: 'all', label: '關閉全部分頁' },
  { action: 'empty', label: '關閉空白分頁' },
];

const TabList: React.FC<TabListProps> = ({ tabs, activeTabId, onSwitch, onClose, onCloseBatch, onAdd, onOpen, onRename }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTrigger = useRef<HTMLElement | null>(null);

  const dismissMenu = () => {
    setMenu(null);
    if (menuTrigger.current?.isConnected) menuTrigger.current.focus({ preventScroll: true });
  };

  useLayoutEffect(() => {
    if (!menu || !menuRef.current) return;
    const node = menuRef.current;
    node.style.left = `${Math.max(8, Math.min(menu.x, window.innerWidth - node.offsetWidth - 8))}px`;
    node.style.top = `${Math.max(8, Math.min(menu.y, window.innerHeight - node.offsetHeight - 8))}px`;
    node.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    if (!tabs.some(tab => tab.id === menu.id)) { setMenu(null); return; }
    const outside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(null);
    };
    const resized = () => setMenu(null);
    const scrolled = (event: Event) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(null);
    };
    const keydown = (event: KeyboardEvent) => {
      event.stopImmediatePropagation();
      const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (event.key === 'Escape' || event.key === 'Tab') {
        event.preventDefault(); dismissMenu();
      } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
          : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
      }
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', keydown, true);
    window.addEventListener('resize', resized);
    document.addEventListener('scroll', scrolled, true);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', keydown, true);
      window.removeEventListener('resize', resized);
      document.removeEventListener('scroll', scrolled, true);
    };
  }, [menu, tabs]);

  useEffect(() => {
    if (editingId && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
    }
  }, [editingId]);

  const startEditing = (id: string, currentTitle: string, e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent tab switch when double clicking
      setEditingId(id);
      setEditValue(currentTitle);
  };

  const finishEditing = () => {
      if (editingId) {
          if (editValue.trim()) {
              onRename(editingId, editValue.trim());
          }
          setEditingId(null);
      }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          finishEditing();
      } else if (e.key === 'Escape') {
          setEditingId(null);
      }
  };

  return (
    <><div className="tab-strip flex items-center w-full bg-slate-200 dark:bg-slate-900 pt-1 px-1 gap-1 overflow-x-auto no-scrollbar border-b border-slate-300 dark:border-slate-700 select-none h-[34px] transition-colors">
      <button type="button" onClick={onOpen} aria-label="開啟檔案" title="開啟圖片檔案" className="document-open"><FolderOpen size={14} /><span>開啟</span></button>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const isEditing = tab.id === editingId;

        return (
          <div
            key={tab.id}
            data-active={isActive}
            tabIndex={0}
            aria-label={`分頁：${tab.title}`}
            onContextMenu={event => {
              if ((event.target as HTMLElement).closest('input')) return;
              event.preventDefault();
              menuTrigger.current = event.currentTarget;
              setMenu({ id: tab.id, x: event.clientX, y: event.clientY });
            }}
            onKeyDown={event => {
              if ((event.target as HTMLElement).closest('input, button')) return;
              if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
                event.preventDefault(); event.stopPropagation();
                const rect = event.currentTarget.getBoundingClientRect();
                menuTrigger.current = event.currentTarget;
                setMenu({ id: tab.id, x: rect.left, y: rect.bottom });
              } else if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault(); onSwitch(tab.id);
              }
            }}
            onClick={() => !isEditing && onSwitch(tab.id)}
            onMouseDown={preventTabMiddleScroll}
            onAuxClick={event => closeTabWithMiddleClick(tab.id, event, onClose)}
            title="滑鼠中鍵關閉；右鍵開啟分頁選單"
            className={`
              document-tab group flex items-center gap-1.5 px-3 py-1.5 rounded-t-md text-xs font-medium cursor-pointer min-w-[100px] max-w-[180px] border-t border-x transition-colors
              ${isActive 
                ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 border-slate-300 dark:border-slate-700 border-b-white dark:border-b-slate-800 -mb-px z-10 h-full' 
                : 'bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-slate-700 dark:hover:text-slate-300 h-[calc(100%-2px)] mt-[2px]'
              }
            `}
          >
            <ImageIcon size={12} className={isActive ? 'text-brand-500 dark:text-brand-400' : 'text-slate-400'} />
            
            {isEditing ? (
                <input 
                    ref={inputRef}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={finishEditing}
                    onKeyDown={handleKeyDown}
                    className="flex-1 w-full bg-white dark:bg-slate-700 border border-brand-300 dark:border-brand-600 rounded px-1 text-xs focus:outline-none text-slate-900 dark:text-slate-100"
                    onClick={(e) => e.stopPropagation()}
                />
            ) : (
                <span 
                    className="truncate flex-1"
                    onDoubleClick={(e) => startEditing(tab.id, tab.title, e)}
                    title="雙擊以重新命名；滑鼠中鍵關閉分頁"
                >
                    {tab.title}
                </span>
            )}

            {!isEditing && (
                <button
                onClick={(e) => onClose(tab.id, e)}
                aria-label={`關閉分頁：${tab.title}`}
                title="關閉分頁"
                className="p-0.5 rounded-full hover:bg-slate-300/50 dark:hover:bg-slate-600/50"
                >
                <X size={10} />
                </button>
            )}
          </div>
        );
      })}
      <button type="button" onClick={onAdd} aria-label="新增分頁" title="新增分頁" className="document-add ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-300/50 dark:text-slate-400 dark:hover:bg-slate-800"><Plus size={14} /></button>
      
    </div>
    {menu && <div ref={menuRef} role="menu" aria-label="分頁關閉選單" className="tab-context-menu" style={{ left: menu.x, top: menu.y }}>
      <p>{tabs.find(tab => tab.id === menu.id)?.title}</p>
      {BATCH_ACTIONS.map(({ action, label }) => {
        const ids = getDocumentCloseIds(tabs, menu.id, action);
        return <button key={action} type="button" role="menuitem" disabled={ids.length === 0}
          onClick={() => { dismissMenu(); onCloseBatch(ids, label); }}>
          <span>{label}</span><span aria-hidden="true">{ids.length}</span>
        </button>;
      })}
    </div>}</>
  );
};

export default TabList;
