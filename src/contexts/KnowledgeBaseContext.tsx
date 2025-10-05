import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { InterviewScenario, getScenarioById } from '../utils/promptBuilder';

interface Conversation {
  role: string;
  content: string;
}

export interface ProfileSummary {
  skills: string[];
  experience: string[];
  projects: string[];
  education: string[];
}

export interface ConversationSummary {
  id: string;
  timestamp: number;
  summary: string;
  tags: string[];
  embedding?: number[];
  pinned: boolean;
  conversationContext: {
    userMessage: string;
    assistantResponse: string;
  };
}

interface PromptTemplate {
  name: string;
  filename: string;
}

interface KnowledgeBaseContextType {
  knowledgeBase: string[];
  addToKnowledgeBase: (content: string) => void;
  setKnowledgeBase: (knowledgeBase: string[]) => void;
  conversations: Conversation[];
  addConversation: (conversation: Conversation) => void;
  clearConversations: () => void;
  displayedAiResult: string;
  setDisplayedAiResult: React.Dispatch<React.SetStateAction<string>>;
  profileSummary: ProfileSummary | null;
  setProfileSummary: (profileSummary: ProfileSummary | null) => void;
  selectedScenario: InterviewScenario;
  setSelectedScenario: (scenario: InterviewScenario) => void;
  setSelectedScenarioById: (scenarioId: string) => void;
  availableTemplates: PromptTemplate[];
  setAvailableTemplates: (templates: PromptTemplate[]) => void;
  selectedTemplate: string | null;
  setSelectedTemplate: (templateName: string | null) => void;
  templateContent: string | null;
  setTemplateContent: (content: string | null) => void;
  loadTemplateContent: (templateName: string) => Promise<void>;
  conversationSummaries: ConversationSummary[];
  addConversationSummary: (summary: ConversationSummary) => void;
  updateConversationSummary: (id: string, updates: Partial<ConversationSummary>) => void;
  deleteConversationSummary: (id: string) => void;
  clearConversationSummaries: () => void;
  getRelevantSummaries: (query: string, limit?: number) => Promise<ConversationSummary[]>;
}

const KnowledgeBaseContext = createContext<KnowledgeBaseContextType | undefined>(undefined);

