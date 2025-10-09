import React from 'react';
import type { SuggestionLine } from '@shared/types';

interface Props {
  suggestions: SuggestionLine[];
  activeTxId: string | null;
}

export const AutosuggestDeck: React.FC<Props> = ({ suggestions, activeTxId }) => {
  return (
    <div className="bg-slate-900/70 rounded-2xl border border-slate-800 p-4 space-y-3">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-slate-200 uppercase">Autosuggest Deck</h2>
        <span className="text-xs text-slate-500">Hotkeys 1 • 2 • 3</span>
      </header>
      {suggestions.length === 0 && (
        <div className="text-sm text-slate-500">Waiting for next client line…</div>
      )}
      <div className="space-y-2">
        {suggestions.map((suggestion, index) => (
          <div
            key={suggestion.id}
            className={`rounded-xl border px-4 py-3 transition-all ${
              suggestion.txId === activeTxId
                ? 'border-accent/80 bg-accent/10 shadow-[0_0_20px_rgba(34,211,238,0.3)]'
                : 'border-slate-800 bg-slate-800/30'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>#{index + 1}</span>
              <span>{suggestion.mode.toUpperCase()}</span>
            </div>
            <p className="text-sm font-semibold text-white">{suggestion.summary}</p>
            <p className="text-sm text-slate-200 mt-1">{suggestion.nextLine}</p>
            {suggestion.probe && (
              <p className="text-xs text-slate-400 mt-1">Probe: {suggestion.probe}</p>
            )}
            <p className="text-[11px] text-slate-500 mt-2">Why: {suggestion.why}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
