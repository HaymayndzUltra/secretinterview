import React from 'react';

interface Props {
  partial: string;
}

export const LiveCaption: React.FC<Props> = ({ partial }) => {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl px-4 py-3 text-lg tracking-wide text-slate-100">
      {partial || 'Waiting for client audio…'}
    </div>
  );
};
