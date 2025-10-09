import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { InterviewScenario, getScenarioById } from '../utils/promptBuilder';

export enum KnowledgeCategory {
  Profile = 'profile',
  Document = 'document',
  Conversation = 'conversation',
  ActionItem = 'action_item',
  Feedback = 'feedback',
  General = 'general',
}

export interface KnowledgeEntry {
  id: string;
  content: string;
  category: KnowledgeCategory;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  confidence: number;
  relatedSummaryId?: string;
}

export interface KnowledgeDocument {
  fileName: string;
  title: string;
  content: string;
  path: string;
}

export interface KnowledgeDocumentsState {
  permanent: KnowledgeDocument[];
  project: KnowledgeDocument | null;
  availableProjects: string[];
}

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
  category: KnowledgeCategory;
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
  knowledgeBase: Record<KnowledgeCategory, KnowledgeEntry[]>;
  addToKnowledgeBase: (entry: {
    content: string;
    category?: KnowledgeCategory;
    tags?: string[];
    confidence?: number;
    relatedSummaryId?: string;
  }) => KnowledgeEntry;
  updateKnowledgeEntry: (id: string, updates: Partial<Omit<KnowledgeEntry, 'id'>>) => void;
  deleteKnowledgeEntry: (id: string) => void;
  setKnowledgeBase: (knowledgeBase: Record<KnowledgeCategory, KnowledgeEntry[]>) => void;
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
  knowledgeDocuments: KnowledgeDocumentsState;
  refreshKnowledgeDocuments: () => Promise<void>;
  saveProjectKnowledge: (content: string, fileName?: string) => Promise<void>;
}

const KnowledgeBaseContext = createContext<KnowledgeBaseContextType | undefined>(undefined);

