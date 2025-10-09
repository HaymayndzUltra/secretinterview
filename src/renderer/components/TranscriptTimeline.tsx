import React from 'react';
import type { SuggestionLine, TranscriptSegment } from '@shared/types';

interface Props {
  transcripts: TranscriptSegment[];
  suggestions: SuggestionLine[];
  activeTxId: string | null;
}

export const TranscriptTimeline: React.FC<Props> = ({ transcripts, suggestions, activeTxId }) => {
  return (
    <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-4 space-y-4 overflow-y-auto h-full">
      <h2 className="text-sm font-semibold tracking-wide text-slate-300 uppercase">Transcript Log</h2>
      <div className="space-y-4">
        {transcripts.map((segment) => {
          const linkedSuggestions = suggestions.filter((suggestion) => suggestion.txId === segment.id);
          return (
            <div
              key={segment.id}
              className={`border rounded-xl p-4 transition-colors ${
                segment.id === activeTxId ? 'border-accent/70 bg-accent/5' : 'border-slate-800 bg-slate-800/40'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>[{segment.id}]</span>
                <span>{segment.timestamp}</span>
              </div>
              <p className="text-sm text-white mt-2">{segment.text}</p>
              {linkedSuggestions.length > 0 && (
                <div className="mt-3 space-y-2">
                  {linkedSuggestions.map((suggestion) => (
                    <div key={suggestion.id} className="text-xs text-slate-300 border border-slate-700 rounded-lg p-2">
                      <div className="flex justify-between mb-1">
                        <span className="font-semibold text-slate-200">{suggestion.mode.toUpperCase()}</span>
                        <span className="text-slate-500">{new Date(suggestion.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-slate-100">{suggestion.nextLine}</p>
                      {suggestion.probe && <p className="text-slate-400 mt-1">Probe: {suggestion.probe}</p>}
                      <p className="text-slate-500 mt-1">Why: {suggestion.why}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
