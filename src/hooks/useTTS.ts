



import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";
import { Buffer } from 'buffer';

const TTS_MODEL_NAME = "gemini-2.5-flash-preview-tts";
const TTS_VOICE_NAME = 'iapetus'; // User preferred voice

export interface TTSHook {
  isLoadingModel: boolean;
  modelError: string | null;
  isGeneratingSpeech: boolean;
  isPlayingAudio: boolean;
  canSpeak: boolean;
  generateAndPlay: (text: string) => Promise<void>;
  stopPlayback: () => void;
}

interface AudioMimeInfo {
  sampleRate: number;
  bitsPerSample: number;
  channels: number;
}

// Simple MIME type parser for common audio formats like audio/L16;rate=24000;channels=1
const parseAudioMimeType = (mimeType: string): AudioMimeInfo | null => {
  if (!mimeType) return null;
  const parts = mimeType.toLowerCase().split(';');
  const typePart = parts[0].trim();
  
  let sampleRate = 24000; // Default if not specified
  let bitsPerSample = 16;  // Default for L16
  let channels = 1;      // Default for TTS

  if (!typePart.startsWith('audio/l')) { // Primarily expecting audio/L16, audio/L8 etc.
    console.warn(`Unsupported base MIME type for TTS: ${typePart}. Assuming PCM L16.`);
  } else {
    const formatSuffix = typePart.substring('audio/l'.length);
    const parsedBits = parseInt(formatSuffix, 10);
    if (!isNaN(parsedBits)) {
      bitsPerSample = parsedBits;
    }
  }

  parts.slice(1).forEach(param => {
    const [key, value] = param.split('=').map(s => s.trim());
    if (key === 'rate' && value) {
      const rate = parseInt(value, 10);
      if (!isNaN(rate)) sampleRate = rate;
    } else if (key === 'channels' && value) {
      const ch = parseInt(value, 10);
      if (!isNaN(ch)) channels = ch;
    }
  });
  
  return { sampleRate, bitsPerSample, channels };
};


