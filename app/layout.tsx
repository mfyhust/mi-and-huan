import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "觅&还 · 校园失物找回 Agent",
  description: "描述一次，让寻找持续发生。校园失物登记、线索跟进与认领交接。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