export const KnowledgeBaseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const createEmptyKnowledgeBase = () => ({
    [KnowledgeCategory.Profile]: [] as KnowledgeEntry[],
    [KnowledgeCategory.Document]: [] as KnowledgeEntry[],
    [KnowledgeCategory.Conversation]: [] as KnowledgeEntry[],
    [KnowledgeCategory.ActionItem]: [] as KnowledgeEntry[],
    [KnowledgeCategory.Feedback]: [] as KnowledgeEntry[],
    [KnowledgeCategory.General]: [] as KnowledgeEntry[],
  });

  const [knowledgeBase, setKnowledgeBaseState] = useState<Record<KnowledgeCategory, KnowledgeEntry[]>>(createEmptyKnowledgeBase());
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [displayedAiResult, setDisplayedAiResult] = useState("");
  const [profileSummary, setProfileSummary] = useState<ProfileSummary | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<InterviewScenario>(getScenarioById('general'));
  const [availableTemplates, setAvailableTemplates] = useState<PromptTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [templateContent, setTemplateContent] = useState<string | null>(null);
  const [conversationSummaries, setConversationSummaries] = useState<ConversationSummary[]>([]);
  const [knowledgeDocuments, setKnowledgeDocuments] = useState<KnowledgeDocumentsState>({
    permanent: [],
    project: null,
    availableProjects: [],
  });

  useEffect(() => {
    const savedKnowledgeBase = localStorage.getItem('knowledgeBase');
    const savedConversations = localStorage.getItem('conversations');
    const savedProfileSummary = localStorage.getItem('profileSummary');
    const savedSelectedScenario = localStorage.getItem('selectedScenario');
    const savedSelectedTemplate = localStorage.getItem('selectedTemplate');
    const savedTemplateContent = localStorage.getItem('templateContent');
    const savedConversationSummaries = localStorage.getItem('conversationSummaries');
    
    if (savedKnowledgeBase) {
      try {
        const parsed = JSON.parse(savedKnowledgeBase);
        if (Array.isArray(parsed)) {
          const migrated = createEmptyKnowledgeBase();
          parsed.forEach((item: string, index: number) => {
            const now = Date.now() + index;
            migrated[KnowledgeCategory.General].push({
              id: `legacy_${now}_${Math.random().toString(36).slice(2, 8)}`,
              content: item,
              category: KnowledgeCategory.General,
              tags: [],
              createdAt: now,
              updatedAt: now,
              confidence: 0.5,
            });
          });
          setKnowledgeBaseState(migrated);
        } else if (parsed && typeof parsed === 'object') {
          const normalized = createEmptyKnowledgeBase();
          Object.values(KnowledgeCategory).forEach(category => {
            if (parsed[category] && Array.isArray(parsed[category])) {
              normalized[category] = parsed[category].map((entry: any) => ({
                id: entry.id || `entry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                content: entry.content || '',
                category: entry.category || category,
                tags: Array.isArray(entry.tags) ? entry.tags : [],
                createdAt: entry.createdAt || Date.now(),
                updatedAt: entry.updatedAt || entry.createdAt || Date.now(),
                confidence: typeof entry.confidence === 'number' ? entry.confidence : 0.5,
                relatedSummaryId: entry.relatedSummaryId,
              }));
            }
          });
          setKnowledgeBaseState(normalized);
        } else {
          setKnowledgeBaseState(createEmptyKnowledgeBase());
        }
      } catch (error) {
        console.error('Failed to parse knowledge base data:', error);
        setKnowledgeBaseState(createEmptyKnowledgeBase());
      }
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
      try {
        const parsedSummaries = JSON.parse(savedConversationSummaries);
        if (Array.isArray(parsedSummaries)) {
          setConversationSummaries(parsedSummaries.map((summary: any) => ({
            ...summary,
            category: summary.category || KnowledgeCategory.Conversation,
          })));
        }
      } catch (error) {
        console.error('Failed to parse conversation summaries:', error);
      }
    }

    // Load available templates on startup
    loadAvailableTemplates();
    refreshKnowledgeDocuments();
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

  const addToKnowledgeBase = ({
    content,
    category = KnowledgeCategory.General,
    tags = [],
    confidence = 0.5,
    relatedSummaryId,
  }: {
    content: string;
    category?: KnowledgeCategory;
    tags?: string[];
    confidence?: number;
    relatedSummaryId?: string;
  }): KnowledgeEntry => {
    const now = Date.now();
    const entry: KnowledgeEntry = {
      id: `knowledge_${now}_${Math.random().toString(36).slice(2, 10)}`,
      content,
      category,
      tags,
      createdAt: now,
      updatedAt: now,
      confidence,
      relatedSummaryId,
    };

    setKnowledgeBaseState(prev => ({
      ...prev,
      [category]: [...prev[category], entry],
    }));

    return entry;
  };

  const updateKnowledgeEntry = (id: string, updates: Partial<Omit<KnowledgeEntry, 'id'>>) => {
    setKnowledgeBaseState(prev => {
      let locatedCategory: KnowledgeCategory | null = null;
      let existingEntry: KnowledgeEntry | undefined;

      for (const category of Object.values(KnowledgeCategory)) {
        const found = prev[category].find(entry => entry.id === id);
        if (found) {
          locatedCategory = category;
          existingEntry = found;
          break;
        }
      }

      if (!existingEntry || !locatedCategory) {
        return prev;
      }

      const targetCategory = updates.category ?? locatedCategory;
      const updatedEntry: KnowledgeEntry = {
        ...existingEntry,
        ...updates,
        category: targetCategory,
        updatedAt: Date.now(),
      };

      const newState = { ...prev } as Record<KnowledgeCategory, KnowledgeEntry[]>;
      newState[locatedCategory] = prev[locatedCategory].filter(entry => entry.id !== id);
      newState[targetCategory] = [...prev[targetCategory], updatedEntry];

      return newState;
    });
  };

  const deleteKnowledgeEntry = (id: string) => {
    setKnowledgeBaseState(prev => {
      const newState = { ...prev } as Record<KnowledgeCategory, KnowledgeEntry[]>;
      for (const category of Object.values(KnowledgeCategory)) {
        const entries = prev[category];
        if (entries.some(entry => entry.id === id)) {
          newState[category] = entries.filter(entry => entry.id !== id);
        }
      }
      return newState;
    });
  };

  const setKnowledgeBase = (next: Record<KnowledgeCategory, KnowledgeEntry[]>) => {
    const normalized = createEmptyKnowledgeBase();
    Object.values(KnowledgeCategory).forEach(category => {
      if (Array.isArray(next[category])) {
        normalized[category] = next[category].map(entry => ({
          ...entry,
          category: entry.category ?? category,
        }));
      }
    });
    setKnowledgeBaseState(normalized);
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

  const refreshKnowledgeDocuments = async () => {
    try {
      const context = await window.electronAPI.loadKnowledgeContext();
      setKnowledgeDocuments({
        permanent: context?.permanent || [],
        project: context?.project || null,
        availableProjects: context?.availableProjects || [],
      });
    } catch (error) {
      console.error('Failed to load knowledge documents', error);
    }
  };

  const saveProjectKnowledge = async (content: string, fileName?: string) => {
    try {
      const response = await window.electronAPI.saveProjectKnowledge({ content, fileName });
      if (response?.success) {
        await refreshKnowledgeDocuments();
      } else if (response?.error) {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('Failed to save project knowledge', error);
      throw error;
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
    setKnowledgeBaseState(prev => {
      const next = { ...prev } as Record<KnowledgeCategory, KnowledgeEntry[]>;
      Object.values(KnowledgeCategory).forEach(category => {
        next[category] = prev[category].filter(entry => entry.relatedSummaryId !== id);
      });
      return next;
    });
  };

  const clearConversationSummaries = () => {
    setConversationSummaries([]);
    setKnowledgeBaseState(prev => {
      const next = { ...prev } as Record<KnowledgeCategory, KnowledgeEntry[]>;
      Object.values(KnowledgeCategory).forEach(category => {
        next[category] = prev[category].filter(entry => !entry.relatedSummaryId);
      });
      return next;
    });
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
        updateKnowledgeEntry,
        deleteKnowledgeEntry,
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
        knowledgeDocuments,
        refreshKnowledgeDocuments,
        saveProjectKnowledge,
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
