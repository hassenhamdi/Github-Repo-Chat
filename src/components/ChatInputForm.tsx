import React, { useState } from 'react';
import SendIcon from './icons/SendIcon';

interface ChatInputFormProps {
  onSendMessage: (messageText: string) => void;
  isSending: boolean;
  disabled?: boolean;
}

const ChatInputForm: React.FC<ChatInputFormProps> = ({ onSendMessage, isSending, disabled = false }) => {
  const [messageText, setMessageText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageText.trim() && !isSending && !disabled) {
      onSendMessage(messageText.trim());
      setMessageText('');
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-3 md:p-4 bg-slate-800/80 backdrop-blur-sm border-t border-slate-700/50 flex items-center space-x-3 lg:rounded-br-xl"
    >
      <input
        type="text"
        value={messageText}
        onChange={(e) => setMessageText(e.target.value)}
        placeholder={disabled ? "Waiting for repository analysis..." : "Ask anything about the repository..."}
        className="flex-grow px-4 py-3 bg-slate-700/70 border border-slate-600/80 rounded-lg text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm focus:shadow-md"
        disabled={isSending || disabled}
      />
      <button
        type="submit"
        disabled={isSending || disabled || !messageText.trim()}
        className="p-3 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-600 text-white rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-800 shadow-md hover:shadow-lg disabled:shadow-none flex items-center justify-center aspect-square"
      >
        <SendIcon className="w-5 h-5" />
      </button>
    </form>
  );
};

export default ChatInputForm;