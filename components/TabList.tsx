import React from 'react';
import { X, Plus, Image as ImageIcon } from 'lucide-react';
import { TabData } from '../types';

interface TabListProps {
  tabs: TabData[];
  activeTabId: string;
  onSwitch: (id: string) => void;
  onClose: (id: string, e: React.MouseEvent) => void;
  onAdd: () => void;
}

const TabList: React.FC<TabListProps> = ({ tabs, activeTabId, onSwitch, onClose, onAdd }) => {
  return (
    <div className="flex items-center w-full bg-slate-200 pt-1 px-1 gap-1 overflow-x-auto no-scrollbar border-b border-slate-300 select-none h-[34px]">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            onClick={() => onSwitch(tab.id)}
            className={`
              group flex items-center gap-1.5 px-3 py-1.5 rounded-t-md text-xs font-medium cursor-pointer min-w-[100px] max-w-[180px] border-t border-x
              ${isActive 
                ? 'bg-white text-brand-600 border-slate-300 border-b-white -mb-px z-10 h-full' 
                : 'bg-slate-100 text-slate-500 border-transparent hover:bg-slate-50 hover:text-slate-700 h-[calc(100%-2px)] mt-[2px]'
              }
            `}
          >
            <ImageIcon size={12} className={isActive ? 'text-brand-500' : 'text-slate-400'} />
            <span className="truncate flex-1">{tab.title}</span>
            <button
              onClick={(e) => onClose(tab.id, e)}
              className={`p-0.5 rounded-full hover:bg-slate-300/50 ${tabs.length === 1 ? 'hidden' : ''}`}
            >
              <X size={10} />
            </button>
          </div>
        );
      })}
      
      <button
        onClick={onAdd}
        className="ml-1 p-1 text-slate-500 hover:bg-slate-300 rounded-md transition-colors"
        title="New Tab"
      >
        <Plus size={14} />
      </button>
    </div>
  );
};

export default TabList;