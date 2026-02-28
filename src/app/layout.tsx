import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/shared/Sidebar";

export const metadata: Metadata = {
  title: "PulseFeed - Web3 行业动态聚合",
  description: "轻量级 Web3 行业动态聚合平台",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <Sidebar />
        <main className="ml-56 min-h-screen p-6">{children}</main>
      </body>
    </html>
  );
}