let ai: GoogleGenAI | null = null;
const getAiClient = (): GoogleGenAI => {
  if (!ai) {
    if (!process.env.API_KEY) {
      throw new Error("API_KEY environment variable not set for Gemini API.");
    }
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return ai;
};

export const useTTS = (): TTSHook => {
  const [geminiClient, setGeminiClient] = useState<GoogleGenAI | null>(null);
  const [isLoadingModel, setIsLoadingModel] = useState<boolean>(true);
  const [modelError, setModelError] = useState<string | null>(null);

  const [isGeneratingSpeech, setIsGeneratingSpeech] = useState<boolean>(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  // To track if a playback loop is active, preventing multiple loops
  const isPlaybackLoopActiveRef = useRef<boolean>(false); 

  useEffect(() => {
    if (typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined') {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    } else {
      console.warn("Web Audio API not supported. Gemini TTS playback will not work.");
      setModelError("Web Audio API not supported. TTS disabled.");
      setIsLoadingModel(false);
      return;
    }

    try {
      const client = getAiClient();
      setGeminiClient(client);
      setIsLoadingModel(false);
    } catch (e: any) {
      console.error("Failed to initialize Gemini AI client for TTS:", e);
      setModelError(`Failed to initialize Gemini client: ${e.message}`);
      setIsLoadingModel(false);
    }

    return () => {
      if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
        abortControllerRef.current.abort();
      }
      stopPlaybackInternal(); // Call the internal stop function
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(e => console.warn("Error closing AudioContext on cleanup:", e));
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // stopPlaybackInternal is stable

  const stopPlaybackInternal = () => {
    if (currentSourceNodeRef.current) {
      try {
        currentSourceNodeRef.current.onended = null;
        currentSourceNodeRef.current.stop();
      } catch(e) { /* Already stopped or invalid state */ }
      currentSourceNodeRef.current = null;
    }
    audioQueueRef.current = [];
    isPlaybackLoopActiveRef.current = false;
    setIsPlayingAudio(false);
    // Note: isGeneratingSpeech is controlled by the generateAndPlay function's lifecycle
  };
  
  const stopPlayback = useCallback(() => {
    if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
      abortControllerRef.current.abort("User requested stop during generation.");
    }
    stopPlaybackInternal();
    setIsGeneratingSpeech(false); // Explicitly set generating to false on user stop
  }, []);


  const playNextChunkFromQueue = useCallback(async () => {
    if (isPlaybackLoopActiveRef.current || audioQueueRef.current.length === 0 || !audioContextRef.current || isPlayingAudio) {
      // If a loop is active, queue is empty, context not ready, or already playing something else, wait.
      if (audioQueueRef.current.length === 0 && !isGeneratingSpeech) {
          // If queue is empty AND no more speech is being generated, then truly stop.
          isPlaybackLoopActiveRef.current = false;
          setIsPlayingAudio(false);
      }
      return;
    }
    
    isPlaybackLoopActiveRef.current = true;
    setIsPlayingAudio(true);

    const audioBuffer = audioQueueRef.current.shift();
    if (!audioBuffer) {
        isPlaybackLoopActiveRef.current = false;
        setIsPlayingAudio(false); // Should have been caught above, but defensive
        return;
    }

    if (audioContextRef.current.state === 'suspended') {
      try {
        await audioContextRef.current.resume();
      } catch (e) {
        console.error("Could not resume audio context:", e);
        setModelError("AudioContext suspended. User interaction may be needed.");
        isPlaybackLoopActiveRef.current = false;
        setIsPlayingAudio(false);
        return;
      }
    }
    
    const sourceNode = audioContextRef.current.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.playbackRate.value = 1.05; // Set playback speed to 1.5x
    sourceNode.connect(audioContextRef.current.destination);
    currentSourceNodeRef.current = sourceNode;

    sourceNode.onended = () => {
      currentSourceNodeRef.current = null; // Clear ref once ended
      isPlaybackLoopActiveRef.current = false; // Allow next iteration
      setIsPlayingAudio(false); // Mark as not playing this specific chunk
      playNextChunkFromQueue(); // Try to play next chunk
    };

    sourceNode.start();
  }, [isGeneratingSpeech, isPlayingAudio]);


  const generateAndPlay = useCallback(async (text: string) => {
    if (isGeneratingSpeech || isPlayingAudio) { 
        stopPlayback();
        await new Promise(resolve => setTimeout(resolve, 100)); // Ensure state updates and cleanup
    }
    
    if (!geminiClient || !audioContextRef.current || isLoadingModel || modelError) {
      console.warn('Gemini TTS not ready or encountered an error.');
      if (isLoadingModel) alert("TTS system is still initializing. Please wait.");
      else if (modelError) alert(`TTS Error: ${modelError}. Cannot play speech.`);
      else if (!audioContextRef.current) alert("AudioContext not available. Cannot play speech.");
      setIsGeneratingSpeech(false);
      setIsPlayingAudio(false);
      return;
    }
    
    setIsGeneratingSpeech(true);
    audioQueueRef.current = []; // Clear queue for new request
    abortControllerRef.current = new AbortController();
    const currentAbortSignal = abortControllerRef.current.signal;

    try {
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      if (audioContextRef.current.state !== 'running') {
        throw new Error("AudioContext is not running. User interaction might be required.");
      }

      const stream = await geminiClient.models.generateContentStream({
        model: TTS_MODEL_NAME,
        contents: [{ role: 'user', parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO], 
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: TTS_VOICE_NAME } },
          },
        },
        signal: currentAbortSignal,
      });

      for await (const chunk of stream) {
        if (currentAbortSignal.aborted) {
          console.log("TTS stream processing aborted.");
          break;
        }

        const audioDataPart = chunk.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
        const base64Audio = audioDataPart?.inlineData?.data;
        const mimeType = audioDataPart?.inlineData?.mimeType;

        if (base64Audio && mimeType) {
          const audioParams = parseAudioMimeType(mimeType);
          if (!audioParams) {
            console.warn(`Could not parse MIME type: ${mimeType}. Skipping chunk.`);
            continue;
          }

          const audioBinary = Buffer.from(base64Audio, 'base64');
          
          let float32Data: Float32Array;
          if (audioParams.bitsPerSample === 16) {
            const pcmData = new Int16Array(audioBinary.buffer, audioBinary.byteOffset, audioBinary.byteLength / 2);
            float32Data = new Float32Array(pcmData.length);
            for (let i = 0; i < pcmData.length; i++) {
              float32Data[i] = pcmData[i] / 32768.0; 
            }
          } else if (audioParams.bitsPerSample === 8) {
            const pcmData = new Uint8Array(audioBinary.buffer, audioBinary.byteOffset, audioBinary.byteLength);
            float32Data = new Float32Array(pcmData.length);
            for (let i = 0; i < pcmData.length; i++) {
              float32Data[i] = (pcmData[i] - 128) / 128.0; // Assuming unsigned 8-bit PCM
            }
          } else {
            console.warn(`Unsupported bitsPerSample: ${audioParams.bitsPerSample}. Skipping chunk.`);
            continue;
          }

          if (float32Data.length > 0 && audioContextRef.current) {
            const audioBuffer = audioContextRef.current.createBuffer(audioParams.channels, float32Data.length / audioParams.channels, audioParams.sampleRate);
            // Assuming interleaved data if channels > 1, though TTS is usually mono
            for (let ch = 0; ch < audioParams.channels; ch++) {
                const channelData = new Float32Array(float32Data.length / audioParams.channels);
                for (let i = 0; i < channelData.length; i++) {
                    channelData[i] = float32Data[i * audioParams.channels + ch];
                }
                 audioBuffer.copyToChannel(channelData, ch);
            }
            audioQueueRef.current.push(audioBuffer);
            if (!isPlayingAudio && !isPlaybackLoopActiveRef.current) { // Trigger playback if not already started
                 playNextChunkFromQueue();
            }
          }
        }
      }
    } catch (e: any) {
      if (e.name === 'AbortError' || (currentAbortSignal && currentAbortSignal.aborted)) {
         console.log('TTS generation aborted.', e.message);
      } else {
        console.error('Error in Gemini TTS stream:', e);
        setModelError(`TTS Error: ${e.message}`);
         if (e.message.includes("API key not valid") || e.message.includes("permission denied")) {
            alert(`Gemini TTS Error: API key issue or permission denied. Check configuration. Details: ${e.message}`);
          } else {
            alert(`Gemini TTS Error: Could not generate speech. Details: ${e.message}`);
          }
      }
    } finally {
      setIsGeneratingSpeech(false);
      // Playback continues via playNextChunkFromQueue until queue is empty
      // If queue is empty here and not aborted, it might mean no audio was produced
      if (audioQueueRef.current.length === 0 && !(currentAbortSignal && currentAbortSignal.aborted)) {
        setIsPlayingAudio(false);
        isPlaybackLoopActiveRef.current = false;
      } else if (!isPlaybackLoopActiveRef.current && audioQueueRef.current.length > 0){
        // Ensure playback starts if chunks were queued but loop wasn't active
        playNextChunkFromQueue();
      }
    }
  }, [geminiClient, isLoadingModel, modelError, stopPlayback, playNextChunkFromQueue, isPlayingAudio]);
  
  const canSpeak = !!geminiClient && !!audioContextRef.current && !isLoadingModel && !modelError;

  return {
    isLoadingModel,
    modelError,
    isGeneratingSpeech,
    isPlayingAudio,
    canSpeak,
    generateAndPlay,
    stopPlayback,
  };
};
