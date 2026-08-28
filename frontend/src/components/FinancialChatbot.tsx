import { useEffect, useRef, useState, useCallback } from 'react';
import { chatbotApi } from '../services/api';
import botLogo from '../../image1.png';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const SUGGESTED_QUESTIONS = [
  'Where am I spending the most?',
  'How can I save more money?',
  'Any unusual transactions?',
  'Show my spending trends',
  'Compare my income vs expenses',
  'What are my recurring expenses?',
];

function generateId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Clean raw markdown artifacts: strip **, *, ##, #, etc.
 * Convert headings and bold markers into clean readable text.
 */
function cleanMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '$1')
    .replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '$1')
    .replace(/^[-*]{3,}\s*$/gm, '');
}

/**
 * Render cleaned text into structured JSX with bullet points.
 */
function renderContent(rawText: string) {
  const text = cleanMarkdown(rawText);
  const lines = text.split('\n');
  const elements: JSX.Element[] = [];
  let currentList: string[] = [];

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="chatbot-md-list">
          {currentList.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>,
      );
      currentList = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const bulletMatch = line.match(/^\s*[-•*]\s+(.+)/);
    const numberedMatch = line.match(/^\s*\d+[.)]\s+(.+)/);

    if (bulletMatch) {
      currentList.push(bulletMatch[1]);
    } else if (numberedMatch) {
      currentList.push(numberedMatch[1]);
    } else {
      flushList();
      if (line.trim() === '') {
        elements.push(<div key={`br-${i}`} className="h-2" />);
      } else {
        elements.push(
          <p key={`p-${i}`} className="chatbot-md-para">{line}</p>,
        );
      }
    }
  }
  flushList();

  return <>{elements}</>;
}

function AiAvatar() {
  return (
    <div className="chatbot-avatar chatbot-avatar-ai overflow-hidden p-0 bg-transparent">
      <img src={botLogo} alt="AI" className="w-full h-full object-cover rounded-lg" />
    </div>
  );
}

function UserAvatar() {
  return (
    <div className="chatbot-avatar chatbot-avatar-user">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M5.5 21a8.38 8.38 0 0 1 13 0" />
      </svg>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="chatbot-msg chatbot-msg-ai">
      <AiAvatar />
      <div className="chatbot-bubble chatbot-bubble-ai">
        <div className="chatbot-typing">
          <span /><span /><span />
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to create a typewriter effect: progressively reveals characters of `fullText`.
 */
function useTypewriter(fullText: string, isActive: boolean, speed = 12) {
  const [displayedLength, setDisplayedLength] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isActive) {
      setDisplayedLength(fullText.length);
      return;
    }

    setDisplayedLength(0);

    intervalRef.current = setInterval(() => {
      setDisplayedLength((prev) => {
        const chunkSize = Math.floor(Math.random() * 3) + 2;
        const next = prev + chunkSize;
        if (next >= fullText.length) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return fullText.length;
        }
        return next;
      });
    }, speed);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fullText, isActive, speed]);

  return {
    displayedText: fullText.slice(0, displayedLength),
    isComplete: displayedLength >= fullText.length,
  };
}

/**
 * A single AI message bubble with typewriter animation and TTS Speaker button.
 */
