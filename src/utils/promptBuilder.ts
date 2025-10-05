import { KnowledgeCategory, KnowledgeEntry, ProfileSummary } from '../contexts/KnowledgeBaseContext';

export interface InterviewScenario {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  instructions: string[];
}

export const INTERVIEW_SCENARIOS: InterviewScenario[] = [
  {
    id: 'technical',
    name: 'Technical Interview Assistant',
    description: 'Suggestions for technical interview questions and responses',
    systemPrompt: 'You are helping prepare for technical interviews. Provide suggestions for technical questions, coding challenges, and how to respond to technical topics.',
    instructions: [
      'Suggest technical questions they might face',
      'Provide coding challenge examples and solutions',
      'Help prepare problem-solving approaches',
      'Suggest how to discuss relevant technologies',
      'Help prepare responses about tools and frameworks'
    ]
  },
  {
    id: 'behavioral',
    name: 'Behavioral Interview Assistant',
    description: 'Use a conversational and approachable tone that resonates with human interviewers. Avoid technical jargon, complex language, or overly formal expressions. Provide concise and relevant answers that directly address the interview questions without unnecessary elaboration. Refrain from including code snippets unless the interview question specifically requires discussing or reviewing code. Ensure language simplicity, maintaining clarity and appropriateness without overcomplicating English usage. Tailor answers to be authentic and practical, suitable for real interview scenarios.',
    systemPrompt: 'You are helping prepare for behavioral interviews. Use a conversational and approachable tone that resonates with human interviewers. Avoid technical jargon, complex language, or overly formal expressions. Provide concise and relevant answers that directly address the interview questions without unnecessary elaboration. Refrain from including code snippets unless the interview question specifically requires discussing or reviewing code. Ensure language simplicity, maintaining clarity and appropriateness without overcomplicating English usage. Tailor answers to be authentic and practical, suitable for real interview scenarios.',
    instructions: [
      'Use conversational and approachable tone that resonates with human interviewers',
      'Avoid technical jargon, complex language, or overly formal expressions',
      'Provide concise and relevant answers without unnecessary elaboration',
      'Refrain from including code snippets unless specifically required',
      'Ensure language simplicity and clarity without overcomplicating English usage',
      'Tailor answers to be authentic and practical for real interview scenarios',
      'Suggest behavioral questions using STAR method',
      'Help prepare communication and interpersonal responses',
      'Suggest leadership and teamwork examples',
      'Help prepare motivation and career goal responses',
      'Suggest cultural fit and values discussion points'
    ]
  },
  {
    id: 'system_design',
    name: 'System Design Interview Assistant',
    description: 'Suggestions for system design interview questions and responses',
    systemPrompt: 'You are helping prepare for system design interviews. Provide suggestions for system design questions, architecture discussions, and how to respond to scalability topics.',
    instructions: [
      'Suggest system design challenges and approaches',
      'Help prepare scalability concept explanations',
      'Suggest distributed systems discussion points',
      'Help prepare database design responses',
      'Suggest trade-offs and decision-making examples'
    ]
  },
  {
    id: 'leadership',
    name: 'Leadership Interview Assistant',
    description: 'Suggestions for leadership interview questions and responses',
    systemPrompt: 'You are helping prepare for leadership interviews. Provide suggestions for leadership questions, management scenarios, and how to respond to strategic thinking topics.',
    instructions: [
      'Suggest team management experience examples',
      'Help prepare conflict resolution responses',
      'Suggest strategic thinking and vision discussions',
      'Help prepare leadership philosophy responses',
      'Suggest change and innovation examples'
    ]
  },
  {
    id: 'general',
    name: 'Filipino-English Interview Assistant',
    description: 'Natural Filipino-English speaking style for client calls and interviews',
    systemPrompt: 'Write using simple, natural Filipino-English that sounds like how real Filipino professionals speak in client calls.\n\nKeep grammar slightly imperfect — that\'s okay and intentional.\nUse short, direct sentences that are easy to understand, never formal or academic.\nAvoid long explanations or heavy words; short and clear sentences show confidence.\nAlways sound polite, warm, and respectful, but also relaxed and human.\nSpeak with sincerity and natural rhythm — every syllable clear, no fake accent or exaggerated tone.\nFocus on the Filipino English flow: straight rhythm, gentle pauses, and honest energy.\n\nUse simple tense only (no need for complex grammar):\n✅ "I already finish that."\n✅ "We can start tomorrow."\n✅ "This one I can fix fast."\n\nPrefer natural, friendly expressions like:\n"It\'s okay."\n"No problem."\n"I can do that."\n"Already working."\n\nAvoid formal words like "however," "nevertheless," or "thus." Use "but," "so," or "because" instead.\nKeep responses short and conversational — imagine a real person speaking on a video call, not reading a script.\nSound sincere, quick to respond, and confident in what you say.',
    instructions: [
      'Provide natural Filipino-English interview suggestions',
      'Keep responses short and conversational',
      'Use simple, direct language',
      'Sound warm and professional but relaxed',
      'Give practical interview tips and responses'
    ]
  }
];

