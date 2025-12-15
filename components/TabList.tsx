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
    <div className="flex items-center w-full bg-slate-200 pt-2 px-2 gap-1 overflow-x-auto no-scrollbar border-b border-slate-300 select-none">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            onClick={() => onSwitch(tab.id)}
            className={`
              group flex items-center gap-2 px-3 py-2 rounded-t-lg text-sm font-medium cursor-pointer min-w-[120px] max-w-[200px] border-t border-x
              ${isActive 
                ? 'bg-white text-brand-600 border-slate-300 border-b-white -mb-px z-10' 
                : 'bg-slate-100 text-slate-500 border-transparent hover:bg-slate-50 hover:text-slate-700'
              }
            `}
          >
            <ImageIcon size={14} className={isActive ? 'text-brand-500' : 'text-slate-400'} />
            <span className="truncate flex-1">{tab.title}</span>
            <button
              onClick={(e) => onClose(tab.id, e)}
              className={`p-0.5 rounded-full hover:bg-slate-300/50 ${tabs.length === 1 ? 'hidden' : ''}`}
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
      
      <button
        onClick={onAdd}
        className="ml-1 p-1.5 text-slate-500 hover:bg-slate-300 rounded-md transition-colors"
        title="New Tab"
      >
        <Plus size={18} />
      </button>
    </div>
  );
};

export default TabList;