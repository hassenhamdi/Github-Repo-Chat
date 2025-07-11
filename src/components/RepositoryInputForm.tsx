import React, { useState } from 'react';
import GithubIcon from '@/components/icons/GithubIcon';
import LoadingSpinner from '@/components/LoadingSpinner';
import { AppState } from '@/types';
import SettingsIcon from '@/components/icons/SettingsIcon';

interface RepositoryInputFormProps {
  onUrlSubmit: (repoUrl: string) => void;
  onDigestSubmit: (digestText: string, repoUrl?: string) => void;
  isLoading: boolean;
  errorMessage?: string;
  appState: AppState;
  onSettingsClick: () => void;
}

const RepositoryInputForm: React.FC<RepositoryInputFormProps> = ({
  onUrlSubmit,
  onDigestSubmit,
  isLoading,
  errorMessage,
  appState,
  onSettingsClick,
}) => {
  const [digestText, setDigestText] = useState<string>('');
  const [repoUrl, setRepoUrl] = useState<string>('');

  const isAnalyzingViaApi = appState === AppState.ANALYZING_REPO_VIA_API;
  const isProcessingDigest = appState === AppState.PROCESSING_DIGEST;
  const generalIsLoading = isLoading || isAnalyzingViaApi || isProcessingDigest;

  const handleUrlFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (repoUrl.trim() && !generalIsLoading) {
      onUrlSubmit(repoUrl.trim());
    }
  };
  
  const handleDigestFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (digestText.trim() && !generalIsLoading) {
      onDigestSubmit(digestText.trim(), repoUrl.trim() || undefined);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        const text = await file.text();
        setDigestText(text);
      } catch (err) {
        console.error("Failed to read file", err);
        setDigestText('');
      }
    }
  };
  
  const isValidUrl = (url: string): boolean => {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === "https:" && parsedUrl.hostname === 'github.com' && parsedUrl.pathname.split('/').filter(Boolean).length >= 2;
    } catch (_) {
      return false;
    }
  };

  return (
    <div className="relative w-full max-w-2xl p-6 md:p-8 glassmorphic-card">
      <div className="absolute top-4 right-4">
        <button
          onClick={onSettingsClick}
          className="p-2 rounded-full bg-slate-700/50 hover:bg-slate-600/70 text-gray-300 hover:text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800"
          aria-label="Open Settings"
        >
          <SettingsIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="flex justify-center mb-6">
        <GithubIcon className="w-24 h-24 text-gray-300" />
      </div>

      {errorMessage &&
        (appState === AppState.API_ANALYSIS_FAILED ||
         appState === AppState.DIGEST_PROCESSING_FAILED
        ) && (
        <p className="text-sm text-red-300 text-center mb-4 bg-red-500/20 p-3 rounded-lg border border-red-500/30">{errorMessage}</p>
      )}

      <form onSubmit={handleUrlFormSubmit} className="space-y-5 mb-8">
        <div>
          <label htmlFor="repoUrl" className="block text-sm font-medium text-gray-200 mb-1.5 flex items-center">
            <GithubIcon className="w-5 h-5 mr-2 text-gray-300" /> GitHub Repository URL
          </label>
          <div className="flex space-x-3">
            <input
              id="repoUrl"
              type="url"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="e.g., https://github.com/owner/repo-name"
              className="flex-grow px-4 py-3 bg-slate-700/80 border border-slate-600/70 rounded-lg text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm focus:shadow-md"
              disabled={generalIsLoading}
            />
            <button
              type="submit"
              disabled={generalIsLoading || !isValidUrl(repoUrl)}
              className="py-3 px-5 bg-green-500 hover:bg-green-600 disabled:bg-slate-600 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2 focus:ring-offset-slate-800 flex items-center justify-center min-w-[150px] shadow-md hover:shadow-lg disabled:shadow-none"
              aria-label="Fetch and Analyze Repository"
            >
              {isAnalyzingViaApi ? <LoadingSpinner size="sm" /> : 'Fetch & Analyze'}
            </button>
          </div>
           <p className="text-xs text-gray-400 mt-1.5">Direct fetching uses public GitHub API (rate limits apply).</p>
        </div>
      </form>
      
      <div className="text-center my-6 flex items-center">
        <hr className="flex-grow border-slate-600/50" />
        <span className="px-3 text-gray-400 text-sm">OR</span>
        <hr className="flex-grow border-slate-600/50" />
      </div>

      <form onSubmit={handleDigestFormSubmit} className="space-y-5">
         <div>
          <label htmlFor="digestFile" className="block text-sm font-medium text-gray-200 mb-1.5">
            Upload Digest File (.txt)
          </label>
          <input
            id="digestFile"
            type="file"
            accept=".txt"
            onChange={handleFileChange}
            className="w-full px-3 py-2.5 bg-slate-700/80 border border-slate-600/70 rounded-lg text-gray-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-500 file:text-white hover:file:bg-blue-600 cursor-pointer shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={generalIsLoading}
          />
        </div>
        <div>
          <label htmlFor="digestText" className="block text-sm font-medium text-gray-200 mb-1.5">
            Or Paste Digest Content
          </label>
          <textarea
            id="digestText"
            value={digestText}
            onChange={(e) => setDigestText(e.target.value)}
            placeholder="Paste the full text output from gitingest here..."
            className="w-full px-4 py-3 h-36 bg-slate-700/80 border border-slate-600/70 rounded-lg text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-y shadow-sm focus:shadow-md"
            disabled={generalIsLoading}
          />
        </div>
        
        <button
          type="submit"
          disabled={generalIsLoading || !digestText.trim()}
          className="w-full py-3.5 px-4 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-600 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-800 flex items-center justify-center shadow-md hover:shadow-lg disabled:shadow-none"
        >
          {isProcessingDigest ? <LoadingSpinner size="sm" /> : 'Process Digest'}
        </button>
      </form>
       <p className="text-xs text-gray-400 mt-8 text-center">
        Analyze GitHub repositories by URL or by pasting gitingest output.
      </p>
    </div>
  );
};

export default RepositoryInputForm;