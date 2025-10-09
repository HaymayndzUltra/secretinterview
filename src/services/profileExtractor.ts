import { ProfileSummary } from '../contexts/KnowledgeBaseContext';
import { LlmMessage } from '../types/llm';

export interface ProfileExtractionResult {
  success: boolean;
  profileSummary?: ProfileSummary;
  error?: string;
}

/**
 * Extracts structured profile information from parsed file text using the local LLM engine
 * @param fileText - The parsed text content from uploaded files
 * @returns Promise<ProfileExtractionResult> - Structured profile data or error
 */
export async function extractProfileFromText(fileText: string): Promise<ProfileExtractionResult> {
  try {
    // Create the prompt for profile extraction
    const systemPrompt = `You are an expert at extracting structured information from resumes and CVs.
    Analyze the provided text and extract relevant information into the following categories:
    - Skills: Technical skills, programming languages, tools, frameworks, methodologies
    - Experience: Work history, job titles, companies, key responsibilities and achievements
    - Projects: Notable projects, personal or professional, with descriptions and technologies
    - Education: Degrees, institutions, certifications, relevant coursework
    
    Please respond with a JSON object containing the following structure:
    {
      "skills": ["skill1", "skill2", ...],
      "experience": ["experience1", "experience2", ...],
      "projects": ["project1", "project2", ...],
      "education": ["education1", "education2", ...]
    }
    
    Be thorough but concise. Extract the most relevant and important information. 
    If a category has no relevant information, return an empty array for that category.`;

    const userPrompt = `Please extract profile information from the following text:\n\n${fileText}`;

    // Prepare messages for local LLM invocation
    const messages: LlmMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];

    const response = await window.electronAPI.invokeLocalLlm({
      messages
    });

    if ('error' in response) {
      return {
        success: false,
        error: `Local LLM error: ${response.error}`
      };
    }

    // Parse the JSON response from the local LLM
    try {
      const extractedData = JSON.parse(response.content);
      
      // Validate the extracted data structure
      const profileSummary: ProfileSummary = {
        skills: Array.isArray(extractedData.skills) ? extractedData.skills : [],
        experience: Array.isArray(extractedData.experience) ? extractedData.experience : [],
        projects: Array.isArray(extractedData.projects) ? extractedData.projects : [],
        education: Array.isArray(extractedData.education) ? extractedData.education : []
      };

      return {
        success: true,
        profileSummary
      };
    } catch (parseError) {
      return {
        success: false,
        error: `Failed to parse extracted profile data: ${parseError}`
      };
    }

  } catch (error) {
    return {
      success: false,
      error: `Profile extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}
