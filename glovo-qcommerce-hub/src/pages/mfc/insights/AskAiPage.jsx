import { useEffect, useRef, useState } from 'react';
import TopNav from '../../../components/layout/TopNav';
import Button from '../../../components/ui/Button';
import { Spinner } from '../../../components/ui/LoadingState';
import { useAskMfcAi } from '../../../api/mfc';

const STARTER_PROMPTS = [
  'How is MNLF1 doing this week?',
  'Which categories grew the most week over week?',
  'Which products are furthest behind their weekly delivery threshold?'
];

function MessageBubble({ role, text }) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-lg px-3 py-2 text-[12.5px] leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-accent text-on-accent'
            : 'bg-surface-container-lowest border border-outline-variant text-on-surface'
        }`}
      >
        {text}
      </div>
    </div>
  );
}

export default function AskAiPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const askAi = useAskMfcAi();
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, askAi.isPending]);

  function send(question) {
    const q = question.trim();
    if (!q || askAi.isPending) return;

    const history = messages;
    setMessages((prev) => [...prev, { role: 'user', text: q }]);
    setInput('');

    askAi.mutate(
      { question: q, history },
      {
        onSuccess: (result) => {
          setMessages((prev) => [...prev, { role: 'model', text: result.answer }]);
        },
        onError: (err) => {
          setMessages((prev) => [...prev, { role: 'model', text: err?.message || "Something went wrong reaching Ask-AI — try again in a moment." }]);
        }
      }
    );
  }

  function handleSubmit(e) {
    e.preventDefault();
    send(input);
  }

  return (
    <>
      <TopNav title="Ask AI" breadcrumb={[{ label: 'MFC', to: '/mfc' }, { label: 'Ask AI' }]} />
      <div className="flex-1 flex flex-col min-h-0 bg-surface">
        <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar px-5 py-4">
          <div className="max-w-3xl mx-auto space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-8 space-y-4">
                <span className="material-symbols-outlined text-[32px] text-accent">auto_awesome</span>
                <p className="text-[13px] text-secondary max-w-sm mx-auto">
                  Ask anything about the MFC business — availability, delivered orders, sales trends, at-risk SKUs.
                </p>
                <div className="flex flex-col gap-2 items-center">
                  {STARTER_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => send(p)}
                      className="text-[12px] text-on-surface bg-surface-container-lowest border border-outline-variant rounded-md px-3 py-1.5 hover:bg-surface-container transition-colors"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <MessageBubble key={i} role={m.role} text={m.text} />
            ))}

            {askAi.isPending && (
              <div className="flex justify-start">
                <div className="bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 flex items-center gap-2">
                  <Spinner className="text-[15px]" />
                  <span className="text-[12px] text-secondary">Thinking…</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="border-t border-outline-variant px-5 py-3 shrink-0">
          <div className="max-w-3xl mx-auto flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about MFC availability, orders, sales…"
              className="flex-1 bg-surface-container border border-outline-variant rounded-md px-3 py-2 text-[12.5px] focus:outline-none focus:ring-1 focus:ring-accent-container/40 transition-all"
            />
            <Button type="submit" variant="primary" size="md" icon="send" disabled={!input.trim() || askAi.isPending}>
              Send
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
