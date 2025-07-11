import React, { useState, useEffect } from 'react';
import { settingsService, AppSettings } from '@/services/settingsService';
import { GeminiModel } from '@/types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: AppSettings) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave }) => {
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [githubAccessToken, setGithubAccessToken] = useState('');
  const [geminiModel, setGeminiModel] = useState<GeminiModel>('gemini-2.5-pro');

  useEffect(() => {
    if (isOpen) {
      const settings = settingsService.loadSettings();
      if (settings) {
        setGeminiApiKey(settings.geminiApiKey);
        setGithubAccessToken(settings.githubAccessToken);
        setGeminiModel(settings.geminiModel);
      }
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSave = () => {
    const newSettings: AppSettings = {
      geminiApiKey,
      githubAccessToken,
      geminiModel,
    };
    onSave(newSettings);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4 text-white">Settings</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="gemini-api-key" className="block text-sm font-medium text-gray-300">
              Gemini API Key
            </label>
            <input
              type="password"
              id="gemini-api-key"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="github-access-token" className="block text-sm font-medium text-gray-300">
              GitHub Access Token (Optional)
            </label>
            <input
              type="password"
              id="github-access-token"
              value={githubAccessToken}
              onChange={(e) => setGithubAccessToken(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="gemini-model" className="block text-sm font-medium text-gray-300">
              Gemini Model
            </label>
            <select
              id="gemini-model"
              value={geminiModel}
              onChange={(e) => setGeminiModel(e.target.value as GeminiModel)}
              className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="gemini-2.5-pro">gemini-2.5-pro</option>
              <option value="gemini-2.5-flash">gemini-2.5-flash</option>
              <option value="gemini-2.5-flash-lite-preview-06-17">gemini-2.5-flash-lite-preview-06-17</option>
            </select>
          </div>
        </div>
        <div className="mt-6 flex justify-end space-x-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;