import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "ProcediPriz",
  description: "Calculadora de honorários médicos para neurocirurgia.",
  icons: {
    icon: [{ url: "/procedipriz-icon.svg", type: "image/svg+xml" }],
    shortcut: [{ url: "/procedipriz-icon.svg", type: "image/svg+xml" }],
  },
};

const themeInitScript = `
(() => {
  try {
    const stored = localStorage.getItem("theme");
    const theme = stored === "dark" || stored === "light"
      ? stored
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("light", theme === "light");
    root.style.colorScheme = theme;
  } catch {
    document.documentElement.classList.add("light");
    document.documentElement.style.colorScheme = "light";
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