export const KnowledgeBaseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [knowledgeBase, setKnowledgeBase] = useState<string[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [displayedAiResult, setDisplayedAiResult] = useState("");
  const [profileSummary, setProfileSummary] = useState<ProfileSummary | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<InterviewScenario>(getScenarioById('general'));
  const [availableTemplates, setAvailableTemplates] = useState<PromptTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [templateContent, setTemplateContent] = useState<string | null>(null);
  const [conversationSummaries, setConversationSummaries] = useState<ConversationSummary[]>([]);

  useEffect(() => {
    const savedKnowledgeBase = localStorage.getItem('knowledgeBase');
    const savedConversations = localStorage.getItem('conversations');
    const savedProfileSummary = localStorage.getItem('profileSummary');
    const savedSelectedScenario = localStorage.getItem('selectedScenario');
    const savedSelectedTemplate = localStorage.getItem('selectedTemplate');
    const savedTemplateContent = localStorage.getItem('templateContent');
    const savedConversationSummaries = localStorage.getItem('conversationSummaries');
    
    if (savedKnowledgeBase) {
      setKnowledgeBase(JSON.parse(savedKnowledgeBase));
    }
    if (savedConversations) {
      setConversations(JSON.parse(savedConversations));
    }
    if (savedProfileSummary) {
      setProfileSummary(JSON.parse(savedProfileSummary));
    }
    if (savedSelectedScenario) {
      setSelectedScenario(JSON.parse(savedSelectedScenario));
    }
    if (savedSelectedTemplate) {
      setSelectedTemplate(savedSelectedTemplate);
    }
    if (savedTemplateContent) {
      setTemplateContent(savedTemplateContent);
    }
    if (savedConversationSummaries) {
      setConversationSummaries(JSON.parse(savedConversationSummaries));
    }
    
    // Load available templates on startup
    loadAvailableTemplates();
  }, []);

  useEffect(() => {
    localStorage.setItem('knowledgeBase', JSON.stringify(knowledgeBase));
  }, [knowledgeBase]);

  useEffect(() => {
    localStorage.setItem('conversations', JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    localStorage.setItem('profileSummary', JSON.stringify(profileSummary));
  }, [profileSummary]);

  useEffect(() => {
    localStorage.setItem('selectedScenario', JSON.stringify(selectedScenario));
  }, [selectedScenario]);

  useEffect(() => {
    if (selectedTemplate !== null) {
      localStorage.setItem('selectedTemplate', selectedTemplate);
    }
  }, [selectedTemplate]);

  useEffect(() => {
    if (templateContent !== null) {
      localStorage.setItem('templateContent', templateContent);
    }
  }, [templateContent]);

  useEffect(() => {
    localStorage.setItem('conversationSummaries', JSON.stringify(conversationSummaries));
  }, [conversationSummaries]);

  const addToKnowledgeBase = (content: string) => {
    setKnowledgeBase(prev => [...prev, content]);
  };

  const addConversation = (conversation: Conversation) => {
    setConversations(prev => [...prev, conversation]);
  };

  const clearConversations = () => {
    setConversations([]);
  };

  const setSelectedScenarioById = (scenarioId: string) => {
    setSelectedScenario(getScenarioById(scenarioId));
  };

  const loadAvailableTemplates = async () => {
    try {
      const result = await window.electronAPI.listPromptTemplates();
      if ('templates' in result) {
        setAvailableTemplates(result.templates);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const loadTemplateContent = async (templateName: string) => {
    try {
      const result = await window.electronAPI.readPromptTemplate(templateName);
      if ('content' in result) {
        setTemplateContent(result.content);
        setSelectedTemplate(templateName);
      } else {
        console.error('Failed to load template:', result.error);
      }
    } catch (error) {
      console.error('Failed to load template content:', error);
    }
  };

  // Conversation summary management functions
  const addConversationSummary = (summary: ConversationSummary) => {
    setConversationSummaries(prev => [...prev, summary]);
  };

  const updateConversationSummary = (id: string, updates: Partial<ConversationSummary>) => {
    setConversationSummaries(prev => 
      prev.map(summary => 
        summary.id === id ? { ...summary, ...updates } : summary
      )
    );
  };

  const deleteConversationSummary = (id: string) => {
    setConversationSummaries(prev => prev.filter(summary => summary.id !== id));
  };

  const clearConversationSummaries = () => {
    setConversationSummaries([]);
  };

  const getRelevantSummaries = async (query: string, limit: number = 5): Promise<ConversationSummary[]> => {
    // Simple tag-based matching for now
    // In a more sophisticated implementation, this would use embeddings for similarity search
    const queryLower = query.toLowerCase();
    
    const relevantSummaries = conversationSummaries
      .filter(summary => {
        // Check if any tags match the query
        const tagMatch = summary.tags.some(tag => 
          tag.toLowerCase().includes(queryLower) || queryLower.includes(tag.toLowerCase())
        );
        
        // Check if summary content matches
        const contentMatch = summary.summary.toLowerCase().includes(queryLower);
        
        // Check if conversation context matches
        const contextMatch = 
          summary.conversationContext.userMessage.toLowerCase().includes(queryLower) ||
          summary.conversationContext.assistantResponse.toLowerCase().includes(queryLower);
        
        return tagMatch || contentMatch || contextMatch;
      })
      .sort((a, b) => {
        // Prioritize pinned summaries
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        
        // Then sort by timestamp (most recent first)
        return b.timestamp - a.timestamp;
      })
      .slice(0, limit);
    
    return relevantSummaries;
  };

  return (
    <KnowledgeBaseContext.Provider
      value={{
        knowledgeBase,
        addToKnowledgeBase,
        setKnowledgeBase,
        conversations,
        addConversation,
        clearConversations,
        displayedAiResult,
        setDisplayedAiResult,
        profileSummary,
        setProfileSummary,
        selectedScenario,
        setSelectedScenario,
        setSelectedScenarioById,
        availableTemplates,
        setAvailableTemplates,
        selectedTemplate,
        setSelectedTemplate,
        templateContent,
        setTemplateContent,
        loadTemplateContent,
        conversationSummaries,
        addConversationSummary,
        updateConversationSummary,
        deleteConversationSummary,
        clearConversationSummaries,
        getRelevantSummaries,
      }}
    >
      {children}
    </KnowledgeBaseContext.Provider>
  );
};

export const useKnowledgeBase = () => {
  const context = useContext(KnowledgeBaseContext);
  if (context === undefined) {
    throw new Error('useKnowledgeBase must be used within a KnowledgeBaseProvider');
  }
  return context;
};
