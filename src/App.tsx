





import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Chat } from "@google/genai";
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import {
  AppState,
  ChatMessage,
  MessageSender,
  RepositoryInfo,
  ParsedDigestData,
  ParsedFile,
  AppSettings,
} from '@/types';
import {
  MAX_CONTEXT_LENGTH_CHAR,
  MAX_FILE_CONTENT_LENGTH_CHAR,
  MAX_FILES_TO_FETCH_VIA_API,
} from '@/constants';
import RepositoryInputForm from '@/components/RepositoryInputForm';
import ChatWindow from '@/components/ChatWindow';
import ChatInputForm from '@/components/ChatInputForm';
import GlobalProgressIndicator from '@/components/GlobalProgressIndicator';
import UnifiedAILoadingAnimation from '@/components/AISummaryAnimation';
import { geminiService } from '@/services/geminiService';
import { githubService } from '@/services/githubService';
import { settingsService } from '@/services/settingsService';
import DocumentIcon from '@/components/icons/DocumentIcon';
import KeywordPill from '@/components/KeywordPill';
import TagIcon from '@/components/icons/TagIcon';
import { Buffer as ActualBufferPolyfill } from 'buffer';
import { useTTS } from '@/hooks/useTTS';
import ChatMessageBubble from '@/components/ChatMessageBubble';
import notificationSound from '@/assets/pyk-toon-n-n.mp3';
import SettingsModal from '@/components/SettingsModal';
import SettingsIcon from '@/components/icons/SettingsIcon';


