import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Adaptive Zero Trust Firewall — PS001",
  description: "Context-aware ZTNA gateway with ML-based trust scoring, OPA policy enforcement, and step-up MFA feedback loop.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#080b14] text-[#e2e8f0] font-[Inter] antialiased">
        <div className="min-h-screen px-4 pt-4 md:px-6 md:pt-6">
          <Navbar />
          {children}
        </div>
      </body>
    </html>
  );
}