/**
 * Builds a comprehensive system prompt for interview scenarios
 * @param profileSummary - The candidate's profile summary (optional)
 * @param scenario - The selected interview scenario
 * @returns Formatted system prompt string
 */
export function buildInterviewPrompt(
  profileSummary: ProfileSummary | null,
  scenario: InterviewScenario,
  knowledgeBase?: Record<KnowledgeCategory, KnowledgeEntry[]>
): string {
  let prompt = `${scenario.systemPrompt}\n\n`;

  // Add profile-specific context if available
  if (profileSummary) {
    prompt += `## Candidate Profile\n\n`;
    
    if (profileSummary.skills.length > 0) {
      prompt += `**Technical Skills:**\n${profileSummary.skills.map(skill => `- ${skill}`).join('\n')}\n\n`;
    }
    
    if (profileSummary.experience.length > 0) {
      prompt += `**Work Experience:**\n${profileSummary.experience.map(exp => `- ${exp}`).join('\n')}\n\n`;
    }
    
    if (profileSummary.projects.length > 0) {
      prompt += `**Notable Projects:**\n${profileSummary.projects.map(project => `- ${project}`).join('\n')}\n\n`;
    }
    
    if (profileSummary.education.length > 0) {
      prompt += `**Education:**\n${profileSummary.education.map(edu => `- ${edu}`).join('\n')}\n\n`;
    }
  }

  // Add scenario-specific instructions
  prompt += `## Interview Guidelines\n\n`;
  prompt += `**Scenario:** ${scenario.name} - ${scenario.description}\n\n`;
  prompt += `**Key Focus Areas:**\n${scenario.instructions.map(instruction => `- ${instruction}`).join('\n')}\n\n`;

  // Add general interview guidelines
  prompt += `## General Guidelines\n\n`;
  prompt += `- Ask follow-up questions to clarify responses\n`;
  prompt += `- Provide constructive feedback when appropriate\n`;
  prompt += `- Keep questions relevant to the candidate's background\n`;
  prompt += `- Maintain a professional and encouraging tone\n`;
  prompt += `- Take notes on key points for evaluation\n\n`;

  // Add response format guidelines
  prompt += `## Response Format\n\n`;
  prompt += `- Provide clear, concise questions\n`;
  prompt += `- Include evaluation criteria when appropriate\n`;
  prompt += `- Suggest follow-up questions\n`;
  prompt += `- Offer insights on the candidate's responses\n`;
  prompt += `- Maintain consistency with the interview scenario focus\n`;

  if (knowledgeBase) {
    const appendSection = (title: string, entries?: KnowledgeEntry[], limit: number = 5) => {
      if (!entries || entries.length === 0) {
        return;
      }

      prompt += `\n## ${title}\n\n`;
      entries.slice(0, limit).forEach((entry, index) => {
        prompt += `${index + 1}. ${entry.content}\n`;
        if (entry.tags.length > 0) {
          prompt += `   - Tags: ${entry.tags.join(', ')}\n`;
        }
        prompt += `   - Confidence: ${(entry.confidence * 100).toFixed(0)}%\n`;
      });
    };

    appendSection('Candidate Profile Highlights', knowledgeBase[KnowledgeCategory.Profile]);
    appendSection('Supporting Documents', knowledgeBase[KnowledgeCategory.Document], 3);
    appendSection('Follow-up Action Items', knowledgeBase[KnowledgeCategory.ActionItem], 3);
    appendSection('Feedback Insights', knowledgeBase[KnowledgeCategory.Feedback], 3);
  }

  return prompt;
}

/**
 * Gets a scenario by ID
 * @param scenarioId - The scenario identifier
 * @returns The scenario object or default general scenario
 */
export function getScenarioById(scenarioId: string): InterviewScenario {
  return INTERVIEW_SCENARIOS.find(scenario => scenario.id === scenarioId) || INTERVIEW_SCENARIOS[4]; // Default to 'general'
}

/**
 * Gets all available scenarios
 * @returns Array of all interview scenarios
 */
export function getAllScenarios(): InterviewScenario[] {
  return INTERVIEW_SCENARIOS;
}
