"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { portalFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase-browser";
import { useTheme } from "@/lib/theme";
// Note: createClient kept for magic link OTP flow
import { toast } from "sonner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { theme } = useTheme();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      setSent(true);
    } catch {
      toast.error("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
            <div className="w-16 h-16 bg-accent-light rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-2">Check je inbox</h1>
            <p className="text-muted-foreground mb-4">
              We hebben een inloglink gestuurd naar <strong className="text-foreground">{email}</strong>
            </p>
            <p className="text-sm text-muted">
              De link is 15 minuten geldig. Niet ontvangen? Check je spam of{" "}
              <button
                onClick={() => { setSent(false); setEmail(""); }}
                className="text-accent hover:underline"
              >
                probeer opnieuw
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img
            src={theme === "dark" ? "/logo-dark.svg" : "/logo-light.svg"}
            alt="Stevin.AI"
            className="h-8 w-auto"
          />
          <p className="text-muted-foreground mt-3">Welkom bij jouw dashboard</p>
        </div>

        <div className="bg-card border border-border p-8">
          <h2 className="text-lg font-semibold mb-1">Inloggen</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Log in op je dashboard.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1.5">
                E-mailadres
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="naam@bedrijf.nl"
                required
                autoFocus
                className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full py-2.5 bg-accent text-white font-medium rounded-lg hover:bg-accent-muted transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Bezig..." : "Inloglink versturen"}
            </button>
          </form>

          <p className="text-xs text-muted text-center mt-6">
            Geen wachtwoord nodig. Veilig inloggen via je e-mail.
          </p>
        </div>

        <p className="text-center text-xs text-muted mt-6">
          Powered by Stevin.AI
        </p>
      </div>
    </div>
  );
}