const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.INITIAL_LOAD);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [parsedDigest, setParsedDigest] = useState<ParsedDigestData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentRepoInfo, setCurrentRepoInfo] = useState<RepositoryInfo | null>(null);
  const [progressInfo, setProgressInfo] = useState<{percent: number | undefined, text: string | undefined}>({percent: undefined, text: undefined});
  const [isGeneratingAISummaryInProgress, setIsGeneratingAISummaryInProgress] = useState<boolean>(false);
  const [showSummaryAnimationWithDelay, setShowSummaryAnimationWithDelay] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  
  const ttsHook = useTTS(); // Use the TTS hook

  const chatSessionRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const appAudioContextRef = useRef<AudioContext | null>(null);
  const notificationSoundBufferRef = useRef<AudioBuffer | null>(null); // For caching notification sound

  useEffect(() => {
    // Make Buffer globally available for libraries that might expect it
    globalThis.Buffer = ActualBufferPolyfill;

    // Initialize app-specific AudioContext (for notifications, etc.)
    if (typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined') {
      appAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    } else {
      console.warn("Web Audio API not supported for app sounds.");
    }
    
    // Critical error check for Gemini API Key
    const loadedSettings = settingsService.loadSettings();
    if (loadedSettings) {
      setSettings(loadedSettings);
      geminiService.initialize(loadedSettings.geminiApiKey, loadedSettings.geminiModel);
      githubService.initialize(loadedSettings.githubAccessToken);
    } else {
      setIsSettingsModalOpen(true);
    }
    // App state will transition from INITIAL_LOAD based on ttsHook.isLoadingModel in the next useEffect
  }, []);

  // Effect to manage transition from INITIAL_LOAD state based on TTS model loading
  useEffect(() => {
    // If the app is in its initial loading state and the TTS model has finished loading (or failed to load),
    // and no critical error (like missing API key from the first useEffect) has set the appState to CRITICAL_ERROR,
    // then transition to AWAITING_DIGEST_INPUT.
    // The check for CRITICAL_ERROR is implicitly handled because if appState were CRITICAL_ERROR,
    // the `appState === AppState.INITIAL_LOAD` condition below would be false.
    if (appState === AppState.INITIAL_LOAD && !ttsHook.isLoadingModel) {
      setAppState(AppState.AWAITING_DIGEST_INPUT);
    }
  }, [ttsHook.isLoadingModel, appState]);


  useEffect(() => {
    let timerId: number | undefined;
    if (showSummaryAnimationWithDelay) {
      timerId = window.setTimeout(() => {
        setShowSummaryAnimationWithDelay(false);
      }, 1800);
    }
    return () => {
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [showSummaryAnimationWithDelay]);

  const addMessage = (sender: MessageSender, text: string, sources?: ParsedFile[], isLoading?: boolean) => {
    setMessages(prev => [...prev, { id: Date.now().toString() + Math.random().toString(36).substring(7), sender, text, timestamp: new Date(), sources, isLoading }]);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };
  
  const updateLastMessage = (text: string, sources?: ParsedFile[], isLoading?: boolean) => {
    setMessages(prev => {
        const newMessages = [...prev];
        if (newMessages.length > 0) {
            const lastMsg = newMessages[newMessages.length - 1];
            newMessages[newMessages.length - 1] = { ...lastMsg, text, sources, isLoading: isLoading !== undefined ? isLoading : lastMsg.isLoading };
        }
        return newMessages;
    });
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const playNotificationSound = async () => {
    if (!appAudioContextRef.current) return;
    const audioCtx = appAudioContextRef.current;

    if (audioCtx.state === 'suspended') {
      try {
        await audioCtx.resume();
      } catch (e) {
        console.warn("Could not resume app audio context for notification:", e);
        return;
      }
    }
    if (audioCtx.state !== 'running') {
        console.warn("AudioContext not running, cannot play notification.");
        return;
    }

    const playBuffer = (buffer: AudioBuffer) => {
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.start();
    };

    if (notificationSoundBufferRef.current) {
      playBuffer(notificationSoundBufferRef.current);
    } else {
      try {
        // Assuming pyk-toon-n-n.mp3 is in a public /assets/ directory
        const response = await fetch(notificationSound);
        if (!response.ok) {
          throw new Error(`Failed to fetch notification sound: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        audioCtx.decodeAudioData(
          arrayBuffer,
          (decodedBuffer) => {
            notificationSoundBufferRef.current = decodedBuffer;
            playBuffer(decodedBuffer);
          },
          (error) => {
            console.error('Error decoding notification sound:', error);
          }
        );
      } catch (error) {
        console.error('Error fetching or playing notification sound:', error);
      }
    }
  };

  const parseGitingestDigest = (digestText: string): ParsedDigestData | null => {
    try {
        const lines = digestText.split(/\r?\n/);
        let summaryText = "";
        let directoryTreeText = "";
        const files: ParsedFile[] = [];
        let repoNameFromSummary: string | undefined;

        const separatorLine = "================================================";

        let directoryStructureSectionStartLine = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith("Directory structure (from fetched files):") || lines[i].startsWith("Directory structure:")) {
                directoryStructureSectionStartLine = i;
                break;
            }
        }

        let firstFileBlockSeparatorLine = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i] === separatorLine && lines[i + 1]?.startsWith("FILE: ")) {
                firstFileBlockSeparatorLine = i;
                break;
            }
        }
        
        let summaryEndLineExclusive = 0; 
        if (directoryStructureSectionStartLine !== -1) {
            summaryEndLineExclusive = directoryStructureSectionStartLine;
        } else if (firstFileBlockSeparatorLine !== -1) {
            summaryEndLineExclusive = firstFileBlockSeparatorLine;
        } else {
            summaryEndLineExclusive = lines.findIndex(line => line === separatorLine); 
            if (summaryEndLineExclusive === -1) summaryEndLineExclusive = lines.length; 
        }
        summaryText = lines.slice(0, summaryEndLineExclusive).join('\n');

        let fileParsingStartLine = 0;
        if (directoryStructureSectionStartLine !== -1) {
            let directoryTreeEndLineExclusive = (firstFileBlockSeparatorLine !== -1 && firstFileBlockSeparatorLine > directoryStructureSectionStartLine)
                ? firstFileBlockSeparatorLine
                : lines.length; 
            directoryTreeText = lines.slice(directoryStructureSectionStartLine, directoryTreeEndLineExclusive).join('\n');
            fileParsingStartLine = directoryTreeEndLineExclusive;
        } else if (firstFileBlockSeparatorLine !== -1) {
            directoryTreeText = ""; 
            fileParsingStartLine = firstFileBlockSeparatorLine;
        } else {
            const anySeparatorIndex = lines.findIndex(line => line === separatorLine);
            if (anySeparatorIndex !== -1) {
                fileParsingStartLine = anySeparatorIndex;
                if(summaryEndLineExclusive >= fileParsingStartLine) { 
                    summaryText = lines.slice(0, fileParsingStartLine).join('\n');
                }
            } else {
                 fileParsingStartLine = lines.length;
            }
            directoryTreeText = "";
        }

        let currentFilePath = "";
        let currentFileContent: string[] = [];
        let expectFileKeywordOrNextSeparator = false; 

        for (let i = fileParsingStartLine; i < lines.length; i++) {
            const line = lines[i];
            if (line === separatorLine) {
                if (currentFilePath) { 
                    files.push({ path: currentFilePath, content: currentFileContent.join('\n'), type: 'file' });
                    currentFileContent = [];
                }
                expectFileKeywordOrNextSeparator = true; 
            } else if (expectFileKeywordOrNextSeparator && line.startsWith("FILE: ")) {
                currentFilePath = line.substring("FILE: ".length).trim();
                expectFileKeywordOrNextSeparator = false; 
            } else if (currentFilePath && !expectFileKeywordOrNextSeparator) {
                currentFileContent.push(line);
            } else if (expectFileKeywordOrNextSeparator && !line.startsWith("FILE: ") && line.trim() !== "") {
                // This handles cases where content might appear after a separator without a "FILE: " line,
                // attaching it to the last known file. This might be too greedy depending on format variations.
                if (currentFilePath) { 
                    currentFileContent.push(line);
                }
            }
        }
        if (currentFilePath && (currentFileContent.length > 0 || !files.find(f => f.path === currentFilePath))) {
            files.push({ path: currentFilePath, content: currentFileContent.join('\n'), type: 'file' });
        }
        
        files.forEach(file => {
            file.content = file.content.trimEnd(); 
            file.size = file.content.length;
        });

        summaryText = summaryText.trim();
        const summaryLinesInitial = summaryText.split(/\r?\n/);
        let contentStartIndex = 0;
        if (summaryLinesInitial[contentStartIndex]?.toLowerCase().startsWith("repository:")) {
            repoNameFromSummary = summaryLinesInitial[contentStartIndex].substring(summaryLinesInitial[contentStartIndex].indexOf(":") + 1).trim();
            contentStartIndex++;
        }
        if (summaryLinesInitial[contentStartIndex]?.toLowerCase().startsWith("branch:")) {
            contentStartIndex++;
        }
        if (contentStartIndex > 0) {
            summaryText = summaryLinesInitial.slice(contentStartIndex).join('\n').trim();
        }


        if (directoryTreeText) {
            directoryTreeText = directoryTreeText.replace(/^Directory structure \(from fetched files\):\s*/i, "").trim();
            directoryTreeText = directoryTreeText.replace(/^Directory structure:\s*/i, "").trim();
        }
        
        const placeholderSummaryRegex = /^(Summary: An AI-generated overview is being prepared for this repository\.|Summary not provided|No summary found|To be generated|Summary not provided or detected in digest\.|AI-generated summary will be created|Placeholder: AI summary will be generated)/i;
        if (!summaryText || placeholderSummaryRegex.test(summaryText.trim())) { 
            summaryText = "Summary: An AI-generated overview is being prepared for this repository.";
        }
        if (!directoryTreeText) {
             directoryTreeText = "Directory tree not provided or detected in digest.";
        }
        
        const isSummaryEffectivelyAPlaceholder = placeholderSummaryRegex.test(summaryText.trim());
        const isTreeEffectivelyEmpty = directoryTreeText === "Directory tree not provided or detected in digest.";

        if (isSummaryEffectivelyAPlaceholder && isTreeEffectivelyEmpty && files.length === 0 && !repoNameFromSummary && !currentRepoInfo) {
            const eMsg = "Failed to parse digest: Content does not appear to be a valid gitingest format or is empty. Please ensure the digest includes a summary, directory structure, or file contents.";
            setError(eMsg); 
            console.error(eMsg, {rawDigestTextForDebug: digestText.substring(0, 500)});
            return null;
        }

        return { 
            summaryText, 
            directoryTreeText, 
            files, 
            repoNameFromSummary,
            totalFilesAnalyzed: files.length,
            totalSizeAnalyzed: files.reduce((acc, f) => acc + (f.size || 0), 0)
        };

    } catch (e: any) {
        console.error("Critical error during digest parsing:", e, {rawDigestTextForDebug: digestText.substring(0,500)});
        setError(`Failed to parse digest due to an unexpected error: ${e.message}. Please check the console for details.`);
        return null;
    }
  };

  const handleDigestSubmit = async (digestText: string, repoUrlInput?: string) => {
    setError(null); setMessages([]); setParsedDigest(null);
    setProgressInfo({percent: undefined, text: "Processing repository digest..."});
    
    let repoTitleForSummary = "Repository";

    if (repoUrlInput) {
        const parsedUrl = githubService.parseRepoUrl(repoUrlInput);
        if(parsedUrl) {
          setCurrentRepoInfo({url: repoUrlInput, ...parsedUrl});
          repoTitleForSummary = parsedUrl.repo;
        } else {
          setCurrentRepoInfo({url: repoUrlInput, owner: 'unknown', repo: 'repository'});
          try {
            const pathParts = new URL(repoUrlInput).pathname.split('/').filter(Boolean);
            if (pathParts.length > 0) repoTitleForSummary = pathParts[pathParts.length -1];
          } catch {}
        }
    } else {
        setCurrentRepoInfo(null);
    }

    setAppState(AppState.PROCESSING_DIGEST);
    addMessage(MessageSender.SYSTEM, `Processing repository digest...`);
    await new Promise(resolve => setTimeout(resolve, 0)); 
    
    let parsedData = parseGitingestDigest(digestText);

    if (parsedData) {
      const title = currentRepoInfo?.repo || parsedData.repoNameFromSummary || repoTitleForSummary;
      parsedData.title = title; 
      
      if (!currentRepoInfo && parsedData.repoNameFromSummary) {
          const ownerRepo = parsedData.repoNameFromSummary.split('/');
          setCurrentRepoInfo({
              url: `https://github.com/${parsedData.repoNameFromSummary}`,
              owner: ownerRepo.length > 1 ? ownerRepo[0] : 'unknown',
              repo: ownerRepo.length > 1 ? ownerRepo[1] : parsedData.repoNameFromSummary
          });
      }

      const placeholderSummaryRegex = /^(Summary: An AI-generated overview is being prepared for this repository\.|Summary not provided|No summary found|To be generated|Summary not provided or detected in digest\.|AI-generated summary will be created|Placeholder: AI summary will be generated)/i;
      const summaryIsPlaceholder = placeholderSummaryRegex.test(parsedData.summaryText.trim());
      
      const summaryIsVeryShort = !summaryIsPlaceholder && 
                                parsedData.summaryText.length < 200 && 
                                !parsedData.summaryText.toLowerCase().includes("error");

      let attemptAISummary = summaryIsPlaceholder || summaryIsVeryShort;

      if (attemptAISummary) {
        setIsGeneratingAISummaryInProgress(true);
        setProgressInfo({ percent: undefined, text: "Generating enhanced AI summary..." });
        addMessage(MessageSender.SYSTEM, "Attempting to generate an enhanced AI summary from full repository context...");
        try {
          let aiSummary = await geminiService.generateRepositorySummary(
            title, 
            parsedData.summaryText,
            parsedData.directoryTreeText, 
            parsedData.files 
          );

          if (aiSummary && !aiSummary.toLowerCase().startsWith("error generating summary") && aiSummary.length > 50) { 
            let extractedKeywords: string[] = [];
            const keywordsMarker = "\n\n**Keywords**: ";
            const keywordsStartIndex = aiSummary.indexOf(keywordsMarker);

            if (keywordsStartIndex !== -1) {
                const keywordsBlock = aiSummary.substring(keywordsStartIndex + keywordsMarker.length);
                aiSummary = aiSummary.substring(0, keywordsStartIndex).trim(); 

                extractedKeywords = keywordsBlock
                    .split(',') 
                    .map(kw => kw.replace(/^[*-]\s*/, "").trim()) 
                    .filter(kw => kw.length > 0 && kw.length < 50); 
            }
            parsedData.summaryText = aiSummary.trim();
            parsedData.keywords = extractedKeywords;
            addMessage(MessageSender.SYSTEM, "AI-powered summary generated.");
          } else {
            parsedData.summaryText = "AI-generated summary could not be created at this time."; // Keep placeholder or indicate failure
            parsedData.keywords = []; // No keywords if AI summary failed
            addMessage(MessageSender.SYSTEM, `AI summary generation did not produce a new substantial summary. (Response: ${aiSummary.substring(0,100)}...)`);
          }
        } catch (e: any) {
          parsedData.summaryText = "An error occurred during AI summary generation."; // Keep placeholder or indicate failure
          parsedData.keywords = [];
          addMessage(MessageSender.SYSTEM, `Error during AI summary generation: ${e.message}.`);
          console.error("AI Summary Generation Error:", e);
        } finally {
          setIsGeneratingAISummaryInProgress(false);
          setShowSummaryAnimationWithDelay(false); 
        }
      } else {
        setIsGeneratingAISummaryInProgress(false);
        setShowSummaryAnimationWithDelay(false);
      }

      setParsedDigest(parsedData); 
      setAppState(AppState.READY_TO_CHAT);
      addMessage(MessageSender.SYSTEM, `Digest for "${title}" processed. You can now ask questions.`);
      setProgressInfo({percent: undefined, text: undefined});
      
      if (chatSessionRef.current) {
        chatSessionRef.current = geminiService.createChatSession(
          `You are an expert AI assistant for the GitHub repository: ${title}. Use the provided context (summary, directory structure, and file contents) to answer questions about this specific repository. Be concise and accurate. When referring to specific files, mention their paths. Format your responses using Markdown, especially for code blocks (using triple backticks \`\`\` with language identifier if possible), lists, and text emphasis (bold, italic). Maintain focus on the repository's content, structure, and related technical aspects. Gently guide the conversation back if it strays too far from these topics.`
        );
      }
    } else {
      setAppState(AppState.DIGEST_PROCESSING_FAILED);
      addMessage(MessageSender.SYSTEM, `Error: Failed to process digest. ${error || "Check format and try again."}`);
      setProgressInfo({percent: undefined, text: undefined});
      setIsGeneratingAISummaryInProgress(false); 
      setShowSummaryAnimationWithDelay(false);
    }
  };
  
  const handleFetchAndAnalyzeRepo = async (repoUrl: string) => {
    setError(null); setMessages([]); setParsedDigest(null);
    setShowSummaryAnimationWithDelay(false);
    setIsGeneratingAISummaryInProgress(false);

    const repoDetails = githubService.parseRepoUrl(repoUrl);
    if (!repoDetails) {
      setError("Invalid GitHub URL. Please use the format https://github.com/owner/repo.");
      setAppState(AppState.AWAITING_DIGEST_INPUT); return;
    }
    setCurrentRepoInfo({url: repoUrl, ...repoDetails});
    setAppState(AppState.ANALYZING_REPO_VIA_API);
    setProgressInfo({percent: 0, text: `Fetching repository tree for ${repoDetails.owner}/${repoDetails.repo}...` });
    addMessage(MessageSender.SYSTEM, `Fetching repository tree for ${repoDetails.owner}/${repoDetails.repo}...`);
    
    try {
      const treeItems = await githubService.getRepoTree(repoDetails.owner, repoDetails.repo, repoDetails.branch);
      setProgressInfo({ percent: 0, text: `Found ${treeItems.length} files. Fetching content (up to ${MAX_FILES_TO_FETCH_VIA_API} relevant files)...` });
      
      const filesToProcess = treeItems.slice(0, MAX_FILES_TO_FETCH_VIA_API);
      const fetchedFiles: ParsedFile[] = [];
      let fetchedCount = 0; let totalCharsFetched = 0;

      for (const item of filesToProcess) {
        if (!item.sha) continue;
        const content = await githubService.getFileContent(repoDetails.owner, repoDetails.repo, item.sha);
        if (content !== null) {
          fetchedFiles.push({ path: item.path, content: content, type: 'file', size: content.length });
          totalCharsFetched += content.length;
        }
        fetchedCount++;
        const percent = Math.round((fetchedCount / filesToProcess.length) * 100);
        setProgressInfo({ percent, text: `Fetched ${fetchedCount}/${filesToProcess.length} files (${(totalCharsFetched / 1024).toFixed(1)} KB)...` });
        if (fetchedCount % 10 === 0 || fetchedCount === filesToProcess.length) {
          addMessage(MessageSender.SYSTEM, `Fetched ${fetchedCount}/${filesToProcess.length} files...`);
        }
      }
      setProgressInfo({ percent: 100, text: `All ${fetchedFiles.length} files fetched. Generating digest format...` });
      addMessage(MessageSender.SYSTEM, `All ${fetchedFiles.length} files fetched. Generating digest format...`);
      
      const initialSummaryTextForDigestCreation = `Summary: An AI-generated overview is being prepared for this repository.`;

      let digestString = `${initialSummaryTextForDigestCreation}\n\n`;
      
      digestString += "Directory structure (from fetched files):\n"; 
      const treePaths = fetchedFiles.map(f => f.path).sort();
      treePaths.forEach(p => digestString += `${p}\n`);
      digestString += "\n"; 

      fetchedFiles.forEach(file => {
        digestString += "================================================\n"; 
        digestString += `FILE: ${file.path}\n`;
        digestString += `${file.content}\n\n`;
      });
      setProgressInfo({ percent: undefined, text: "Processing fetched data and preparing for chat..." }); 
      
      await handleDigestSubmit(digestString, repoUrl);

    } catch (e: any) {
      console.error("API Analysis Error:", e);
      let apiErrorMessage = `Failed to analyze repository via API: ${e.message}. `;
      if (e.message && e.message.includes("Status: 403")) {
        apiErrorMessage += "A 403 Forbidden error often indicates GitHub API rate limits for unauthenticated requests. Try again later, or use a smaller repository. ";
      } else if (e.message && e.message.includes("Status: 404")) {
        apiErrorMessage += "The repository or branch could not be found. ";
      }
      apiErrorMessage += "Alternatively, you can paste a pre-generated digest.";
      setError(apiErrorMessage);
      addMessage(MessageSender.SYSTEM, `Error during API analysis: ${e.message.substring(0,150)}${e.message.length > 150 ? '...' : ''}`);
      setAppState(AppState.API_ANALYSIS_FAILED);
      setProgressInfo({percent: undefined, text: undefined});
      setIsGeneratingAISummaryInProgress(false);
      setShowSummaryAnimationWithDelay(false);
    }
  };

  const selectContextForGemini = (userQuery: string): { contextFiles: ParsedFile[], summary?: string, tree?: string } => {
    if (!parsedDigest) return { contextFiles: [] };
    const selectedFiles: ParsedFile[] = []; let currentLength = 0;
    
    const actualSummaryForContext = parsedDigest.summaryText;
    const summaryAndTreeLength = (actualSummaryForContext?.length || 0) + (parsedDigest.directoryTreeText?.length || 0);
    const queryLower = userQuery.toLowerCase();

    parsedDigest.files.forEach(file => {
      const filePathLower = file.path.toLowerCase();
      const fileNameLower = file.path.split('/').pop()?.toLowerCase() || '';
      if (queryLower.includes(filePathLower) || (fileNameLower && queryLower.includes(fileNameLower))) {
        if (!selectedFiles.some(sf => sf.path === file.path)) { 
            const contentLength = Math.min(file.content.length, MAX_FILE_CONTENT_LENGTH_CHAR);
            if (currentLength + contentLength + summaryAndTreeLength < MAX_CONTEXT_LENGTH_CHAR) {
            selectedFiles.push({ path: file.path, content: file.content.substring(0, contentLength) + (file.content.length > MAX_FILE_CONTENT_LENGTH_CHAR ? "\n... (content truncated)" : "") });
            currentLength += contentLength;
            }
        }
      }
    });

    const readmeFile = parsedDigest.files.find(f => f.path.toLowerCase().includes('readme.md'));
    if (readmeFile && !selectedFiles.some(sf => sf.path === readmeFile.path)) {
        const readmeContentLength = Math.min(readmeFile.content.length, MAX_FILE_CONTENT_LENGTH_CHAR);
        if (currentLength + readmeContentLength + summaryAndTreeLength < MAX_CONTEXT_LENGTH_CHAR) {
            selectedFiles.push({ path: readmeFile.path, content: readmeFile.content.substring(0, readmeContentLength) + (readmeFile.content.length > MAX_FILE_CONTENT_LENGTH_CHAR ? "\n... (content truncated)" : "") });
            currentLength += readmeContentLength;
        }
    }
    
    // Fill remaining context space with other files if query-matched and README aren't enough
    if (currentLength + summaryAndTreeLength < MAX_CONTEXT_LENGTH_CHAR * 0.9) { // Use 90% threshold to leave some buffer
        parsedDigest.files
            .filter(f => !selectedFiles.some(sf => sf.path === f.path)) // Exclude already selected
            .sort((a,b) => a.path.localeCompare(b.path)) // Consistent order
            .forEach(file => {
                const contentLength = Math.min(file.content.length, MAX_FILE_CONTENT_LENGTH_CHAR);
                 if (currentLength + contentLength + summaryAndTreeLength < MAX_CONTEXT_LENGTH_CHAR) {
                    selectedFiles.push({ path: file.path, content: file.content.substring(0, contentLength) + (file.content.length > MAX_FILE_CONTENT_LENGTH_CHAR ? "\n... (content truncated)" : "") });
                    currentLength += contentLength;
                 }
            });
    }

    // Truncate summary and tree if total context exceeds limit
    let includeSummary = actualSummaryForContext; 
    let includeTree = parsedDigest.directoryTreeText;

    if (currentLength + (includeSummary?.length || 0) + (includeTree?.length || 0) > MAX_CONTEXT_LENGTH_CHAR) {
        const remainingSpaceForSummaryTree = MAX_CONTEXT_LENGTH_CHAR - currentLength;
        if (remainingSpaceForSummaryTree <= 0) { 
            includeSummary = ""; includeTree = "";
        } else {
            const summaryLen = includeSummary?.length || 0; 
            const treeLen = includeTree?.length || 0;
            if (summaryLen + treeLen <= remainingSpaceForSummaryTree) {
                // Both fit
            } else if (summaryLen <= remainingSpaceForSummaryTree * 0.4 && treeLen > remainingSpaceForSummaryTree * 0.6) { 
                // Prioritize summary, truncate tree
                const treeSpace = remainingSpaceForSummaryTree - summaryLen;
                includeTree = treeLen > treeSpace ? (includeTree || "").substring(0, Math.max(0, treeSpace - 3)) + "..." : includeTree;
            } else if (treeLen <= remainingSpaceForSummaryTree * 0.6 && summaryLen > remainingSpaceForSummaryTree * 0.4) { 
                 // Prioritize tree, truncate summary
                const summarySpace = remainingSpaceForSummaryTree - treeLen;
                includeSummary = summaryLen > summarySpace ? (includeSummary || "").substring(0, Math.max(0, summarySpace - 3)) + "..." : includeSummary;
            } else { // Both need truncation
                 let summaryPartLength = Math.min(summaryLen, Math.floor(remainingSpaceForSummaryTree * 0.4));
                 includeSummary = summaryLen > summaryPartLength ? (includeSummary || "").substring(0, summaryPartLength - 3) + "..." : includeSummary;
                 const treeSpaceLeft = remainingSpaceForSummaryTree - (includeSummary?.length || 0);
                 includeTree = treeLen > treeSpaceLeft ? (includeTree || "").substring(0, Math.max(0, treeSpaceLeft - 3)) + "..." : includeTree;
            }
        }
    }
    return { contextFiles: selectedFiles, summary: includeSummary, tree: includeTree };
  };

  const handleSendMessage = async (messageText: string) => {
    if (!parsedDigest || !chatSessionRef.current) {
      setError('Cannot send message: digest not processed or chat session not ready.'); return;
    }
    addMessage(MessageSender.USER, messageText);
    setAppState(AppState.AI_THINKING); setError(null);
    const thinkingMsgId = Date.now().toString() + "-ai-thinking" + Math.random();
    setMessages(prev => [...prev, { id: thinkingMsgId, sender: MessageSender.AI, text: "Thinking...", timestamp: new Date(), isLoading: true }]);
    try {
      await new Promise(resolve => setTimeout(resolve, 50)); 
      const { contextFiles: selectedContextFiles, summary, tree } = selectContextForGemini(messageText);
      await new Promise(resolve => setTimeout(resolve, 50)); 

      const aiResponseText = await geminiService.sendMessage(
        chatSessionRef.current, messageText, parsedDigest.title || currentRepoInfo?.repo,
        selectedContextFiles, summary, tree
      );

      const actualSources: ParsedFile[] = [];
      if (aiResponseText && selectedContextFiles && selectedContextFiles.length > 0) {
        const aiResponseLower = aiResponseText.toLowerCase();
        selectedContextFiles.forEach(file => {
          const filePathLower = file.path.toLowerCase();
          const fileNameLower = file.path.split('/').pop()?.toLowerCase() || '';
          
          if (aiResponseLower.includes(filePathLower) || (fileNameLower && aiResponseLower.includes(fileNameLower))) {
            if (!actualSources.some(srcFile => srcFile.path === file.path)) {
                 actualSources.push(file); 
            }
          }
        });
      }

      setMessages(prev => prev.map(msg => msg.id === thinkingMsgId ? { ...msg, text: aiResponseText, sources: actualSources, isLoading: false } : msg ));
      playNotificationSound();
    } catch (e: any) {
      const errorMessage = `Error processing your message: ${e.message}`;
      setError(errorMessage);
      setMessages(prev => prev.map(msg => msg.id === thinkingMsgId ? { ...msg, text: `Sorry, I encountered an error: ${e.message}`, sources: [], isLoading: false, sender: MessageSender.AI } : msg ));
    } finally {
      setAppState(AppState.READY_TO_CHAT);
    }
  };
  
  const handleSaveSettings = (newSettings: AppSettings) => {
    settingsService.saveSettings(newSettings);
    setSettings(newSettings);
    geminiService.initialize(newSettings.geminiApiKey, newSettings.geminiModel);
    githubService.initialize(newSettings.githubAccessToken);
    // Attempt to create a chat session immediately to validate the new API key
    try {
      chatSessionRef.current = geminiService.createChatSession();
      setError(null);
      if (appState === AppState.CRITICAL_ERROR) {
        setAppState(AppState.AWAITING_DIGEST_INPUT);
      }
    } catch (e: any) {
      setError(`Failed to initialize AI with new settings: ${e.message}. Please check your API key.`);
      setAppState(AppState.CRITICAL_ERROR);
      console.error("Gemini initialization error after settings save:", e);
    }
  };

  const handleNewAnalysis = () => {
    setAppState(AppState.AWAITING_DIGEST_INPUT);
    setParsedDigest(null); setCurrentRepoInfo(null); setMessages([]); setError(null);
    setProgressInfo({percent: undefined, text: undefined});
    setIsGeneratingAISummaryInProgress(false);
    setShowSummaryAnimationWithDelay(false);
     ttsHook.stopPlayback(); // Stop any TTS from previous session

    try {
      chatSessionRef.current = geminiService.createChatSession(
        `You are an expert AI assistant. Use the provided context (summary, directory structure, and file contents) to answer questions about the upcoming repository. Be concise and accurate. When referring to specific files, mention their paths. Format your responses using Markdown, especially for code blocks (using triple backticks \`\`\` with language identifier if possible), lists, and text emphasis (bold, italic). Maintain focus on the repository's content, structure, and related technical aspects. Gently guide the conversation back if it strays too far from these topics.`
      );
    } catch (e: any) { setError(`Failed to re-initialize AI: ${e.message}.`); setAppState(AppState.CRITICAL_ERROR); }
  };

  const renderContent = () => {
    switch (appState) {
      case AppState.INITIAL_LOAD:
        return <div className="flex items-center justify-center min-h-screen"><UnifiedAILoadingAnimation currentPhaseText={ttsHook.isLoadingModel ? "Initializing TTS Model..." : "Initializing Application..."} detailText={ttsHook.isLoadingModel ? "This may take a moment on first load." : ttsHook.modelError || undefined} /></div>;
      case AppState.CRITICAL_ERROR:
        return (
          <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
            <h2 className="text-2xl font-semibold text-red-400 mb-4">Application Error</h2>
            <p className="text-gray-200">{error || "An critical error occurred."}</p>
            <p className="text-sm text-gray-400 mt-2">Please ensure the application is configured correctly (e.g., API_KEY) and refresh the page.</p>
          </div>
        );
      case AppState.AWAITING_DIGEST_INPUT:
      case AppState.DIGEST_PROCESSING_FAILED:
      case AppState.API_ANALYSIS_FAILED:
        return (
          <div className="flex flex-col items-center justify-center min-h-screen p-4 w-full">
            <RepositoryInputForm
              onUrlSubmit={handleFetchAndAnalyzeRepo}
              onDigestSubmit={handleDigestSubmit}
              isLoading={ttsHook.isLoadingModel && appState === AppState.AWAITING_DIGEST_INPUT}
              errorMessage={error && (appState === AppState.DIGEST_PROCESSING_FAILED || appState === AppState.API_ANALYSIS_FAILED) ? error : (ttsHook.isLoadingModel && appState === AppState.AWAITING_DIGEST_INPUT ? "Initializing local TTS model..." : ttsHook.modelError || undefined)}
              appState={appState}
              onSettingsClick={() => setIsSettingsModalOpen(true)}
            />
          </div>
        );
      case AppState.PROCESSING_DIGEST:
      case AppState.ANALYZING_REPO_VIA_API:
        let currentPhaseText = "Processing...";
        const progressTextLower = progressInfo?.text?.toLowerCase() || "";

        if (appState === AppState.ANALYZING_REPO_VIA_API) {
            if (progressTextLower.includes("fetching repository tree") || progressTextLower.includes("found") && progressTextLower.includes("files")) {
                currentPhaseText = `Accessing ${currentRepoInfo?.owner || ''}/${currentRepoInfo?.repo || 'Repository'}...`;
            } else if (progressTextLower.includes("fetching content") || progressTextLower.includes("fetched")) {
                currentPhaseText = "Retrieving File Contents...";
            } else if (progressTextLower.includes("generating digest") || progressTextLower.includes("processing fetched data")) {
                 currentPhaseText = "Analyzing Repository Structure...";
            }
        } else { // PROCESSING_DIGEST
             currentPhaseText = "Analyzing Digest Content...";
        }
        if (progressTextLower.includes("generating enhanced ai summary") || progressTextLower.includes("ai summary generation")) {
            currentPhaseText = "Crafting AI-Powered Overview...";
        }
        
        return (
          <div className="flex flex-col items-center justify-center min-h-screen p-4 w-full">
            <div className="glassmorphic-card p-6 md:p-8 text-center w-full max-w-xl">
              <UnifiedAILoadingAnimation 
                currentPhaseText={currentPhaseText}
                detailText={progressInfo?.text}
              />
              {(progressInfo?.percent !== undefined || (progressInfo?.text && !progressInfo?.percent)) && (
                <GlobalProgressIndicator
                  progressPercent={progressInfo?.percent}
                  isPulsing={progressInfo?.percent === undefined}
                />
              )}
              
              {error && <p className="mt-4 text-sm text-red-300 bg-red-900/30 p-2 rounded-md">{error}</p>}
              
              {messages.length > 0 && ( // Display system messages during processing
                 <div className="mt-6 h-48 w-full bg-slate-700/50 rounded-lg p-3 overflow-y-auto shadow-inner text-left text-xs">
                    {messages.map(msg => <ChatMessageBubble key={msg.id} message={msg} ttsHook={ttsHook} />)}
                    <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </div>
        );
      case AppState.READY_TO_CHAT:
      case AppState.AI_THINKING:
        const repoDisplayName = parsedDigest?.title || currentRepoInfo?.repo || "Loaded Repository";
        const displaySummaryContent = () => {
          if (isGeneratingAISummaryInProgress || showSummaryAnimationWithDelay) {
            return <UnifiedAILoadingAnimation currentPhaseText="Crafting AI Overview..." isCompact={true} />;
          }
          return (
            <div 
              className="text-gray-200 markdown-content prose prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(parsedDigest?.summaryText || "Summary not available.", { async: false })) }}
            />
          );
        };

        return (
          <div className="flex flex-col lg:flex-row h-screen max-h-screen bg-transparent w-full max-w-7xl mx-auto shadow-2xl lg:rounded-xl overflow-hidden border border-slate-700/50">
            {parsedDigest && (
              <aside className="w-full lg:w-2/5 xl:w-1/3 bg-slate-800/70 backdrop-blur-md p-4 md:p-6 border-b lg:border-b-0 lg:border-r border-slate-700/50 overflow-y-auto flex flex-col space-y-6">
                <div> 
                  <div className="flex justify-between items-center mb-3">
                    <h2 className="text-xl font-semibold text-blue-300 flex items-center">
                      <DocumentIcon className="w-5 h-5 mr-2.5 flex-shrink-0 text-blue-400" /> Repository Overview
                    </h2>
                  </div>
                  <div className="bg-slate-700/50 p-3.5 rounded-lg max-h-[30rem] overflow-y-auto shadow-inner border border-slate-600/50 min-h-[150px]">
                    {displaySummaryContent()}
                  </div>
                  {parsedDigest.keywords && parsedDigest.keywords.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-600/30">
                      <h3 className="text-sm font-semibold text-blue-300 mb-2.5 flex items-center">
                        <TagIcon className="w-4 h-4 mr-2 text-blue-400" />
                        Keywords
                      </h3>
                      <div className="flex flex-wrap gap-2.5"> 
                        {parsedDigest.keywords.map((keyword, index) => (
                          <KeywordPill key={`${keyword}-${index}`} keyword={keyword} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0">
                  <h2 className="text-xl font-semibold text-blue-300 mb-3 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-2.5 text-blue-400"> <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 9.75A.75.75 0 012.75 9h9.5a.75.75 0 010 1.5h-9.5A.75.75 0 012 9.75zM2 14.75a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5h-4.5a.75.75 0 01-.75-.75z" clipRule="evenodd" /> </svg>
                    Directory Structure
                  </h2>
                  <div className="text-xs text-gray-300 bg-slate-700/50 p-3.5 rounded-lg overflow-y-auto max-h-[calc(100vh-500px)] min-h-[200px] sidebar-directory-tree shadow-inner border border-slate-600/50"> 
                    <pre className="whitespace-pre-wrap break-all">{parsedDigest.directoryTreeText || "Directory tree not available."}</pre>
                  </div>
                </div>
              </aside>
            )}
            <main className="flex flex-col flex-grow h-full max-h-screen bg-slate-800">
              <header className="p-4 bg-slate-800/80 backdrop-blur-sm border-b border-slate-700/50 flex justify-between items-center lg:rounded-tr-xl flex-shrink-0 shadow-sm">
                  <h1 className="text-xl font-semibold text-gray-100 truncate">
                    Repository : <span className="text-blue-400 font-bold">{repoDisplayName}</span>
                  </h1>
                  <div className="flex items-center space-x-4">
                    <button
                        onClick={handleNewAnalysis}
                        className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800"
                    >
                        New Analysis
                    </button>
                  </div>
              </header>
              <ChatWindow 
                messages={messages.filter(msg => msg.sender !== MessageSender.SYSTEM)} 
                repoName={repoDisplayName}
                ttsHook={ttsHook}
              />
              {error && appState !== AppState.AI_THINKING && <p className="p-2 text-sm text-center text-red-300 bg-red-900/40 flex-shrink-0 border-t border-red-700/50">{error}</p>}
              <ChatInputForm
                onSendMessage={handleSendMessage}
                isSending={appState === AppState.AI_THINKING}
                disabled={(appState !== AppState.READY_TO_CHAT && appState !== AppState.AI_THINKING) || ttsHook.isLoadingModel}
              />
            </main>
          </div>
        );
      default:
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 w-full">
                <p className="text-red-400">An unexpected application state has occurred: {appState}. Please refresh.</p>
                <p className="text-xs text-gray-500 mt-2">If the problem persists, check console for errors.</p>
            </div>
        );
    }
  };

  return (
    <div className="h-screen bg-gradient-to-br from-gray-900 to-slate-900 text-gray-100">
      {renderContent()}
      <button
        onClick={() => setIsSettingsModalOpen(true)}
        className="fixed bottom-4 right-4 p-3 rounded-full bg-slate-700/50 hover:bg-slate-600/70 text-gray-300 hover:text-white transition-colors duration-200 shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800 z-50"
        aria-label="Open Settings"
      >
        <SettingsIcon className="w-6 h-6" />
      </button>
      <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} onSave={handleSaveSettings} />
    </div>
  );
};

export default App;