import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "우리언제봐?",
  description: "모임 시간을 함께 정해요",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
