import React, { createContext, useState, useContext, ReactNode } from 'react';

export interface Suggestion {
  id: string;
  title: string;
  content: string;
  confidence?: number;
}

interface InterviewContextType {
  currentText: string;
  setCurrentText: React.Dispatch<React.SetStateAction<string>>;
  aiResult: string;
  setAiResult: React.Dispatch<React.SetStateAction<string>>;
  displayedAiResult: string;
  setDisplayedAiResult: React.Dispatch<React.SetStateAction<string>>;
  lastProcessedIndex: number;
  setLastProcessedIndex: React.Dispatch<React.SetStateAction<number>>;
  suggestions: Suggestion[];
  setSuggestions: React.Dispatch<React.SetStateAction<Suggestion[]>>;
}

const InterviewContext = createContext<InterviewContextType | undefined>(undefined);

export const InterviewProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentText, setCurrentText] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [displayedAiResult, setDisplayedAiResult] = useState("");
  const [lastProcessedIndex, setLastProcessedIndex] = useState(0);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

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
        suggestions,
        setSuggestions,
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