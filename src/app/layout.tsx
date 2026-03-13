import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/layout/BottomNav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Vantage Tennis | Court Sniper",
  description: "Automated tennis court monitoring and instant booking notifications.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" className="dark bg-[#09090b]">
      <body className={`${inter.className} min-h-screen bg-[#09090b] text-[#f4f4f5] relative overflow-x-hidden md:pb-0 font-sans`}>
        {/* Top Header */}
        <header className="fixed top-0 z-50 w-full bg-[#09090b]/85 backdrop-blur-[16px] border-b border-[#27272a] flex justify-center">
          <div className="w-full max-w-[1080px] h-[53px] flex items-center px-6 justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-[22px] leading-none">🎾</span>
              <span className="font-bold text-[16px] tracking-[-0.3px]">Vantage Tennis</span>
              <span className="bg-gradient-to-br from-[#10b981] to-[#059669] text-black text-[10px] font-extrabold px-1.5 py-0.5 rounded ml-1.5">PRO</span>
            </div>
            <div className="text-[12px] text-[#71717a]">
              —
            </div>
          </div>
        </header>

        <main className="flex-1 pb-24 md:pb-0 pt-[53px]">{children}</main>

        <div className="md:hidden">
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
