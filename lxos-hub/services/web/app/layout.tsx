import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "./_components/AuthProvider";
import { ThemeProvider } from "./_components/ThemeProvider";

export const metadata: Metadata = {
  title: {
    default: "LX-OS Hub",
    template: "%s | LX-OS Hub",
  },
  description: "AI Prompt Engineering Workspace — build, test, benchmark, and share auditable prompt systems.",
  keywords: ["prompt engineering", "LLM", "AI", "DSL", "benchmark"],
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "LX-OS Hub",
    description: "AI Prompt Engineering Workspace",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0c0e11",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AuthProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
