import React, { useState, useRef, useEffect } from 'react';
import { X, Plus, Image as ImageIcon } from 'lucide-react';
import { TabData } from '../types';

interface TabListProps {
  tabs: TabData[];
  activeTabId: string;
  onSwitch: (id: string) => void;
  onClose: (id: string, e: React.MouseEvent) => void;
  onAdd: () => void;
  onRename: (id: string, newTitle: string) => void;
}

const TabList: React.FC<TabListProps> = ({ tabs, activeTabId, onSwitch, onClose, onAdd, onRename }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

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
    <div className="flex items-center w-full bg-slate-200 dark:bg-slate-900 pt-1 px-1 gap-1 overflow-x-auto no-scrollbar border-b border-slate-300 dark:border-slate-700 select-none h-[34px] transition-colors">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const isEditing = tab.id === editingId;

        return (
          <div
            key={tab.id}
            onClick={() => !isEditing && onSwitch(tab.id)}
            className={`
              group flex items-center gap-1.5 px-3 py-1.5 rounded-t-md text-xs font-medium cursor-pointer min-w-[100px] max-w-[180px] border-t border-x transition-colors
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
                    title="Double click to rename"
                >
                    {tab.title}
                </span>
            )}

            {!isEditing && (
                <button
                onClick={(e) => onClose(tab.id, e)}
                className={`p-0.5 rounded-full hover:bg-slate-300/50 dark:hover:bg-slate-600/50 ${tabs.length === 1 ? 'hidden' : ''}`}
                >
                <X size={10} />
                </button>
            )}
          </div>
        );
      })}
      
      <button
        onClick={onAdd}
        className="ml-1 p-1 text-slate-500 hover:bg-slate-300 dark:text-slate-400 dark:hover:bg-slate-800 rounded-md transition-colors"
        title="New Tab"
      >
        <Plus size={14} />
      </button>
    </div>
  );
};

export default TabList;