
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { GEMINI_MODEL_NAME, MAX_FILE_CONTENT_LENGTH_CHAR } from '@/constants'; // Added MAX_FILE_CONTENT_LENGTH_CHAR
import { ParsedFile, GeminiModel } from "@/types";

let ai: GoogleGenAI | null = null;
let geminiModel: GeminiModel = GEMINI_MODEL_NAME;

const getAiClient = (): GoogleGenAI => {
  if (!ai) {
    throw new Error("Gemini AI client not initialized. Please set API key in settings.");
  }
  return ai;
};

export const geminiService = {
  initialize: (apiKey: string, model: GeminiModel) => {
    ai = new GoogleGenAI({ apiKey });
    geminiModel = model;
  },

  createChatSession: (systemInstruction?: string): Chat => {
    const client = getAiClient();
    return client.chats.create({
      model: geminiModel,
      config: {
        systemInstruction: systemInstruction || "You are a helpful AI assistant specialized in analyzing and answering questions about code repositories. Use the provided context from the repository digest (summary, directory structure, and file contents) to answer user queries. If the context is insufficient, clearly state that. Be concise and accurate. When referring to specific files, mention their paths. Format your responses using Markdown, especially for code blocks (using triple backticks ``` with language identifier if possible), lists, and text emphasis (bold, italic). Maintain focus on the repository's content, structure, and related technical aspects. Gently guide the conversation back if it strays too far from these topics.",
      },
    });
  },

  sendMessage: async (
    chat: Chat,
    userMessage: string,
    repositoryName?: string, 
    contextFiles?: ParsedFile[], 
    summaryText?: string,
    directoryTreeText?: string
  ): Promise<string> => {
    let contextPrompt = "USER QUESTION: " + userMessage;

    let fullContext = "";
    if (repositoryName) {
        fullContext += `The user is asking about the '${repositoryName}' repository.\n\n`;
    }
    if (summaryText) {
      fullContext += "REPOSITORY SUMMARY:\n" + summaryText + "\n\n";
    }
    if (directoryTreeText) {
      fullContext += "DIRECTORY STRUCTURE:\n" + directoryTreeText + "\n\n";
    }

    if (contextFiles && contextFiles.length > 0) {
      fullContext += "RELEVANT FILE CONTENTS:\n";
      contextFiles.forEach(file => {
        fullContext += `--- File: ${file.path} ---\n${file.content}\n\n`;
      });
    }
    
    if (fullContext) {
        contextPrompt = `Here is some context from the repository digest:\n\n${fullContext}\nBased on this context, please answer the following question. Format your response using Markdown, especially for code blocks (using triple backticks \`\`\` with language identifier if possible), lists, and text emphasis (bold, italic).\n\nUSER QUESTION: ${userMessage}`;
    }
    
    try {
      const response: GenerateContentResponse = await chat.sendMessage({ message: contextPrompt });
      return response.text ?? "";
    } catch (error) {
      console.error('Gemini API error during sendMessage:', error);
      if (error instanceof Error) {
        if ('message' in error && typeof error.message === 'string' && error.message.includes('API key not valid')) {
          return "Error: The Gemini API key is not valid. Please check your configuration.";
        }
        return `Error communicating with Gemini: ${error.message}`;
      }
      return 'An unknown error occurred while communicating with Gemini.';
    }
  },

  generateRepositorySummary: async (
    repositoryName: string | undefined,
    initialSummary: string, // This might be a placeholder or README excerpt
    directoryTree: string,
    allFiles: ParsedFile[]
  ): Promise<string> => {
    if (!initialSummary && !directoryTree && allFiles.length === 0) {
      return "No content provided for summary generation.";
    }
    const client = getAiClient();
    
    let promptContext = `Repository Name: ${repositoryName || 'N/A'}\n\n`;
    promptContext += `Initial Information (this could be a basic placeholder, a README.md excerpt, or a user-provided digest summary):\n${initialSummary}\n\n`;
    promptContext += `Directory Structure:\n${directoryTree}\n\n`;

    let filesDetails = "Key File Contents (code snippets, configurations, documentation excerpts):\n";
    const MAX_FILES_DETAIL_LENGTH_FOR_SUMMARY = 20000; 
    let currentFilesDetailLength = 0;

    const readmeFile = allFiles.find(f => f.path.toLowerCase().includes('readme.md'));
    if (readmeFile && readmeFile.content) {
        const readmeExcerpt = readmeFile.content.substring(0, MAX_FILE_CONTENT_LENGTH_CHAR);
        const entry = `--- File: ${readmeFile.path} ---\n${readmeExcerpt}\n${readmeFile.content.length > MAX_FILE_CONTENT_LENGTH_CHAR ? "... (content truncated for brevity in summary prompt)\n" : ""}\n`;
        if (currentFilesDetailLength + entry.length <= MAX_FILES_DETAIL_LENGTH_FOR_SUMMARY) {
            filesDetails += entry;
            currentFilesDetailLength += entry.length;
        }
    }

    for (const file of allFiles) {
        if (file.path === readmeFile?.path) continue; 
        if (!file.content) continue;
        const fileExcerptLength = Math.min(file.content.length, 1500); 
        const fileExcerpt = file.content.substring(0, fileExcerptLength);
        const entry = `--- File: ${file.path} ---\n${fileExcerpt}\n${file.content.length > fileExcerptLength ? "... (content truncated for brevity in summary prompt)\n" : ""}\n`;
        
        if (currentFilesDetailLength + entry.length <= MAX_FILES_DETAIL_LENGTH_FOR_SUMMARY) {
            filesDetails += entry;
            currentFilesDetailLength += entry.length;
        } else {
            const pathEntry = `--- File: ${file.path} (content omitted due to length constraints for summary prompt) ---\n`;
            if (currentFilesDetailLength + pathEntry.length <= MAX_FILES_DETAIL_LENGTH_FOR_SUMMARY) {
                filesDetails += pathEntry;
                currentFilesDetailLength += pathEntry.length;
            } else {
                filesDetails += "--- (Reached content limit for including more file details in summary prompt) ---\n";
                break; 
            }
        }
    }
    promptContext += filesDetails;

    const fullPrompt = `You are an AI assistant tasked with creating a **high-level executive summary** or **informative abstract** of a software repository.
Your goal is to provide an **extremely concise and brief** overview about the repository project.**
Distill the core essence into a brief but impactful overview. Minimize length while retaining critical information.
Extract these insights by intelligently synthesizing information from the entire provided context below (which includes initial information that might be a placeholder or README excerpt, the directory structure, and content from key files like code, configurations, and documentation).

Based on this comprehensive information, generate a new, insightful summary.

Your summary **MUST**:
1.  **Be a High-Level Abstract:** Structure it as a cohesive narrative. Focus on the *what and why* of the project.
2.  **Emphasize Purpose & Problem Solving:** Clearly articulate the main purpose of the repository. What problem does it solve? Who is it for?
3.  **Describe Key Capabilities:** What are its most important functionalities or features, described conceptually?
4.  **Avoid Deep Implementation Details:** Do **NOT** delve into specific function names, granular code logic, class structures, or minor configuration settings unless they are absolutely essential to understanding the project's core concept or a major capability. The summary should be understandable without needing to see the code.
5.  **Mention Key Technologies (Briefly):** If significant, briefly state the primary programming language(s) or key frameworks/technologies used (e.g., "a Python library for data analysis," "a React-based web application").
6.  **Synthesize, Don't Just Rehash:** Do NOT simply repeat or reformat the 'Initial Information' section, especially if it's a generic placeholder or a direct README copy. Create a *fresh, descriptive overview* based on all available context.
7.  **Avoid README Style:** Do **NOT** structure your summary with common README sections like 'Installation', 'Setup', 'Usage Guide', 'API Reference', 'Contributing', 'License'. Your output is an abstract, not a user manual.
8.  **Be Human-Readable and Professional:** The summary should flow naturally and be easy for both technical and semi-technical audiences to understand. The tone should be professional and informative.
9.  **Balanced Detail:** Aim for a balance: not too detailed (avoiding minute implementation specifics) and not too shallow (providing concrete insights about its purpose and capabilities).
10. **Use Markdown:** Present this summary using Markdown for clear formatting. Paragraphs are preferred. Use bold (**text**) for emphasis on key terms or features. Headings (#, ##) should be used very sparingly, if at all, to maintain the abstract style.
11. **Include Keywords:** Conclude the summary with a short list of 3-5 highly relevant keywords or tags (not exceeding 7 keywords). These keywords should be comma-separated. Prefix this list with '\n\n**Keywords**: '. Example: "\n\n**Keywords**: Python, Data Analysis, Machine Learning, API".

Context:
${promptContext}

New Generated High-Level Summary (as a well-structured, informative abstract in Markdown format, ending with comma-separated keywords):`;

    try {
      const response = await client.models.generateContent({
        model: GEMINI_MODEL_NAME, 
        contents: fullPrompt,
        // config: { temperature: 0.4 } // Slightly higher temperature might allow for more nuanced summarization
      });
      return response.text ?? "";
    } catch (error) {
      console.error('Gemini API error during generateRepositorySummary:', error);
      if (error instanceof Error) {
         return `Error generating summary via Gemini: ${error.message}`;
      }
      return 'An unknown error occurred while generating the repository summary.';
    }
  }
};