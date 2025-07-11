
import React, { useEffect, useRef } from 'react';
import { ChatMessage } from '@/types';
import ChatMessageBubble from './ChatMessageBubble';
import type { TTSHook } from '@/hooks/useTTS';

interface ChatWindowProps {
  messages: ChatMessage[];
  repoName?: string;
  ttsHook: TTSHook; // Use the hook's interface for props
}

const ChatWindow: React.FC<ChatWindowProps> = ({ 
  messages, 
  repoName,
  ttsHook
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  return (
    <div className="flex-grow p-4 md:p-6 space-y-4 overflow-y-auto bg-slate-800/30"> 
      {messages.length === 0 && (
        <div className="text-center text-gray-400 pt-16 flex flex-col items-center justify-center h-full">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 text-blue-500 mb-4 opacity-70">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-3.86 8.25-8.625 8.25S3.75 16.556 3.75 12c0-4.556 3.86-8.25 8.625-8.25S21 7.444 21 12z" />
          </svg>
          <p className="text-xl text-gray-300">Ready to discuss <span className="font-semibold text-blue-400">{repoName || 'the repository'}</span></p>
          <p className="text-md text-gray-500 mt-1">Ask about its structure, code, or functionalities.</p>
        </div>
      )}
      {messages.map((msg) => (
        <ChatMessageBubble 
          key={msg.id} 
          message={msg} 
          ttsHook={ttsHook} // Pass the entire ttsHook object
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatWindow;
