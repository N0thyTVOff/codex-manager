import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Codex Manager — coffre personnel chiffré",
  description: "Organisez vos comptes ChatGPT Plus utilisés avec Codex sans exposer leurs secrets.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
