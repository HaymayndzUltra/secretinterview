import React, { useEffect, useMemo, useState } from 'react';
import { ResponseSegment } from '../contexts/InterviewContext';

interface TeleprompterViewerProps {
  segments: ResponseSegment[];
  onClose: () => void;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const TeleprompterViewer: React.FC<TeleprompterViewerProps> = ({ segments, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fontSize, setFontSize] = useState(36);
  const [isHighContrast, setIsHighContrast] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [intervalMs, setIntervalMs] = useState(5000);

  useEffect(() => {
    setCurrentIndex(0);
  }, [segments]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const timer = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= segments.length - 1) {
          return prev;
        }
        return prev + 1;
      });
    }, clamp(intervalMs, 1000, 20000));

    return () => clearInterval(timer);
  }, [isPlaying, intervalMs, segments.length]);

  const currentSegment = useMemo(() => segments[currentIndex], [segments, currentIndex]);

  const handleNext = () => {
    setCurrentIndex((prev) => Math.min(prev + 1, Math.max(segments.length - 1, 0)));
  };

  const handlePrevious = () => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleFontSizeChange = (delta: number) => {
    setFontSize((prev) => clamp(prev + delta, 18, 72));
  };

  const handleIntervalChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    if (!Number.isNaN(value)) {
      setIntervalMs(clamp(value, 1000, 20000));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-base-300/90 backdrop-blur">
      <div className="flex items-center justify-between border-b border-base-content/20 bg-base-100 px-6 py-4 shadow">
        <h2 className="text-xl font-semibold">Teleprompter</h2>
        <button className="btn btn-sm" onClick={onClose} type="button">
          Close
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-hidden px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Font size</span>
            <div className="join">
              <button className="btn btn-sm join-item" onClick={() => handleFontSizeChange(-4)} type="button">
                -
              </button>
              <button className="btn btn-sm join-item" onClick={() => handleFontSizeChange(4)} type="button">
                +
              </button>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="checkbox"
              checked={isHighContrast}
              onChange={(event) => setIsHighContrast(event.target.checked)}
            />
            High contrast
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span>Auto-advance (ms)</span>
            <input
              type="number"
              min={1000}
              max={20000}
              step={500}
              className="input input-bordered input-sm w-24"
              value={intervalMs}
              onChange={handleIntervalChange}
              disabled={!isPlaying}
            />
          </label>
          <button
            className={`btn btn-sm ${isPlaying ? 'btn-secondary' : 'btn-primary'}`}
            onClick={() => setIsPlaying((prev) => !prev)}
            type="button"
            disabled={segments.length <= 1}
          >
            {isPlaying ? 'Pause' : 'Start Timer'}
          </button>
        </div>

        <div
          className={`flex-1 overflow-auto rounded-lg border border-base-content/20 p-6 shadow-inner ${
            isHighContrast ? 'bg-black text-white' : 'bg-base-100 text-base-content'
          }`}
        >
          {segments.length === 0 ? (
            <p className="text-center text-lg opacity-60">No AI responses yet.</p>
          ) : (
            <div style={{ fontSize, lineHeight: 1.4 }} className="whitespace-pre-wrap">
              {currentSegment?.text || ''}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <button className="btn" onClick={handlePrevious} type="button" disabled={currentIndex === 0}>
            Previous
          </button>
          <span className="text-sm opacity-80">
            {segments.length > 0 ? `${currentIndex + 1} / ${segments.length}` : '0 / 0'}
          </span>
          <button
            className="btn"
            onClick={handleNext}
            type="button"
            disabled={currentIndex >= segments.length - 1}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeleprompterViewer;
