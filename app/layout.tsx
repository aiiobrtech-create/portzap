import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";
import { AppShell } from "@/app/app-shell";
import { getCurrentOperatorContext } from "@/lib/operator-auth";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-display",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Controle de Encomendas",
  description: "Sistema de controle de encomendas para portarias",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/icon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const operatorContext = await getCurrentOperatorContext();

  return (
    <html lang="pt-BR">
      <body className={`${sora.variable} ${manrope.variable}`}>
        <AppShell
          operatorName={operatorContext?.user.full_name}
          operatorEmail={operatorContext?.user.email}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