function AiMessageBubble({
  messageId,
  content,
  timestamp,
  shouldAnimate,
  onAnimationComplete,
  isPlaying,
  isLoadingAudio,
  onToggleSpeech,
}: {
  messageId: string;
  content: string;
  timestamp: Date;
  shouldAnimate: boolean;
  onAnimationComplete?: () => void;
  isPlaying: boolean;
  isLoadingAudio: boolean;
  onToggleSpeech: (id: string, text: string) => void;
}) {
  const { displayedText, isComplete } = useTypewriter(content, shouldAnimate);

  useEffect(() => {
    if (isComplete && shouldAnimate && onAnimationComplete) {
      onAnimationComplete();
    }
  }, [isComplete, shouldAnimate, onAnimationComplete]);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

  return (
    <div className="chatbot-msg chatbot-msg-ai">
      <AiAvatar />
      <div className="chatbot-bubble chatbot-bubble-ai group relative">
        <div className="chatbot-bubble-content">
          {renderContent(displayedText)}
          {!isComplete && <span className="chatbot-cursor">|</span>}
        </div>
        {isComplete && (
          <div className="flex items-center justify-between gap-2 mt-1 pt-1 border-t border-gray-100/60">
            <span className="chatbot-time">{formatTime(timestamp)}</span>
            <button
              onClick={() => onToggleSpeech(messageId, content)}
              className={`chatbot-speak-btn flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                isPlaying
                  ? 'text-[#4f6bf5] font-semibold bg-indigo-50'
                  : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100/70'
              }`}
              title={isPlaying ? 'Stop reading' : 'Read aloud with ElevenLabs'}
              disabled={isLoadingAudio}
            >
              {isLoadingAudio ? (
                <span className="inline-block animate-spin">⏳</span>
              ) : isPlaying ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                  <span>Playing</span>
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  </svg>
                  <span>Listen</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FinancialChatbot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [animatingIds, setAnimatingIds] = useState<Set<string>>(new Set());

  // Audio TTS states
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const [audioCache, setAudioCache] = useState<Record<string, string>>({});
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Audio STT recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'listening' | 'transcribing'>('idle');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const speechRecognitionRef = useRef<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll inside chat messages container
  const scrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  const markAnimationComplete = useCallback((id: string) => {
    setAnimatingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Cleanup audio when unmounting
  useEffect(() => {
    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
    };
  }, []);

  // Text-To-Speech handler using ElevenLabs
  const handleToggleSpeech = async (messageId: string, text: string) => {
    // If currently playing this message, pause it
    if (playingMessageId === messageId && currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
      setPlayingMessageId(null);
      return;
    }

    // Stop any existing audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
      setPlayingMessageId(null);
    }

    // Check cached audio URL
    if (audioCache[messageId]) {
      const audio = new Audio(audioCache[messageId]);
      currentAudioRef.current = audio;
      setPlayingMessageId(messageId);
      audio.play();
      audio.onended = () => {
        setPlayingMessageId(null);
        currentAudioRef.current = null;
      };
      return;
    }

    // Fetch new audio from ElevenLabs backend
    try {
      setLoadingAudioId(messageId);
      const audioBlob = await chatbotApi.tts(text);
      const audioUrl = URL.createObjectURL(audioBlob);
      setAudioCache((prev) => ({ ...prev, [messageId]: audioUrl }));

      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;
      setPlayingMessageId(messageId);
      audio.play();
      audio.onended = () => {
        setPlayingMessageId(null);
        currentAudioRef.current = null;
      };
    } catch (err: any) {
      console.error('TTS playback error:', err);
    } finally {
      setLoadingAudioId(null);
    }
  };

  // Speech-to-Text handler (Record Audio -> ElevenLabs Scribe STT)
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // Stop all audio tracks
        stream.getTracks().forEach((track) => track.stop());

        if (audioBlob.size > 0) {
          setRecordingStatus('transcribing');
          try {
            const res = await chatbotApi.stt(audioBlob);
            if (res.text) {
              setInput((prev) => (prev ? `${prev} ${res.text}` : res.text));
            }
          } catch (err) {
            console.error('STT Transcription error:', err);
          } finally {
            setRecordingStatus('idle');
            setIsRecording(false);
          }
        } else {
          setRecordingStatus('idle');
          setIsRecording(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingStatus('listening');

      // Also trigger Web Speech recognition for live preview if available in browser
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.onresult = (e: any) => {
            const transcript = Array.from(e.results)
              .map((result: any) => result[0].transcript)
              .join('');
            if (transcript) {
              setInput(transcript);
            }
          };
          recognition.start();
          speechRecognitionRef.current = recognition;
        } catch (e) {
          // Fallback silently to ElevenLabs STT
        }
      }
    } catch (err) {
      console.error('Mic access error:', err);
      alert('Microphone access was denied or is unavailable.');
      setIsRecording(false);
      setRecordingStatus('idle');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (e) {}
    }
  };

  // Load proactive insights on mount
  useEffect(() => {
    let cancelled = false;
    chatbotApi
      .insights()
      .then((data) => {
        if (!cancelled) {
          const id = generateId();
          setMessages([
            {
              id,
              role: 'assistant',
              content: data.content,
              timestamp: new Date(),
            },
          ]);
          setAnimatingIds(new Set([id]));
        }
      })
      .catch(() => {
        if (!cancelled) {
          const id = generateId();
          setMessages([
            {
              id,
              role: 'assistant',
              content:
                "Welcome to FinFlux AI! I'm your personal financial analyst. I have access to all your financial data and can help you understand your spending patterns, identify savings opportunities, and answer any questions about your finances.\n\nTry asking me a question or pick one of the suggestions below!",
              timestamp: new Date(),
            },
          ]);
          setAnimatingIds(new Set([id]));
        }
      })
      .finally(() => {
        if (!cancelled) setInsightsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    // Stop speaking if playing
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
      setPlayingMessageId(null);
    }

    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const conversationHistory = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const response = await chatbotApi.chat(conversationHistory);
      const aiId = generateId();
      setMessages((prev) => [
        ...prev,
        {
          id: aiId,
          role: 'assistant',
          content: response.content,
          timestamp: new Date(),
        },
      ]);
      setAnimatingIds((prev) => new Set(prev).add(aiId));
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.message ||
        'Unable to reach the AI model. Please ensure Ollama is running.';
      const errId = generateId();
      setMessages((prev) => [
        ...prev,
        {
          id: errId,
          role: 'assistant',
          content: `Something went wrong: ${errorMsg}`,
          timestamp: new Date(),
        },
      ]);
      setAnimatingIds((prev) => new Set(prev).add(errId));
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleSuggestion = (question: string) => {
    sendMessage(question);
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

  return (
    <div className="finflux-chatbot">
      {/* Header */}
      <div className="chatbot-header">
        <div className="chatbot-header-left">
          <div className="chatbot-header-icon overflow-hidden p-0 bg-transparent">
            <img src={botLogo} alt="FinFlux AI" className="w-full h-full object-cover rounded-lg" />
          </div>
          <div>
            <h2 className="chatbot-title">FinFlux AI</h2>
            <p className="chatbot-subtitle">Personal financial analyst</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="chatbot-header-badge">
            <span className="chatbot-status-dot" />
            <span className="chatbot-status-text">
              {isLoading ? 'Thinking…' : 'Online'}
            </span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="chatbot-messages" ref={messagesContainerRef}>
        {insightsLoading && messages.length === 0 && (
          <div className="chatbot-loading-insights">
            <div className="chatbot-typing">
              <span /><span /><span />
            </div>
            <p>Analyzing your finances…</p>
          </div>
        )}

        {messages.map((msg) =>
          msg.role === 'assistant' ? (
            <AiMessageBubble
              key={msg.id}
              messageId={msg.id}
              content={msg.content}
              timestamp={msg.timestamp}
              shouldAnimate={animatingIds.has(msg.id)}
              onAnimationComplete={() => markAnimationComplete(msg.id)}
              isPlaying={playingMessageId === msg.id}
              isLoadingAudio={loadingAudioId === msg.id}
              onToggleSpeech={handleToggleSpeech}
            />
          ) : (
            <div key={msg.id} className="chatbot-msg chatbot-msg-user">
              <div className="chatbot-bubble chatbot-bubble-user">
                <div className="chatbot-bubble-content">{msg.content}</div>
                <span className="chatbot-time">{formatTime(msg.timestamp)}</span>
              </div>
              <UserAvatar />
            </div>
          ),
        )}

        {isLoading && <TypingIndicator />}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested questions */}
      {messages.length <= 1 && !isLoading && (
        <div className="chatbot-suggestions">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              className="chatbot-suggestion-chip"
              onClick={() => handleSuggestion(q)}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="chatbot-input-area">
        <div className={`chatbot-input-wrapper ${isRecording ? 'ring-2 ring-red-400 border-red-400 bg-red-50/40' : ''}`}>
          {isRecording ? (
            <div className="flex-1 flex items-center gap-2 py-1 px-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping shrink-0" />
              <span className="text-xs font-semibold text-red-600 truncate">
                {recordingStatus === 'transcribing' ? 'Transcribing with ElevenLabs...' : 'Listening... speak now'}
              </span>
            </div>
          ) : (
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask or speak about your finances…"
              className="chatbot-input"
              disabled={isLoading || isRecording}
            />
          )}

          {/* Microphone button (Speech-to-Text) */}
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
              isRecording
                ? 'bg-red-500 text-white animate-pulse'
                : 'text-gray-400 hover:text-[#4f6bf5] hover:bg-indigo-50'
            }`}
            title={isRecording ? 'Stop recording' : 'Speak to AI (Speech-to-Text)'}
            disabled={isLoading || recordingStatus === 'transcribing'}
          >
            {isRecording ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
          </button>

          {/* Send button */}
          <button
            onClick={() => sendMessage(input)}
            className="chatbot-send-btn"
            disabled={!input.trim() || isLoading || isRecording}
            title="Send message"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12 14-7-4 7 4 7z" />
              <path d="M5 12h14" />
            </svg>
          </button>
        </div>
        <p className="chatbot-disclaimer">
          AI responses are based on your actual data. Always verify important financial decisions.
        </p>
      </div>
    </div>
  );
}
