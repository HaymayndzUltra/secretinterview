import React, { createContext, useState, useContext, ReactNode } from 'react';

export interface ResponseSegment {
  id: string;
  text: string;
  metadata?: {
    timestamp: number;
  };
}

interface InterviewContextType {
  currentText: string;
  setCurrentText: React.Dispatch<React.SetStateAction<string>>;
  aiResult: string;
  setAiResult: React.Dispatch<React.SetStateAction<string>>;
  displayedAiResult: ResponseSegment[];
  setDisplayedAiResult: React.Dispatch<React.SetStateAction<ResponseSegment[]>>;
  lastProcessedIndex: number;
  setLastProcessedIndex: React.Dispatch<React.SetStateAction<number>>;
  autoScrollEnabled: boolean;
  setAutoScrollEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  teleprompterMode: boolean;
  setTeleprompterMode: React.Dispatch<React.SetStateAction<boolean>>;
}

const InterviewContext = createContext<InterviewContextType | undefined>(undefined);

export const InterviewProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentText, setCurrentText] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [displayedAiResult, setDisplayedAiResult] = useState<ResponseSegment[]>([]);
  const [lastProcessedIndex, setLastProcessedIndex] = useState(0);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState<boolean>(() => {
    try {
      const storedValue = localStorage.getItem('interview-auto-scroll');
      if (storedValue === null) {
        return true;
      }
      return storedValue === 'true';
    } catch (error) {
      console.warn('Failed to read auto scroll preference', error);
      return true;
    }
  });
  const [teleprompterMode, setTeleprompterMode] = useState(false);

  React.useEffect(() => {
    try {
      localStorage.setItem('interview-auto-scroll', String(autoScrollEnabled));
    } catch (error) {
      console.warn('Failed to persist auto scroll preference', error);
    }
  }, [autoScrollEnabled]);

  return (
    <InterviewContext.Provider
      value={{
        currentText,
        setCurrentText,
        aiResult,
        setAiResult,
        displayedAiResult,
        setDisplayedAiResult,
        lastProcessedIndex,
        setLastProcessedIndex,
        autoScrollEnabled,
        setAutoScrollEnabled,
        teleprompterMode,
        setTeleprompterMode,
      }}
    >
      {children}
    </InterviewContext.Provider>
  );
};

export const useInterview = () => {
  const context = useContext(InterviewContext);
  if (context === undefined) {
    throw new Error('useInterview must be used within an InterviewProvider');
  }
  return context;
};