import { ConversationSummary, KnowledgeCategory } from '../contexts/KnowledgeBaseContext';

export interface SummaryGenerationRequest {
  userMessage: string;
  assistantResponse: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

export interface SummaryGenerationResult {
  summary: string;
  tags: string[];
  embedding?: number[];
}

/**
 * Generates a conversation summary using the local LLM
 */
export async function generateConversationSummary(
  request: SummaryGenerationRequest,
  unifiedKnowledgeContext?: string
): Promise<SummaryGenerationResult> {
  try {
    const config = await window.electronAPI.getConfig();

    const knowledgePrefix = unifiedKnowledgeContext ? `${unifiedKnowledgeContext}\n\n` : '';

    const summaryPrompt = `${knowledgePrefix}You are an AI assistant that creates concise summaries of conversations for long-term memory storage.

Please analyze the following conversation exchange and create:
1. A concise summary (2-3 sentences) that captures the key points and outcomes
2. Relevant tags (3-5 tags) that would help with future retrieval

Conversation:
User: ${request.userMessage}
Assistant: ${request.assistantResponse}

${request.conversationHistory ? `
Previous context:
${request.conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}
` : ''}

Please respond in the following JSON format:
{
  "summary": "Brief summary of the conversation",
  "tags": ["tag1", "tag2", "tag3"]
}`;

    const response = await window.electronAPI.invokeLocalLlm({
      config: config,
      messages: [
        {
          role: "system",
          content: `${knowledgePrefix}You are a helpful assistant that creates structured summaries for conversation memory. Always ground insights in the AI Governor Framework and respect existing knowledge.`
        },
        { role: "user", content: summaryPrompt }
      ]
    });

    if ('error' in response) {
      throw new Error(response.error);
    }

    try {
      const parsed = JSON.parse(response.content);
      return {
        summary: parsed.summary || 'No summary generated',
        tags: parsed.tags || ['conversation']
      };
    } catch (parseError) {
      // Fallback if JSON parsing fails
      return {
        summary: response.content || 'No summary generated',
        tags: ['conversation', 'unparsed']
      };
    }
  } catch (error) {
    console.error('Failed to generate conversation summary:', error);
    return {
      summary: `Error generating summary: ${error.message}`,
      tags: ['error', 'conversation']
    };
  }
}

/**
 * Generates embeddings for text using a lightweight hash (placeholder for local embeddings)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const config = await window.electronAPI.getConfig();
    
    // For now, we'll use a simple hash-based approach since local embedding
    // generation might differ between deployments
    // In a production system, you'd call your embedding pipeline here
    
    // Simple hash-based "embedding" for demonstration
    const hash = text.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    // Create a simple vector representation
    const embedding = Array.from({ length: 10 }, (_, i) => 
      Math.sin(hash + i) * Math.cos(hash - i)
    );
    
    return embedding;
  } catch (error) {
    console.error('Failed to generate embedding:', error);
    return Array.from({ length: 10 }, () => 0);
  }
}

/**
 * Creates a conversation summary object
 */
export function createConversationSummary(
  userMessage: string,
  assistantResponse: string,
  summaryData: SummaryGenerationResult,
  category: KnowledgeCategory
): ConversationSummary {
  return {
    id: `summary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    summary: summaryData.summary,
    tags: summaryData.tags,
    embedding: summaryData.embedding,
    pinned: false,
    category,
    conversationContext: {
      userMessage,
      assistantResponse
    }
  };
}

function determineSummaryCategory(summary: string, tags: string[]): KnowledgeCategory {
  const normalizedText = `${summary} ${tags.join(' ')}`.toLowerCase();

  const containsAny = (keywords: string[]) => keywords.some(keyword => normalizedText.includes(keyword));

  if (containsAny(['resume', 'profile', 'background', 'experience', 'skill'])) {
    return KnowledgeCategory.Profile;
  }

  if (containsAny(['document', 'upload', 'transcript', 'reference'])) {
    return KnowledgeCategory.Document;
  }

  if (containsAny(['follow-up', 'todo', 'next step', 'action', 'task', 'reminder'])) {
    return KnowledgeCategory.ActionItem;
  }

  if (containsAny(['feedback', 'strength', 'weakness', 'improve', 'evaluation'])) {
    return KnowledgeCategory.Feedback;
  }

  return KnowledgeCategory.Conversation;
}

export interface ProcessedConversationExchange {
  conversationSummary: ConversationSummary;
  knowledgeCategory: KnowledgeCategory;
}

/**
 * Processes a conversation exchange and creates a summary
 */
export async function processConversationExchange(
  userMessage: string,
  assistantResponse: string,
  conversationHistory?: Array<{ role: string; content: string }>,
  unifiedKnowledgeContext?: string
): Promise<ProcessedConversationExchange> {
  const summaryData = await generateConversationSummary({
    userMessage,
    assistantResponse,
    conversationHistory
  }, unifiedKnowledgeContext);

  // Generate embedding if requested
  if (summaryData.embedding === undefined) {
    summaryData.embedding = await generateEmbedding(
      `${summaryData.summary} ${summaryData.tags.join(' ')}`
    );
  }

  const category = determineSummaryCategory(summaryData.summary, summaryData.tags);

  return {
    conversationSummary: createConversationSummary(userMessage, assistantResponse, summaryData, category),
    knowledgeCategory: category,
  };
}

/**
 * Calculates cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Finds similar summaries using embedding similarity
 */
export function findSimilarSummaries(
  summaries: ConversationSummary[],
  queryEmbedding: number[],
  threshold: number = 0.7,
  limit: number = 5
): ConversationSummary[] {
  return summaries
    .filter(summary => summary.embedding)
    .map(summary => ({
      summary,
      similarity: cosineSimilarity(queryEmbedding, summary.embedding!)
    }))
    .filter(item => item.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
    .map(item => item.summary);
}
