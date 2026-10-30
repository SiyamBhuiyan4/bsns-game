'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BarChart3,
  Bot,
  CalendarCheck,
  Check,
  ChevronRight,
  ExternalLink,
  FileText,
  Layers,
  Loader2,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';

type Role = 'user' | 'assistant' | 'system';

interface ChatMessage {
  id: number;
  role: Role;
  text: string;
  originalMessage?: string;
  needsConfirmation?: boolean;
  confirmAnswered?: boolean;
  pending?: { token: string };
  link?: NavLink;
  suggestions?: NavLink[];
}

interface NavLink {
  href: string;
  labelBn: string;
  labelEn: string;
}

interface AgentResponse {
  reply: string;
  needsConfirmation?: boolean;
  pending?: { command: string; token: string };
  link?: NavLink;
  suggestions?: NavLink[];
  navigate?: boolean;
}

/** Detects section category to assign relevant icon and theme color */
function getLinkMeta(href: string) {
  if (href.includes('/admin/reports')) {
    return {
      icon: FileText,
      badgeBn: 'রিপোর্ট',
      badgeEn: 'Report',
      accent: 'border-emerald-200 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100/80 hover:border-emerald-300',
      iconBg: 'bg-emerald-100 text-emerald-700',
    };
  }
  if (href.includes('/admin/employees')) {
    return {
      icon: Users,
      badgeBn: 'টিম ও কর্মী',
      badgeEn: 'Team & Employee',
      accent: 'border-sky-200 bg-sky-50/70 text-sky-800 hover:bg-sky-100/80 hover:border-sky-300',
      iconBg: 'bg-sky-100 text-sky-700',
    };
  }
  if (href.includes('/admin/audit')) {
    return {
      icon: ShieldCheck,
      badgeBn: 'অডিট লগ',
      badgeEn: 'Audit Log',
      accent: 'border-amber-200 bg-amber-50/70 text-amber-900 hover:bg-amber-100/80 hover:border-amber-300',
      iconBg: 'bg-amber-100 text-amber-700',
    };
  }
  if (href.includes('/admin/sections')) {
    return {
      icon: Layers,
      badgeBn: 'গ্রুপ ও লিংক',
      badgeEn: 'Groups & Links',
      accent: 'border-violet-200 bg-violet-50/70 text-violet-800 hover:bg-violet-100/80 hover:border-violet-300',
      iconBg: 'bg-violet-100 text-violet-700',
    };
  }
  if (href.includes('/admin/targets')) {
    return {
      icon: Target,
      badgeBn: 'টার্গেট ও কাজ',
      badgeEn: 'Targets & Tasks',
      accent: 'border-teal-200 bg-teal-50/70 text-teal-800 hover:bg-teal-100/80 hover:border-teal-300',
      iconBg: 'bg-teal-100 text-teal-700',
    };
  }
  if (href.includes('/admin/leads')) {
    return {
      icon: UserPlus,
      badgeBn: 'কাস্টমার ও লিড',
      badgeEn: 'Leads',
      accent: 'border-orange-200 bg-orange-50/70 text-orange-900 hover:bg-orange-100/80 hover:border-orange-300',
      iconBg: 'bg-orange-100 text-orange-700',
    };
  }
  if (href.includes('/admin/plan')) {
    return {
      icon: CalendarCheck,
      badgeBn: 'কর্মপরিকল্পনা',
      badgeEn: 'Action Plan',
      accent: 'border-indigo-200 bg-indigo-50/70 text-indigo-900 hover:bg-indigo-100/80 hover:border-indigo-300',
      iconBg: 'bg-indigo-100 text-indigo-700',
    };
  }
  if (href.includes('/admin/dashboard')) {
    return {
      icon: BarChart3,
      badgeBn: 'ড্যাশবোর্ড',
      badgeEn: 'Dashboard',
      accent: 'border-brand-200 bg-brand-50/70 text-brand-900 hover:bg-brand-100/80 hover:border-brand-300',
      iconBg: 'bg-brand-100 text-brand-700',
    };
  }
  return {
    icon: ExternalLink,
    badgeBn: 'পেজ',
    badgeEn: 'Page',
    accent: 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50 hover:border-slate-300',
    iconBg: 'bg-slate-100 text-slate-700',
  };
}

