
import React, { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { ChatMessage, MessageSender } from '@/types';
import BotIcon from './icons/BotIcon';
import UserIcon from './icons/UserIcon';
import SourcePill from './SourcePill';
import SpeakerIcon from './icons/SpeakerIcon';
import TypingIndicator from './TypingIndicator';
import type { TTSHook } from '@/hooks/useTTS';

interface ChatMessageBubbleProps {
  message: ChatMessage;
  ttsHook: TTSHook; 
}

const ChatMessageBubble: React.FC<ChatMessageBubbleProps> = ({ 
  message,
  ttsHook
}) => {
  const isUser = message.sender === MessageSender.USER;
  const isAI = message.sender === MessageSender.AI;
  const isSystem = message.sender === MessageSender.SYSTEM;

  const isCurrentSpeakerRef = useRef(false);

  useEffect(() => {
    // If TTS stops playing AND generating, and this bubble was the speaker, update its status
    if (isCurrentSpeakerRef.current && !ttsHook.isPlayingAudio && !ttsHook.isGeneratingSpeech) {
      isCurrentSpeakerRef.current = false;
    }
  }, [ttsHook.isPlayingAudio, ttsHook.isGeneratingSpeech]);
  
  const handleToggleSpeak = async () => {
    if (message.isLoading) return; // Don't speak loading messages

    if (!ttsHook.canSpeak) {
        if (ttsHook.isLoadingModel) alert("TTS Model is still loading. Please wait.");
        else if (ttsHook.modelError) alert(`TTS Model Error: ${ttsHook.modelError}. Cannot play speech.`);
        else alert("TTS not available or ready.");
        return;
    }

    // If TTS is active (either generating or playing)
    if (ttsHook.isGeneratingSpeech || ttsHook.isPlayingAudio) {
      // If it's this bubble speaking, or any bubble speaking, stop it.
      // The `stopPlayback` will affect any active TTS.
      ttsHook.stopPlayback();
      isCurrentSpeakerRef.current = false; // This bubble is no longer the speaker
    } else if (message.text && message.text.trim().length > 0) {
      // If no TTS is active, and there's text, start TTS for this bubble's message
      isCurrentSpeakerRef.current = true;
      try {
        await ttsHook.generateAndPlay(message.text); // Changed from generateAndPlayStream
      } catch (e: any) {
        console.error("Error from generateAndPlay in bubble:", e);
        alert(`TTS Error: ${e.message}`);
        isCurrentSpeakerRef.current = false; // Reset if error occurs during initiation
      }
    }
  };


  if (isSystem) {
    return (
      <div className="text-center my-2.5">
        <span className="text-xs text-gray-400 italic px-2.5 py-1.5 bg-slate-700/60 rounded-md shadow-sm">{message.text}</span>
      </div>
    );
  }
  
  const bubbleClasses = isUser
    ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white self-end rounded-xl rounded-br-sm shadow-lg'
    : 'bg-slate-600 text-gray-100 self-start rounded-xl rounded-bl-sm shadow-lg'; 
  
  const Icon = isUser ? UserIcon : BotIcon;

  const processedText = isAI && !message.isLoading && message.text 
    ? DOMPurify.sanitize(marked.parse(message.text, { async: false }) as string) 
    : message.text;

  const showSpeakerButton = isAI && !message.isLoading && message.text && message.text.trim().length > 0;
  
  // For non-streaming, isGeneratingSpeech means API call in progress, isPlayingAudio means playback
  const isThisBubbleGenerating = isCurrentSpeakerRef.current && ttsHook.isGeneratingSpeech;
  const isThisBubblePlaying = isCurrentSpeakerRef.current && ttsHook.isPlayingAudio;

  const speakButtonDisabled = 
    message.isLoading || 
    ttsHook.isLoadingModel || 
    !!ttsHook.modelError || 
    !ttsHook.canSpeak ||
    // Disable if another bubble is generating/playing (or this one is generating but not this one playing)
    ((ttsHook.isGeneratingSpeech || ttsHook.isPlayingAudio) && !isCurrentSpeakerRef.current);
  
  let speakButtonTitle = "Speak message";
  if (ttsHook.isLoadingModel) speakButtonTitle = "TTS Model loading...";
  else if (ttsHook.modelError) speakButtonTitle = `TTS Error: ${ttsHook.modelError}`;
  else if (!ttsHook.canSpeak) speakButtonTitle = "TTS not available";
  else if (isThisBubbleGenerating) speakButtonTitle = "Generating speech..."; // API call in progress
  else if (isThisBubblePlaying) speakButtonTitle = "Stop speaking"; // Actively playing
  else if ((ttsHook.isGeneratingSpeech || ttsHook.isPlayingAudio) && !isCurrentSpeakerRef.current) {
    speakButtonTitle = "Another message is speaking or generating";
  }


  return (
    <div className={`flex items-start mb-5 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="flex-shrink-0 mr-2.5 mt-0.5">
          <Icon className="w-9 h-9 p-2 bg-slate-700 rounded-full text-blue-300 shadow-md" />
        </div>
      )}
      <div className={`max-w-xl md:max-w-2xl lg:max-w-3xl px-4 py-3 ${bubbleClasses}`}>
        {message.isLoading ? (
            <TypingIndicator />
        ) : (
          isAI ? (
            <div
              className="chat-bubble-content prose prose-invert max-w-none break-words"
              dangerouslySetInnerHTML={{ __html: processedText }}
            />
          ) : (
            <p className="whitespace-pre-wrap break-words">{processedText}</p>
          )
        )}
        {showSpeakerButton && (
            <button
                onClick={handleToggleSpeak}
                title={speakButtonTitle}
                className={`mt-2.5 p-1 rounded-full ${
                  isThisBubblePlaying ? 'text-green-400 bg-slate-500/50 animate-pulse' 
                  : (isThisBubbleGenerating ? 'text-sky-400 bg-slate-500/50 animate-pulse' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-500/30')
                } transition-colors focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed`}
                aria-pressed={isThisBubblePlaying}
                disabled={speakButtonDisabled}
            >
                <SpeakerIcon className="w-4 h-4" />
            </button>
        )}
        {isAI && message.sources && message.sources.length > 0 && !message.isLoading && (
          <div className="mt-3.5 pt-3 border-t border-slate-500/50">
            <h4 className="text-xs font-semibold text-gray-300 mb-2">Sources:</h4>
            <div className="flex flex-wrap gap-1.5">
              {message.sources.map((source, index) => (
                <SourcePill key={index} source={source} />
              ))}
            </div>
          </div>
        )}
      </div>
      {isUser && (
         <div className="flex-shrink-0 ml-2.5 mt-0.5">
          <Icon className="w-9 h-9 p-2 bg-blue-700 rounded-full text-white shadow-md" />
        </div>
      )}
    </div>
  );
};

export default ChatMessageBubble;
