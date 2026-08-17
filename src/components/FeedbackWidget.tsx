"use client";

import { useState, useRef, useEffect } from "react";
import { portalFetch } from "@/lib/api";
import { useLanguage, useLanguageReady, type Lang } from "@/lib/useLanguage";

/** Waarden die naar de API gaan. Blijven ongewijzigd, alleen het label vertaalt. */
const CATEGORY_VALUES = ["bug", "verbetering", "idee"] as const;

type CategoryValue = (typeof CATEGORY_VALUES)[number];

interface Copy {
  panelTitle: string;
  categories: Record<CategoryValue, string>;
  placeholder: string;
  pageLabel: string;
  thanks: string;
  send: string;
  openButton: string;
  closeButton: string;
}

const COPY: Record<Lang, Copy> = {
  nl: {
    panelTitle: "Feedback",
    categories: {
      bug: "Bug",
      verbetering: "Verbetering",
      idee: "Idee",
    },
    placeholder: "Wat kunnen we verbeteren?",
    pageLabel: "Pagina:",
    thanks: "Bedankt voor je feedback",
    send: "Verstuur",
    openButton: "Geef feedback",
    closeButton: "Sluiten",
  },
  en: {
    panelTitle: "Feedback",
    categories: {
      bug: "Bug",
      verbetering: "Improvement",
      idee: "Idea",
    },
    placeholder: "What can we improve?",
    pageLabel: "Page:",
    thanks: "Thanks for your feedback",
    send: "Send",
    openButton: "Give feedback",
    closeButton: "Close",
  },
};

export function FeedbackWidget() {
  const lang = useLanguage();
  const langReady = useLanguageReady();
  const c = COPY[lang];
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<CategoryValue>("verbetering");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (widgetRef.current && !widgetRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const currentPage = typeof window !== "undefined" ? window.location.pathname : "";

  async function handleSubmit() {
    if (!message.trim()) return;
    setSending(true);
    try {
      await portalFetch("/feedback", {
        method: "POST",
        body: JSON.stringify({
          page: currentPage,
          category,
          message: message.trim(),
          source: "portal",
        }),
      });
      setSent(true);
      setTimeout(() => {
        setOpen(false);
        setSent(false);
        setMessage("");
        setCategory("verbetering");
      }, 1500);
    } catch (err) {
      console.error("Feedback submit failed:", err);
    } finally {
      setSending(false);
    }
  }

  // Zwevende knop met een tooltip en een aria-label in de klanttaal. Zolang die
  // taal niet vaststaat tonen we hem niet, dat scheelt een knop die na een
  // halve tel van taal wisselt.
  if (!langReady) return null;

  return (
    <div ref={widgetRef} className="fixed bottom-4 right-4 z-50">
      {open && (
        <div className="absolute bottom-14 right-0 w-80 rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800">
          {sent ? (
            <div className="flex flex-col items-center gap-2 p-8">
              <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{c.thanks}</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{c.panelTitle}</span>
                <button
                  onClick={() => setOpen(false)}
                  aria-label={c.closeButton}
                  title={c.closeButton}
                  className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex gap-2">
                  {CATEGORY_VALUES.map((value) => (
                    <button
                      key={value}
                      onClick={() => setCategory(value)}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                        category === value
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                      }`}
                    >
                      {c.categories[value]}
                    </button>
                  ))}
                </div>

                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={c.placeholder}
                  className="w-full resize-none rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-500"
                  rows={3}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      handleSubmit();
                    }
                  }}
                />

                <p className="text-[10px] text-gray-400">
                  {c.pageLabel} {currentPage}
                </p>

                <button
                  onClick={handleSubmit}
                  disabled={!message.trim() || sending}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? (
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                  ) : (
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                  )}
                  {c.send}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        className={`flex h-11 w-11 items-center justify-center rounded-full shadow-lg transition-all duration-200 ${
          open
            ? "bg-blue-600 text-white"
            : "bg-white border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600 hover:shadow-xl dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700"
        }`}
        aria-label={c.openButton}
        title={c.openButton}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
      </button>
    </div>
  );
}
