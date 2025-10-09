import React from 'react';
import type { ConversationMode } from '@shared/types';

interface Props {
  mode: ConversationMode;
  onOverride: (mode: ConversationMode) => void;
}

export const ModeToggle: React.FC<Props> = ({ mode, onOverride }) => {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400">Mode override</span>
      <div className="flex rounded-md overflow-hidden border border-slate-700">
        {(['discovery', 'technical'] as ConversationMode[]).map((item) => (
          <button
            key={item}
            onClick={() => onOverride(item)}
            className={`px-3 py-1 text-xs font-medium uppercase tracking-wide transition-colors ${
              mode === item ? 'bg-accent text-black' : 'bg-slate-800 text-slate-300'
            }`}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
};
