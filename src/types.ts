
export enum MessageSender {
  USER = 'user',
  AI = 'ai',
  SYSTEM = 'system', // For status messages in chat
}

export interface ParsedFile {
  path: string;
  content: string;
  type?: 'file' | 'dir' | 'symlink'; // For tree construction
  size?: number; // For summary or API fetching
  sha?: string; // For API fetching
}

export interface ParsedDigestData {
  summaryText: string;
  directoryTreeText: string;
  files: ParsedFile[]; // Files with content
  repoNameFromSummary?: string; // From parsed digest
  title?: string; // Combined title from URL or digest
  totalFilesAnalyzed?: number;
  totalSizeAnalyzed?: number;
  keywords?: string[]; // Added for extracted AI summary keywords
}

export interface ChatMessage {
  id: string;
  sender: MessageSender;
  text: string;
  timestamp: Date;
  sources?: ParsedFile[]; // Files used as context for this AI message
  isLoading?: boolean;
}

export interface RepositoryInfo {
  url: string;
  owner: string;
  repo: string; // Renamed from 'name' to 'repo' for consistency with GitHub API terms
  branch?: string;
}

export enum AppState {
  INITIAL_LOAD = 'INITIAL_LOAD', // Initial state before auth check or digest input
  // Removed GitHub auth states
  AWAITING_DIGEST_INPUT = 'AWAITING_DIGEST_INPUT', // Default state

  PROCESSING_DIGEST = 'PROCESSING_DIGEST',
  DIGEST_PROCESSING_FAILED = 'DIGEST_PROCESSING_FAILED',
  
  ANALYZING_REPO_VIA_API = 'ANALYZING_REPO_VIA_API', // Fetching and processing from GitHub API
  API_ANALYSIS_FAILED = 'API_ANALYSIS_FAILED',       // GitHub API processing failed
  
  READY_TO_CHAT = 'READY_TO_CHAT',
  AI_THINKING = 'AI_THINKING',
  CRITICAL_ERROR = 'CRITICAL_ERROR', // For critical errors like missing API key
}

export type GeminiModel = 'gemini-2.5-pro' | 'gemini-2.5-flash' | 'gemini-2.5-flash-lite-preview-06-17';

export interface AppSettings {
  geminiApiKey: string;
  githubAccessToken: string;
  geminiModel: GeminiModel;
}