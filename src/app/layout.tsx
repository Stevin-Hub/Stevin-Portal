import type { Metadata } from "next";
import { Inter_Tight, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/lib/theme";
import { Toaster } from "sonner";
import "./globals.css";

// Desk-canon: Inter Tight voor display/body, JetBrains Mono voor technisch.
const interTight = Inter_Tight({ variable: "--font-inter-tight", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Stevin.AI — Portaal",
  description: "Campagne-inzichten, budgetbeheer en Stevin Assistant",
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png", sizes: "64x64" },
    ],
    apple: [
      { url: "/apple-icon.png", type: "image/png", sizes: "64x64" },
    ],
  },
  robots: {
    index: false,
    follow: false,
  },
};

const themeScript = `
(function(){
  try {
    localStorage.setItem('stevin-portal-theme', 'light');
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
  } catch(e) {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="nl"
      className={`${interTight.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>{children}</ThemeProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--card)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
              fontSize: "13px",
            },
          }}
        />
      </body>
    </html>
  );
}
