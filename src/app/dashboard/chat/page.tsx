"use client";

import { useEffect, useRef, useState } from "react";
import { portalFetch } from "@/lib/api";
import { useLanguage, type Lang } from "@/lib/useLanguage";
import AuthGuard from "@/components/AuthGuard";
import { toast } from "sonner";
import { Send, Bot, User, AlertTriangle } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
}

interface TokenUsage {
  used: number;
  limit: number;
  remaining: number;
}

/**
 * Alleen de schil van het chatscherm staat hier. De antwoorden zelf komen uit
 * de Hub, die al in de taal van de klant schrijft.
 *
 * De ondertitel is geen gewone copy: die meldt dat de klant met AI praat en
 * niet met zijn consultant (AI Act art. 50(1)). Die strekking blijft in beide
 * talen staan.
 */
interface Copy {
  title: string;
  aiNotice: string;
  fairUse: string;
  greeting: (name: string) => string;
  intro: string;
  suggestions: string[];
  limitBannerTitle: string;
  limitBannerBody: string;
  limitMessage: string;
  genericError: string;
  historyError: string;
  placeholder: string;
  placeholderLimit: string;
}

const COPY: Record<Lang, Copy> = {
  nl: {
    title: "Stevin Assistant",
    aiNotice: "Je praat hier met AI, niet met je consultant. Stel je vraag over je campagnes in gewone taal.",
    fairUse: "Je nadert de maandelijkse Fair Use limiet. Neem contact op met je specialist als je meer analyses nodig hebt.",
    greeting: (name) => `Hallo ${name}!`,
    intro: "Ik ben de AI-assistent van Stevin. Ik help je de resultaten te begrijpen en je campagnes te optimaliseren.",
    suggestions: [
      "Hoe gaat het met mijn campagnes?",
      "Wat zijn mijn resultaten deze maand?",
      "Waar gaat het meeste budget naartoe?",
    ],
    limitBannerTitle: "Maandelijks chatbudget bereikt",
    limitBannerBody: "Neem contact op met je consultant voor extra tokens.",
    limitMessage:
      "Het maandelijkse chatbudget is bereikt. Neem contact op met je consultant voor meer tokens of wacht tot volgende maand.",
    genericError: "Sorry, er ging iets mis. Probeer het nog eens.",
    historyError: "Chatgeschiedenis kon niet geladen worden",
    placeholder: "Stel een vraag over je campagnes...",
    placeholderLimit: "Chatbudget bereikt...",
  },
  en: {
    title: "Stevin Assistant",
    aiNotice: "You are talking to AI here, not to your consultant. Ask about your campaigns in plain language.",
    fairUse: "You are close to the monthly fair use limit. Contact your specialist if you need more analyses.",
    greeting: (name) => `Hello ${name}!`,
    intro: "I am the AI assistant of Stevin. I help you understand the results and improve your campaigns.",
    suggestions: [
      "How are my campaigns doing?",
      "What are my results this month?",
      "Where does most of the budget go?",
    ],
    limitBannerTitle: "Monthly chat budget reached",
    limitBannerBody: "Contact your consultant for extra tokens.",
    limitMessage:
      "The monthly chat budget has been reached. Contact your consultant for more tokens or wait until next month.",
    genericError: "Sorry, something went wrong. Please try again.",
    historyError: "The chat history could not be loaded",
    placeholder: "Ask a question about your campaigns...",
    placeholderLimit: "Chat budget reached...",
  },
};

export default function ChatPage() {
  return (
    <AuthGuard>
      {(user) => <ChatContent userName={user.displayName || user.email.split("@")[0]} />}
    </AuthGuard>
  );
}

function ChatContent({ userName }: { userName: string }) {
  const lang = useLanguage();
  const c = COPY[lang];
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState<TokenUsage | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // De geschiedenis wordt bij het openen een keer opgehaald, dus die effect-hook
  // mag niet op de taal reageren (dat zou een tweede call geven). Via de ref
  // pakt de foutmelding wel de taal die op dat moment bekend is.
  const copyRef = useRef(c);
  copyRef.current = c;

  useEffect(() => {
    portalFetch<{ messages: Message[] }>("/chat?limit=50")
      .then((data) => setMessages(data.messages))
      .catch(() => toast.error(copyRef.current.historyError))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending || limitReached) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setSending(true);

    try {
      const data = await portalFetch<{ response: string; usage?: TokenUsage }>("/chat", {
        method: "POST",
        body: JSON.stringify({ message: text }),
      });
      setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
      if (data.usage) setUsage(data.usage);
    } catch (err: any) {
      // Check if it's a token limit error
      if (err.message?.includes("Tokenlimiet")) {
        setLimitReached(true);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: c.limitMessage },
        ]);
      } else {
        toast.error(err.message);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: c.genericError },
        ]);
      }
    } finally {
      setSending(false);
    }
  }

  const usagePct = usage ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : null;
  const fairUseWarning = usagePct !== null && usagePct >= 90;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] lg:h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">{c.title}</h1>
          {/* AI-vermelding staat bewust hier en niet in de lege staat: hij moet
              zichtbaar blijven zodra er berichten zijn. AI Act art. 50(1). */}
          <p className="text-muted-foreground text-sm mt-1">{c.aiNotice}</p>
        </div>
      </div>

      {/* Fair Use warning, only at 90%+ */}
      {fairUseWarning && (
        <div className="bg-warning-light border border-warning/20 rounded-xl p-3 mb-3 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0" />
          <p className="text-sm">{c.fairUse}</p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-card border border-border rounded-xl p-4 space-y-4 mb-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12">
            <Bot className="w-12 h-12 text-muted mx-auto mb-3" />
            <h3 className="font-medium mb-1">{c.greeting(userName)}</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">{c.intro}</p>
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              {c.suggestions.map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); }}
                  className="text-xs bg-card-hover border border-border px-3 py-1.5 rounded-full text-muted-foreground hover:text-foreground transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.role === "user"
                    ? "bg-accent/10 text-accent"
                    : "bg-card-hover text-muted-foreground"
                }`}
              >
                {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div
                className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-accent text-white rounded-br-md"
                    : "bg-card-hover border border-border-subtle rounded-bl-md"
                }`}
              >
                {msg.role === "assistant" ? (
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                      ul: ({ children }) => <ul className="list-disc ml-4 mb-2 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal ml-4 mb-2 space-y-1">{children}</ol>,
                      li: ({ children }) => <li>{children}</li>,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))
        )}
        {sending && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-card-hover flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="bg-card-hover border border-border-subtle rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Token limit banner */}
      {limitReached && (
        <div className="bg-warning-light border border-warning/20 rounded-xl p-3 mb-3 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0" />
          <div>
            <p className="text-sm font-medium">{c.limitBannerTitle}</p>
            <p className="text-xs text-muted-foreground">{c.limitBannerBody}</p>
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={limitReached ? c.placeholderLimit : c.placeholder}
          disabled={sending || limitReached}
          className="flex-1 px-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={sending || !input.trim() || limitReached}
          className="px-4 py-3 bg-accent text-white rounded-xl hover:bg-accent-muted transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
