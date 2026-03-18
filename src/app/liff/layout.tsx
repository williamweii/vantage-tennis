// LIFF 頁面使用獨立 layout，不顯示主要的 BottomNav 和 Header
export default function LiffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      {children}
    </div>
  );
}