/** Formats message text with clean bolding, bullet points, and code chips */
function FormattedBubbleText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 break-words text-sm leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;

        // Handle bullet points
        const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ');
        const displayLine = isBullet ? trimmed.replace(/^[-*•]\s+/, '') : line;

        // Simple bold parser for **bold** text
        const parts = displayLine.split(/(\*\*[^*]+\*\*)/g);

        const renderedLine = parts.map((part, pIdx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={pIdx} className="font-semibold text-slate-900">
                {part.slice(2, -2)}
              </strong>
            );
          }
          if (part.startsWith('#') && part.length > 1 && !part.includes(' ')) {
            return (
              <code key={pIdx} className="mx-0.5 rounded bg-slate-200/80 px-1.5 py-0.5 text-xs font-semibold text-brand-800">
                {part}
              </code>
            );
          }
          return part;
        });

        if (isBullet) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />
              <div className="flex-1">{renderedLine}</div>
            </div>
          );
        }

        return <div key={idx}>{renderedLine}</div>;
      })}
    </div>
  );
}

export default function AgentChat() {
  const { L, lang } = useLanguage();
  const router = useRouter();

  const QUICK_SHORTCUTS = [
    {
      titleBn: 'আজকের রিপোর্ট',
      titleEn: "Today's Report",
      subBn: 'দৈনিক বিক্রয় ও লিংক স্ট্যাটাস',
      subEn: 'Daily progress & links',
      icon: FileText,
      query: 'আজকের রিপোর্ট দেখাও',
      accent: 'hover:border-emerald-300 hover:bg-emerald-50/50',
    },
    {
      titleBn: 'কর্মী তালিকা',
      titleEn: 'Employee Team',
      subBn: 'সব কর্মীর পারফরম্যান্স',
      subEn: 'View all employees',
      icon: Users,
      query: 'কর্মী তালিকা দেখাও',
      accent: 'hover:border-sky-300 hover:bg-sky-50/50',
    },
    {
      titleBn: 'গ্রুপ ও লিংক',
      titleEn: 'Groups & Links',
      subBn: 'সেকশন ও ফেসবুক গ্রুপ',
      subEn: 'Manage sections & links',
      icon: Layers,
      query: 'গ্রুপ পেজে নিয়ে যাও',
      accent: 'hover:border-violet-300 hover:bg-violet-50/50',
    },
    {
      titleBn: 'অডিট লগ',
      titleEn: 'Audit Log',
      subBn: 'সকল পরিবর্তনের রেকর্ড',
      subEn: 'View system audit trails',
      icon: ShieldCheck,
      query: 'অডিট লগ দেখাও',
      accent: 'hover:border-amber-300 hover:bg-amber-50/50',
    },
  ];

  const HINTS = [
    L('আজকের রিপোর্ট', "Today's Report"),
    L('কর্মী তালিকা', 'Employee List'),
    L('গ্রুপে লিংক যোগ', 'Add Links to Group'),
    L('টার্গেট সেট কীভাবে করব?', 'How to set a target?'),
    '#status',
    '#help',
  ];

  const INITIAL_MESSAGE =
    lang === 'en'
      ? 'Hi! What would you like to do? I can take you directly to reports, employees, sections, or answer questions.'
      : 'হ্যালো! কী করতে চান লিখুন, আমি সঠিক পেজে নিয়ে যাব। যেমন: "আজকের রিপোর্ট", "নতুন কর্মী যোগ", "গ্রুপ লিংক"।';

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 0,
      role: 'assistant',
      text: INITIAL_MESSAGE,
    },
  ]);

  const nextId = useRef(1);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listEndRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  // Voice text (speech-to-text) and Text-to-speech audio playback state
  const [isListening, setIsListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Clean up speech recognition and synthesis when modal closes
  useEffect(() => {
    if (!open) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setSpeakingId(null);
      activeUtteranceRef.current = null;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
    }
  }, [open]);

  // Speech-to-text toggle
  const toggleListening = () => {
    if (typeof window === 'undefined') return;

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      return;
    }

    // Stop active speech playback so mic does not catch assistant audio
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      activeUtteranceRef.current = null;
    }

    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      alert(
        lang === 'en'
          ? 'Voice speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.'
          : 'আপনার ব্রাউজারে ভয়েস রিকগনিশন সাপোর্ট নেই। গুগল ক্রোম, এজ বা সাফারি ব্রাউজার ব্যবহার করুন।'
      );
      return;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.lang = lang === 'en' ? 'en-US' : 'bn-BD';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        if (transcript) {
          setInput((prev) => {
            const trimmed = prev.trim();
            return trimmed ? `${trimmed} ${transcript}` : transcript;
          });
          inputRef.current?.focus();
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('[SpeechRecognition] error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          alert(
            lang === 'en'
              ? 'Microphone permission was denied. Please allow microphone access in your browser settings.'
              : 'মাইক্রোফোনের অনুমতি পাওয়া যায়নি। ব্রাউজার সেটিংসে গিয়ে মাইক্রোফোন অ্যাক্সেস অন করুন।'
          );
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('[SpeechRecognition] start error:', err);
      setIsListening(false);
    }
  };

  // Text-to-speech toggle for reading assistant bubbles aloud
  const toggleSpeak = (id: number, text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      activeUtteranceRef.current = null;
      return;
    }

    window.speechSynthesis.cancel();

    const cleanText = text
      .replace(/[*_#`[\]()]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[•\-\n]+/g, '. ')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const hasBengali = /[\u0980-\u09FF]/.test(cleanText);
    utterance.lang = hasBengali ? 'bn-BD' : 'en-US';
    utterance.rate = 1.0;

    activeUtteranceRef.current = utterance;
    utterance.onend = () => {
      setSpeakingId(null);
      activeUtteranceRef.current = null;
    };
    utterance.onerror = () => {
      setSpeakingId(null);
      activeUtteranceRef.current = null;
    };

    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    } else if (wasOpen.current) {
      launcherRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, loading]);

  const addMessage = (msg: Omit<ChatMessage, 'id'>) => {
    const id = nextId.current++;
    setMessages((prev) => [...prev, { ...msg, id }]);
    return id;
  };

  const resetChat = () => {
    setMessages([
      {
        id: nextId.current++,
        role: 'assistant',
        text: INITIAL_MESSAGE,
      },
    ]);
  };

  const callAgent = async (body: {
    message: string;
    confirm?: boolean;
    pending?: { token: string };
    history?: Array<{ role: 'user' | 'assistant'; text: string }>;
  }) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as AgentResponse | null;
      if (!res.ok || !data || typeof data.reply !== 'string') {
        addMessage({
          role: 'assistant',
          text: L('Something went wrong. Please try again.', 'কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।'),
        });
        return;
      }
      addMessage({
        role: 'assistant',
        text: data.reply,
        needsConfirmation: Boolean(data.needsConfirmation),
        originalMessage: body.message,
        pending: data.pending ? { token: data.pending.token } : undefined,
        link: data.link,
        suggestions: data.suggestions,
      });
      if (data.link && data.navigate) {
        handleNavigate(data.link.href);
      }
    } catch {
      addMessage({
        role: 'assistant',
        text: L(
          'Network problem. Please check your connection and try again.',
          'নেটওয়ার্ক সমস্যা। ইন্টারনেট চেক করে আবার চেষ্টা করুন।'
        ),
      });
    } finally {
      setLoading(false);
    }
  };

  const send = (overrideText?: string) => {
    const text = (overrideText || input).trim();
    if (!text || loading) return;
    setInput('');
    addMessage({ role: 'user', text });

    // Exclude static initial greeting so history starts clean
    const recentHistory = messages
      .filter((m) => m.id !== 0 && (m.role === 'user' || m.role === 'assistant'))
      .slice(-8)
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        text: m.text,
      }));

    void callAgent({ message: text, history: recentHistory });
  };

  const handleNavigate = (href: string) => {
    if (href.startsWith('http://') || href.startsWith('https://')) {
      window.open(href, '_blank', 'noopener,noreferrer');
    } else {
      router.push(href);
      if (typeof window !== 'undefined' && window.innerWidth < 640) {
        setOpen(false);
      }
    }
  };

  const answerConfirmation = (msgId: number, original: string, yes: boolean, pending?: { token: string }) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, confirmAnswered: true } : m))
    );
    if (yes) {
      addMessage({ role: 'user', text: L('হ্যাঁ, সম্পন্ন করুন', 'Yes, execute it') });
      void callAgent({ message: original, confirm: true, pending });
    } else {
      addMessage({ role: 'user', text: L('না, বাতিল করুন', 'No, cancel') });
      addMessage({
        role: 'assistant',
        text: L('বাতিল করা হয়েছে। কোনো পরিবর্তন করা হয়নি।', 'Cancelled. No changes were made.'),
      });
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      {!open && (
        <button
          ref={launcherRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-label={L('AI সহকারী খুলুন', 'Open AI assistant')}
          aria-expanded={open}
          aria-controls="agent-chat-panel"
          className="no-print press fixed bottom-4 right-4 z-50 flex h-13 w-13 items-center justify-center rounded-full bg-brand-600 text-white shadow-[var(--shadow-overlay)] ring-4 ring-white/80 transition-all hover:bg-brand-700 hover:scale-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/40 cursor-pointer"
        >
          <Bot className="h-6 w-6" aria-hidden="true" />
        </button>
      )}

      {open && (
        <div
          id="agent-chat-panel"
          role="dialog"
          aria-modal="false"
          aria-label={L('AI সহকারী', 'AI Assistant')}
          className="no-print animate-scale-in fixed inset-0 z-50 flex flex-col bg-white sm:inset-auto sm:bottom-4 sm:right-4 sm:h-[580px] sm:max-h-[calc(100vh-2rem)] sm:w-[420px] sm:rounded-2xl sm:border sm:border-slate-200/90 sm:shadow-[var(--shadow-overlay)] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 text-slate-900 sm:rounded-t-2xl">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-600/15">
                <Bot className="h-4.5 w-4.5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="truncate text-sm font-semibold text-slate-900">
                  {L('স্মার্ট সহকারী · Assistant', 'AI Assistant')}
                </h2>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{L('অনলাইন · সক্রিয়', 'Online · Active')}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={resetChat}
                title={L('চ্যাট রিসেট করুন', 'Reset conversation')}
                aria-label={L('চ্যাট রিসেট করুন', 'Reset conversation')}
                className="btn-icon h-8 w-8 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={L('বন্ধ করুন', 'Close')}
                className="btn-icon h-8 w-8 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Messages Container */}
          <div
            className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-4 bg-slate-50/50"
            role="log"
            aria-live="polite"
          >
            {messages.map((m) => {
              const isUser = m.role === 'user';
              const linkMeta = m.link ? getLinkMeta(m.link.href) : null;
              const LinkIcon = linkMeta?.icon || ExternalLink;
              const linkLabel = m.link
                ? lang === 'en'
                  ? m.link.labelEn || m.link.labelBn
                  : m.link.labelBn || m.link.labelEn
                : '';

              return (
                <div
                  key={m.id}
                  className={`flex items-start gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-200 text-brand-600 shadow-xs mt-0.5">
                      <Bot className="h-4 w-4" aria-hidden="true" />
                    </span>
                  )}

                  <div className={`space-y-2.5 ${isUser ? 'max-w-[85%]' : 'max-w-[88%]'}`}>
                    {/* Text Bubble */}
                    <div
                      className={
                        isUser
                          ? 'rounded-2xl rounded-tr-xs bg-brand-600 px-4 py-2.5 text-sm leading-relaxed text-white shadow-xs'
                          : 'rounded-2xl rounded-tl-xs border border-slate-200/90 bg-white px-4 py-2.5 text-sm text-slate-800 shadow-xs'
                      }
                    >
                      {isUser ? (
                        m.text
                      ) : (
                        <>
                          <FormattedBubbleText text={m.text} />
                          <div className="pt-2 flex items-center justify-between border-t border-slate-100/80 mt-2">
                            <button
                              type="button"
                              onClick={() => toggleSpeak(m.id, m.text)}
                              aria-label={
                                speakingId === m.id
                                  ? L('পড়া বন্ধ করুন', 'Stop listening')
                                  : L('পড়ে শুনুন', 'Listen to voice')
                              }
                              title={
                                speakingId === m.id
                                  ? L('পড়া বন্ধ করুন', 'Stop listening')
                                  : L('ভয়েসে শুনুন', 'Read aloud')
                              }
                              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-brand-600 transition-colors py-0.5 px-1.5 rounded-md hover:bg-slate-50 cursor-pointer"
                            >
                              {speakingId === m.id ? (
                                <>
                                  <VolumeX className="h-3.5 w-3.5 text-rose-500 animate-pulse" />
                                  <span className="text-rose-600 font-medium">{L('থামুন', 'Stop')}</span>
                                </>
                              ) : (
                                <>
                                  <Volume2 className="h-3.5 w-3.5 text-slate-400" />
                                  <span>{L('ভয়েস শুনুন', 'Listen')}</span>
                                </>
                              )}
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Needs Confirmation Prompt Banner */}
                    {m.needsConfirmation && !m.confirmAnswered && m.originalMessage && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-3 shadow-xs space-y-2.5 animate-fade-in">
                        <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                          <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
                          <span>{L('নিশ্চিতকরণ প্রয়োজন', 'Confirmation Required')}</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => answerConfirmation(m.id, m.originalMessage!, true, m.pending)}
                            className="btn btn-primary btn-sm flex-1 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                          >
                            <Check className="h-3.5 w-3.5" />
                            {L('হ্যাঁ, করুন', 'Yes, execute')}
                          </button>
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => answerConfirmation(m.id, m.originalMessage!, false)}
                            className="btn btn-secondary btn-sm flex-1 bg-white cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                            {L('না, বাতিল', 'Cancel')}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Primary Navigation Destination Card */}
                    {m.link && (
                      <div className="pt-0.5">
                        <button
                          type="button"
                          onClick={() => handleNavigate(m.link!.href)}
                          className={`w-full group text-left rounded-xl border p-3 transition shadow-xs flex items-center justify-between gap-3 cursor-pointer ${linkMeta?.accent}`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-xs ${linkMeta?.iconBg}`}>
                              <LinkIcon className="h-4.5 w-4.5" aria-hidden="true" />
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-sm truncate text-slate-900 group-hover:text-brand-700">
                                  {linkLabel}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 truncate">
                                {lang === 'en' ? 'Click to open page' : 'পেজটি খুলতে এখানে ক্লিক করুন'}
                              </p>
                            </div>
                          </div>
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/80 text-slate-600 group-hover:translate-x-0.5 group-hover:text-brand-700 transition">
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                          </span>
                        </button>
                      </div>
                    )}

                    {/* Secondary Suggestions Pills */}
                    {m.suggestions && m.suggestions.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                          <Sparkles className="h-3 w-3 text-brand-600" />
                          <span>{L('সম্পর্কিত পেজ ও অপশন:', 'Related pages:')}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {m.suggestions
                            .filter((s) => s.href !== m.link?.href)
                            .map((s, idx) => {
                              const meta = getLinkMeta(s.href);
                              const Icon = meta.icon;
                              const label = lang === 'en' ? s.labelEn || s.labelBn : s.labelBn || s.labelEn;
                              return (
                                <button
                                  key={`${s.href}-${idx}`}
                                  type="button"
                                  onClick={() => handleNavigate(s.href)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-2xs hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50/50 transition cursor-pointer"
                                >
                                  <Icon className="h-3 w-3 text-slate-400 group-hover:text-brand-600" />
                                  <span>{label}</span>
                                  <ArrowRight className="h-2.5 w-2.5 text-slate-300" />
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Starter Welcome Quick Actions Grid (shown when conversation is new) */}
            {messages.length === 1 && (
              <div className="pt-2 animate-fade-in space-y-2">
                <p className="text-xs font-medium text-slate-500 px-1">
                  {L('সরাসরি পেজে যান বা প্রশ্ন করুন:', 'Quick section shortcuts:')}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_SHORTCUTS.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => send(item.query)}
                        className={`text-left rounded-xl border border-slate-200/90 bg-white p-2.5 transition shadow-2xs group flex flex-col justify-between h-20 cursor-pointer ${item.accent}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-700 group-hover:bg-brand-50 group-hover:text-brand-700 transition">
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <ArrowRight className="h-3 w-3 text-slate-300 group-hover:text-brand-600 transition" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-800 group-hover:text-brand-700">
                            {lang === 'en' ? item.titleEn : item.titleBn}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">
                            {lang === 'en' ? item.subEn : item.subBn}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Loading Indicator */}
            {loading && (
              <div className="flex items-start gap-2.5 justify-start" role="status">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-200 text-brand-600 shadow-xs mt-0.5">
                  <Bot className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="flex items-center gap-2 rounded-2xl rounded-tl-xs border border-slate-200/80 bg-white px-4 py-2.5 text-xs text-slate-500 shadow-xs">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-600" aria-hidden="true" />
                  <span>{L('সহকারী তথ্য খুঁজছে...', 'Thinking and finding page...')}</span>
                </div>
              </div>
            )}

            <div ref={listEndRef} />
          </div>

          {/* Quick hints ticker */}
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-t border-slate-200 bg-white px-3 pt-2.5 pb-1">
            {HINTS.map((hint) => (
              <button
                key={hint}
                type="button"
                onClick={() => {
                  setInput(hint);
                  inputRef.current?.focus();
                }}
                className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 cursor-pointer"
              >
                {hint}
              </button>
            ))}
          </div>

          {/* Active Listening Voice Banner */}
          {isListening && (
            <div className="flex items-center justify-between bg-rose-50 border-t border-rose-200/80 px-3 py-1.5 text-xs text-rose-700 animate-fade-in">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                </span>
                <span className="font-medium text-[11px] sm:text-xs">
                  {L('শুনছি... কথা বলুন (বাংলা বা ইংরেজি)', 'Listening... speak now (Bengali or English)')}
                </span>
              </div>
              <button
                type="button"
                onClick={toggleListening}
                className="text-[11px] font-semibold text-rose-800 hover:underline cursor-pointer"
              >
                {L('বাতিল', 'Cancel')}
              </button>
            </div>
          )}

          {/* Text & Voice Input area */}
          <div className="flex items-end gap-1.5 bg-white px-3 pb-3 pt-1">
            <label htmlFor="agent-chat-input" className="sr-only">
              {L('বার্তা', 'Message')}
            </label>
            <textarea
              ref={inputRef}
              id="agent-chat-input"
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={
                isListening
                  ? L('কথা বলুন, স্বয়ংক্রিয়ভাবে টেক্সট হবে...', 'Listening to your voice...')
                  : L('বার্তা লিখুন বা মাইকে কথা বলুন...', 'Type or click mic to speak...')
              }
              className="input max-h-32 min-h-[40px] flex-1 resize-none py-2 text-xs sm:text-sm bg-slate-50/70 focus:bg-white"
            />
            {/* Microphone button for Voice-to-Text */}
            <button
              type="button"
              onClick={toggleListening}
              aria-label={
                isListening
                  ? L('ভয়েস রেকর্ড বন্ধ করুন', 'Stop listening')
                  : L('ভয়েসে কথা বলুন', 'Voice input')
              }
              title={
                isListening
                  ? L('ভয়েস বন্ধ করুন', 'Stop listening')
                  : L('ভয়েস টাইপিং (মাইক্রোফোন)', 'Voice input')
              }
              className={`h-10 w-10 shrink-0 rounded-xl transition flex items-center justify-center cursor-pointer ${
                isListening
                  ? 'bg-rose-500 text-white animate-pulse shadow-md ring-2 ring-rose-300'
                  : 'border border-slate-200 bg-slate-50 text-slate-600 hover:text-brand-600 hover:bg-brand-50 hover:border-brand-200'
              }`}
            >
              {isListening ? (
                <MicOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Mic className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
            {/* Send button */}
            <button
              type="button"
              onClick={() => send()}
              disabled={loading || !input.trim()}
              aria-label={L('পাঠান', 'Send')}
              className="btn btn-primary h-10 w-10 shrink-0 px-0 rounded-xl cursor-pointer"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
