import React, { useMemo, useState, useRef } from 'react';
import { useKnowledgeBase, ProfileSummary, KnowledgeCategory, KnowledgeEntry } from '../contexts/KnowledgeBaseContext';
import { useError } from '../contexts/ErrorContext';
import ErrorDisplay from '../components/ErrorDisplay';
import ProfileSummaryCard from '../components/ProfileSummaryCard';
import TemplateSelector from '../components/TemplateSelector';
import ConversationMemoryManager from '../components/ConversationMemoryManager';
import OpenAI from 'openai';
import ReactMarkdown from 'react-markdown';
import { FaFile, FaImage } from 'react-icons/fa';
import { extractProfileFromText } from '../services/profileExtractor';
import { buildInterviewPrompt } from '../utils/promptBuilder';
import { processConversationExchange } from '../services/conversationMemory';

interface UploadedFile extends File {
  pdfText?: string;
  error?: string;
}

const KnowledgeBase: React.FC = () => {
  const { 
    knowledgeBase,
    addToKnowledgeBase,
    deleteKnowledgeEntry,
    conversations,
    addConversation, 
    clearConversations,
    displayedAiResult,
    setDisplayedAiResult,
    profileSummary,
    setProfileSummary,
    selectedScenario,
    templateContent,
    addConversationSummary,
    getRelevantSummaries
  } = useKnowledgeBase();
  const { error, setError, clearError } = useError();
  const [chatInput, setChatInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedKnowledgeCategory, setSelectedKnowledgeCategory] = useState<KnowledgeCategory>(KnowledgeCategory.Profile);

  const categorizedKnowledgeEntries = useMemo(() => {
    const base = Object.values(KnowledgeCategory).reduce((acc, category) => {
      acc[category] = [] as KnowledgeEntry[];
      return acc;
    }, {} as Record<KnowledgeCategory, KnowledgeEntry[]>);

    Object.values(KnowledgeCategory).forEach(category => {
      base[category] = [...(knowledgeBase[category] || [])].sort((a, b) => b.updatedAt - a.updatedAt);
    });

    return base;
  }, [knowledgeBase]);

  const knowledgeEntriesForPrompt = useMemo(() => {
    const prioritizedCategories = [
      KnowledgeCategory.ActionItem,
      KnowledgeCategory.Feedback,
      KnowledgeCategory.Document,
      KnowledgeCategory.Profile,
      KnowledgeCategory.General,
    ];

    return prioritizedCategories
      .flatMap(category => categorizedKnowledgeEntries[category] || [])
      .slice(0, 12);
  }, [categorizedKnowledgeEntries]);

  const handleExportKnowledge = (category: KnowledgeCategory) => {
    const entries = categorizedKnowledgeEntries[category] || [];
    if (entries.length === 0) {
      return;
    }

    const exportPayload = entries.map(entry => ({
      id: entry.id,
      content: entry.content,
      tags: entry.tags,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      confidence: entry.confidence,
    }));

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `knowledge-${category}-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteKnowledgeEntry = (id: string) => {
    if (window.confirm('Are you sure you want to remove this knowledge entry?')) {
      deleteKnowledgeEntry(id);
    }
  };

  const formatTimestamp = (timestamp: number) => new Date(timestamp).toLocaleString();

  const selectedKnowledgeEntries = categorizedKnowledgeEntries[selectedKnowledgeCategory] || [];

  const markdownStyles = `
    .markdown-body {
      font-size: 14px;
      line-height: 1.2;
    }
    .markdown-body p {
      margin-bottom: 4px;
    }
    .markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4, .markdown-body h5, .markdown-body h6 {
      margin-top: 8px;
      margin-bottom: 4px;
      font-weight: 600;
      line-height: 1.1;
    }
    .markdown-body code {
      padding: 0.1em 0.3em;
      margin: 0;
      font-size: 85%;
      background-color: rgba(27,31,35,0.05);
      border-radius: 3px;
    }
    .markdown-body pre {
      word-wrap: normal;
      padding: 8px;
      overflow: auto;
      font-size: 85%;
      line-height: 1.2;
      background-color: #f6f8fa;
      border-radius: 3px;
    }
    .markdown-body ul, .markdown-body ol {
      margin-bottom: 4px;
    }
    .markdown-body li {
      margin-bottom: 2px;
    }
  `;

  // Handler for updating profile summary
  const handleUpdateProfile = (updatedProfile: ProfileSummary) => {
    setProfileSummary(updatedProfile);
  };

  // Handler for clearing profile summary
  const handleClearProfile = () => {
    setProfileSummary(null);
  };

  const simulateTyping = (text: string) => {
    let i = 0;
    setDisplayedAiResult('');  
    const interval = setInterval(() => {
      if (i <= text.length) {
        setDisplayedAiResult(text.slice(0, i));
        i++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setDisplayedAiResult((prev) => prev + '\n\n');
        }, 500);
      }
    }, 10);
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() && uploadedFiles.length === 0) return;

    try {
      setIsLoading(true);
      let fileContents: string[] = [];

      if (uploadedFiles.length > 0) {
        for (const file of uploadedFiles) {
          if ('pdfText' in file) {
            fileContents.push(file.pdfText);
          } else if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            const content = await new Promise<string>((resolve) => {
              reader.onload = (e) => resolve(e.target?.result as string);
              reader.readAsDataURL(file);
            });
            fileContents.push(content);
          } else {
            const reader = new FileReader();
            const content = await new Promise<string>((resolve) => {
              reader.onload = (e) => resolve(e.target?.result as string);
              reader.readAsText(file);
            });
            fileContents.push(content);
          }
        }
      }

      const userMessage = chatInput.trim() 
        ? (uploadedFiles.length > 0
          ? `[Files: ${uploadedFiles.map(f => f.name).join(', ')}] ${chatInput}` 
          : chatInput)
        : (uploadedFiles.length > 0
          ? `Please analyze the attached files: ${uploadedFiles.map(f => f.name).join(', ')}` 
          : "");
      addConversation({ role: "user", content: userMessage });

      const config = await window.electronAPI.getConfig();
      
      // Build the system prompt using the prompt builder
      let systemPrompt = buildInterviewPrompt(profileSummary, selectedScenario, knowledgeBase);
      
      // Merge template content if available
      if (templateContent) {
        systemPrompt = `${systemPrompt}\n\n## Additional Template Instructions\n\n${templateContent}`;
      }

      // Get relevant conversation summaries
      const relevantSummaries = await getRelevantSummaries(userMessage, 3);
      
      // Build conversation context from summaries
      let conversationContext = '';
      if (relevantSummaries.length > 0) {
        conversationContext = '\n\n## Previous Conversation Context\n\n';
        relevantSummaries.forEach((summary, index) => {
          conversationContext += `**Previous Discussion ${index + 1}:**\n`;
          conversationContext += `Summary: ${summary.summary}\n`;
          conversationContext += `Tags: ${summary.tags.join(', ')}\n`;
          if (summary.pinned) {
            conversationContext += `(Pinned)\n`;
          }
          conversationContext += '\n';
        });
      }
      
      const knowledgeMessages: OpenAI.Chat.ChatCompletionMessageParam[] = knowledgeEntriesForPrompt.map(entry => {
        if (entry.content.startsWith('data:image')) {
          return {
            role: "user",
            content: [{ type: "image_url", image_url: { url: entry.content } } as const],
          } as OpenAI.Chat.ChatCompletionUserMessageParam;
        }

        const formattedContent = `[${entry.category.toUpperCase()} | confidence:${entry.confidence.toFixed(2)}] ${entry.content}`;
        return { role: "user", content: formattedContent } as OpenAI.Chat.ChatCompletionUserMessageParam;
      });

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt + conversationContext },
        ...knowledgeMessages,
        // Only include recent conversations (last 5 exchanges) to avoid token limits
        ...conversations.slice(-10).map(conv => ({
          role: conv.role,
          content: conv.content
        }) as OpenAI.Chat.ChatCompletionMessageParam),
      ];

      if (fileContents.length > 0) {
        for (const content of fileContents) {
          if (content.startsWith('data:image')) {
            messages.push({
              role: "user",
              content: [{ type: "image_url", image_url: { url: content } } as const]
            } as OpenAI.Chat.ChatCompletionUserMessageParam);
          } else {
            messages.push({ role: "user", content: content } as OpenAI.Chat.ChatCompletionUserMessageParam);
          }
        }
      }

      messages.push({ role: "user", content: userMessage } as OpenAI.Chat.ChatCompletionUserMessageParam);

      setChatInput("");
      setUploadedFiles([]);

      const response = await window.electronAPI.callOpenAI({
        config: config,
        messages: messages
      });

      if ('error' in response) {
        throw new Error(response.error);
      }

      if (typeof response.content !== 'string') {
        throw new Error('Unexpected API response structure');
      }

      addConversation({ role: "assistant", content: response.content });
      simulateTyping(response.content);
      
      // Generate conversation summary for long-term memory
      try {
        const { conversationSummary, knowledgeCategory } = await processConversationExchange(
          userMessage,
          response.content,
          conversations.slice(-6) // Include recent context
        );
        addConversationSummary(conversationSummary);
        addToKnowledgeBase({
          content: conversationSummary.summary,
          category: knowledgeCategory,
          tags: conversationSummary.tags,
          confidence: 0.7,
          relatedSummaryId: conversationSummary.id,
        });
      } catch (summaryError) {
        console.error('Failed to generate conversation summary:', summaryError);
        // Don't fail the main conversation if summary generation fails
      }
    } catch (error) {
      setError('Failed to get response from GPT. Please try again.');
      console.error('Detailed error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newFiles = Array.from(files);
      if (uploadedFiles.length + newFiles.length > 3) {
        setError('You can only upload up to 3 files.');
        return;
      }
      console.log('Processing files:', newFiles.map(f => ({ name: f.name, type: f.type })));
      const processedFiles = await Promise.all(newFiles.map(async (file) => {
        if (file.type === 'application/pdf') {
          const arrayBuffer = await file.arrayBuffer();
          console.log('Calling parsePDF for file:', file.name);
          const result = await window.electronAPI.parsePDF(arrayBuffer);
          console.log('parsePDF response received:', result);
          if (result.error) {
            console.error('Error parsing PDF:', result.error);
            return { ...file, error: result.error } as UploadedFile;
          }
          return { ...file, pdfText: result.text, name: file.name, type: file.type } as UploadedFile;
        }
        return file as UploadedFile;
      }));
      console.log('Processed files:', processedFiles);
      
      // Extract profile information from text-based files
      const textFiles = processedFiles.filter(file => 
        file.pdfText || 
        (file.type && (file.type.startsWith('text/') || file.type === 'application/pdf'))
      );
      
      if (textFiles.length > 0) {
        try {
          // Combine all text content for profile extraction
          const combinedText = textFiles.map(file => {
            if (file.pdfText) {
              return file.pdfText;
            } else if (file.type && file.type.startsWith('text/')) {
              // For text files, we'll need to read them
              return new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target?.result as string || '');
                reader.readAsText(file);
              });
            }
            return '';
          }).join('\n\n');

          // Wait for all text content to be read
          const allTextContent = await Promise.all(
            textFiles.map(async (file) => {
              if (file.pdfText) {
                return file.pdfText;
              } else if (file.type && file.type.startsWith('text/')) {
                return new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.onload = (e) => resolve(e.target?.result as string || '');
                  reader.readAsText(file);
                });
              }
              return '';
            })
          );

          const combinedTextContent = allTextContent.join('\n\n');
          
          if (combinedTextContent.trim()) {
            console.log('Extracting profile from text content...');
            const extractionResult = await extractProfileFromText(combinedTextContent);
            
            if (extractionResult.success && extractionResult.profileSummary) {
              console.log('Profile extraction successful:', extractionResult.profileSummary);
              setProfileSummary(extractionResult.profileSummary);
              
              // Also add the raw content to knowledge base for traceability
              addToKnowledgeBase({
                content: `[Profile Document] ${textFiles.map(f => f.name).join(', ')}\n\n${combinedTextContent}`,
                category: KnowledgeCategory.Profile,
                tags: ['profile', 'document'],
                confidence: 0.9,
              });
            } else {
              console.warn('Profile extraction failed:', extractionResult.error);
              // Still add raw content to knowledge base even if extraction fails
              addToKnowledgeBase({
                content: `[Document] ${textFiles.map(f => f.name).join(', ')}\n\n${combinedTextContent}`,
                category: KnowledgeCategory.Document,
                tags: textFiles.map(f => f.name),
                confidence: 0.6,
              });
            }
          }
        } catch (error) {
          console.error('Error during profile extraction:', error);
          // Continue with file upload even if profile extraction fails
        }
      }
      
      setUploadedFiles(prevFiles => [...prevFiles, ...processedFiles]);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-2.5rem)] p-2 max-w-4xl mx-auto">
      <style>{markdownStyles}</style>
      <ErrorDisplay error={error} onClose={clearError} />
      <h1 className="text-xl font-bold mb-1">Knowledge Base Chat</h1>
      
      {/* Template Selector */}
      <TemplateSelector className="mb-4" />
      
      {/* Profile Summary Card */}
      <ProfileSummaryCard
        profileSummary={profileSummary}
        onUpdateProfile={handleUpdateProfile}
        onClearProfile={handleClearProfile}
      />

      {/* Knowledge Base Overview */}
      <div className="card bg-base-100 shadow-md mb-4">
        <div className="card-body p-4 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="card-title text-lg">Knowledge Base Entries</h2>
              <p className="text-sm text-base-content/70">Filter, review, and export saved knowledge snippets.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                className="select select-bordered select-sm"
                value={selectedKnowledgeCategory}
                onChange={(event) => setSelectedKnowledgeCategory(event.target.value as KnowledgeCategory)}
              >
                {Object.values(KnowledgeCategory).map(category => (
                  <option key={category} value={category}>
                    {category.replace('_', ' ').toUpperCase()}
                  </option>
                ))}
              </select>
              <button
                className="btn btn-sm btn-outline"
                onClick={() => handleExportKnowledge(selectedKnowledgeCategory)}
                disabled={selectedKnowledgeEntries.length === 0}
              >
                Export
              </button>
            </div>
          </div>

          {selectedKnowledgeEntries.length === 0 ? (
            <div className="text-sm text-base-content/60">
              No entries available for this category yet.
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {selectedKnowledgeEntries.map(entry => (
                <div key={entry.id} className="border border-base-300 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="text-xs text-base-content/60">
                        Updated {formatTimestamp(entry.updatedAt)}
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{entry.content}</p>
                      {entry.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {entry.tags.map(tag => (
                            <span key={tag} className="badge badge-outline badge-xs">{tag}</span>
                          ))}
                        </div>
                      )}
                      <div className="text-xs text-base-content/60">
                        Confidence: {(entry.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                    <button
                      className="btn btn-xs btn-ghost"
                      onClick={() => handleDeleteKnowledgeEntry(entry.id)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Conversation Memory Manager */}
      <ConversationMemoryManager className="mb-4" />
      <div className="flex-1 overflow-auto mb-4 border-2 border-gray-300 rounded-lg p-4 bg-base-100 shadow-md">
        {conversations.map((conv, index) => (
          <div key={index} className={`mb-2 ${conv.role === 'user' ? 'text-right' : 'text-left'}`}>
            <div className={`inline-block p-2 rounded-lg ${
              conv.role === 'user' ? 'bg-primary text-primary-content' : 'bg-secondary text-secondary-content'
            }`}>
              {conv.role === 'user' ? (
                <span>
                  {conv.content.startsWith('[Files:') ? (
                    <>
                      {conv.content.includes('image') ? <FaImage className="inline mr-1" /> : <FaFile className="inline mr-1" />}
                      {conv.content}
                    </>
                  ) : (
                    conv.content
                  )}
                </span>
              ) : (
                index === conversations.length - 1 ? (
                  <ReactMarkdown className="markdown-body">{displayedAiResult}</ReactMarkdown>
                ) : (
                  <ReactMarkdown className="markdown-body">{conv.content}</ReactMarkdown>
                )
              )}
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={handleChatSubmit} className="flex mb-4">
        <button 
          type="button" 
          onClick={() => fileInputRef.current?.click()} 
          className="btn btn-accent mr-2"
        >
          Upload
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png"
          multiple
        />
        <input
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          className="input input-bordered flex-grow mr-2"
          placeholder="Type your message..."
        />
        <button type="submit" className="btn btn-primary" disabled={isLoading}>
          Send
        </button>
      </form>
      <button onClick={() => {
        clearConversations();
        setDisplayedAiResult("");
      }} className="btn btn-secondary w-full mb-4">
        Clear Chat
      </button>
      {uploadedFiles.length > 0 && (
        <div className="flex flex-wrap items-center mb-1 p-2 bg-base-200 rounded-lg">
          {uploadedFiles.map((file, index) => (
            <div key={index} className="flex items-center mr-2 mb-1">
              {file && file.type ? (
                file.type.startsWith('image/') ? (
                  <FaImage className="mr-1 text-primary" />
                ) : (
                  <FaFile className="mr-1 text-primary" />
                )
              ) : (
                <FaFile className="mr-1 text-primary" />
              )}
              <span className="mr-1">
                {file && file.name ? (file.name.length > 20 ? file.name.substring(0, 20) + '...' : file.name) : 'Unknown file'}
              </span>
              <button
                onClick={() => setUploadedFiles(files => files.filter((_, i) => i !== index))}
                className="btn btn-xs btn-circle btn-ghost"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default KnowledgeBase;
