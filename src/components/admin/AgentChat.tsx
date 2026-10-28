'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Bot, Loader2, Send, X } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';

type Role = 'user' | 'assistant' | 'system';

interface ChatMessage {
  id: number;
  role: Role;
  text: string;
  /** The user message that produced a confirmation prompt. */
  originalMessage?: string;
  needsConfirmation?: boolean;
  /** Set once the admin answers the confirmation, so the buttons hide. */
  confirmAnswered?: boolean;
  /** Sealed token for the previewed action; sent back on "yes". */
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




export default function AgentChat() {
  const { L } = useLanguage();
  const HINTS = [L('কর্মী যোগ করব কীভাবে?'), L('গ্রুপে লিংক যোগ'), L('আজকের রিপোর্ট'), 'how do I set a target?', L('তুমি কী পারো?'), '#status'];
  const NETWORK_ERROR =
    L('Network problem. Please check your connection and try again. / নেটওয়ার্ক সমস্যা। ইন্টারনেট চেক করে আবার চেষ্টা করুন।');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 0,
      role: 'assistant',
      text:
        L('হ্যালো! কী করতে চান লিখুন, আমি সঠিক পেজে নিয়ে যাব। যেমন: "নতুন কর্মী যোগ", "রহিমের অবস্থা দেখাও"।\n') +
        'Hi! Tell me what you want to do and I will open the right page. Example: "add employee", "show Rahim".',
    },
  ]);

  const nextId = useRef(1);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listEndRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  // Escape closes the panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Move focus into the panel on open, and back to the launcher on close.
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    } else if (wasOpen.current) {
      launcherRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  // Keep the newest message in view.
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, loading]);

  const addMessage = (msg: Omit<ChatMessage, 'id'>) => {
    const id = nextId.current++;
    setMessages((prev) => [...prev, { ...msg, id }]);
    return id;
  };

  const callAgent = async (body: { message: string; confirm?: boolean; pending?: { token: string } }) => {
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
          text:
            L('Something went wrong. Please try again. / কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।'),
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
      // Take the admin straight to the page; the chat stays open (it lives in the admin layout).
      if (data.link && data.navigate) router.push(data.link.href);
    } catch {
      addMessage({ role: 'assistant', text: NETWORK_ERROR });
    } finally {
      setLoading(false);
    }
  };

  const send = () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    addMessage({ role: 'user', text });
    void callAgent({ message: text });
  };

  const answerConfirmation = (msgId: number, original: string, yes: boolean, pending?: { token: string }) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, confirmAnswered: true } : m)),
    );
    if (yes) {
      addMessage({ role: 'user', text: L('Yes, do it / হ্যাঁ, করুন') });
      void callAgent({ message: original, confirm: true, pending });
    } else {
      addMessage({ role: 'user', text: L('No / না') });
      addMessage({
        role: 'assistant',
        text: L('Cancelled. Nothing was changed. / বাতিল করা হয়েছে। কিছু পরিবর্তন হয়নি।'),
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
          aria-label={L("Open AI assistant / AI সহকারী খুলুন")}
          aria-expanded={open}
          aria-controls="agent-chat-panel"
          className="no-print press fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-[var(--shadow-pop)] transition hover:bg-brand-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/40"
        >
          <Bot className="h-5 w-5" aria-hidden="true" />
        </button>
      )}

      {open && (
        <div
          id="agent-chat-panel"
          role="dialog"
          aria-modal="false"
          aria-label={L("AI assistant / AI সহকারী")}
          className="no-print animate-scale-in fixed inset-0 z-50 flex flex-col bg-white sm:inset-auto sm:bottom-4 sm:right-4 sm:h-[560px] sm:max-h-[calc(100vh-2rem)] sm:w-[380px] sm:rounded-2xl sm:border sm:border-slate-200 sm:shadow-[var(--shadow-overlay)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 text-slate-900 sm:rounded-t-2xl">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-600/10">
                <Bot className="h-4 w-4" aria-hidden="true" />
              </span>
              <h2 className="truncate text-sm font-semibold text-slate-900">
                {L("সহকারী · Assistant")}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={L("Close / বন্ধ করুন")}
              className="btn-icon h-8 w-8"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* Messages */}
          <div
            className="flex-1 space-y-3 overflow-y-auto overflow-x-hidden px-4 py-4"
            role="log"
            aria-live="polite"
          >
            {messages.map((m) => (
              <div
                key={m.id}
                className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
              >
                <div className="max-w-[85%] space-y-2">
                  <div
                    className={
                      m.role === 'user'
                        ? 'whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-brand-600 px-3.5 py-2 text-sm leading-relaxed text-white'
                        : 'whitespace-pre-wrap break-words rounded-2xl rounded-bl-md border border-slate-200/70 bg-slate-50 px-3.5 py-2 text-sm leading-relaxed text-slate-800'
                    }
                  >
                    {m.text}
                  </div>
                  {m.needsConfirmation && !m.confirmAnswered && m.originalMessage && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => answerConfirmation(m.id, m.originalMessage!, true, m.pending)}
                        className="btn btn-primary btn-sm"
                      >
                        {L("Yes, do it / হ্যাঁ, করুন")}
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => answerConfirmation(m.id, m.originalMessage!, false)}
                        className="btn btn-secondary btn-sm"
                      >
                        {L("No / না")}
                      </button>
                    </div>
                  )}
                  {(m.link || (m.suggestions && m.suggestions.length > 0)) && (
                    <div className="flex flex-wrap gap-2">
                      {[...(m.link ? [m.link] : []), ...(m.suggestions ?? [])].map((l, i) => (
                        <button
                          key={`${l.href}-${i}`}
                          type="button"
                          onClick={() => router.push(l.href)}
                          className={
                            i === 0 && m.link
                              ? 'btn btn-primary btn-sm'
                              : 'btn btn-secondary btn-sm'
                          }
                        >
                          {l.labelBn}
                          <ArrowRight className="h-3 w-3" aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start" role="status">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200/70 bg-slate-50 px-3.5 py-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>{L("Thinking... / ভাবছি...")}</span>
                </div>
              </div>
            )}
            <div ref={listEndRef} />
          </div>

          {/* Quick hints */}
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-t border-slate-200 px-4 pt-3">
            {HINTS.map((hint) => (
              <button
                key={hint}
                type="button"
                onClick={() => {
                  setInput(hint);
                  inputRef.current?.focus();
                }}
                className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-brand-300 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
              >
                {hint}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="flex items-end gap-2 px-4 py-3">
            <label htmlFor="agent-chat-input" className="sr-only">
              {L("Message / বার্তা")}
            </label>
            <textarea
              ref={inputRef}
              id="agent-chat-input"
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={L("Type a message... / বার্তা লিখুন...")}
              className="input max-h-32 min-h-[40px] flex-1 resize-none"
            />
            <button
              type="button"
              onClick={send}
              disabled={loading || !input.trim()}
              aria-label={L("Send / পাঠান")}
              className="btn btn-primary h-10 w-10 shrink-0 px-0"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
