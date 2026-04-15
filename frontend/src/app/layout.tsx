import "./globals.css";
import "@rainbow-me/rainbowkit/styles.css";
import type { Metadata } from "next";
import Providers from "../components/Providers";

export const metadata: Metadata = {
  title: "zkT-REX | Private Compliance for Tokenized Securities",
  description:
    "Zero-knowledge privacy layer for ERC-3643 compliant tokenized securities",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
