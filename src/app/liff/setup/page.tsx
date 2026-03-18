"use client";

import { useEffect, useState } from "react";
import type Liff from "@line/liff";

// ── 地區群組（對應 scraper 實際有資料的）
const DISTRICT_OPTIONS = [
  {
    id: "north",
    label: "🌊 河濱北區",
    sub: "士林・大同・中山・北投",
    venues: "百齡、延平、大佳、觀山、美堤",
  },
  {
    id: "central",
    label: "🏙️ 河濱中區",
    sub: "中正・萬華",
    venues: "中正、古亭、溪洲、華中、道南、雙園",
  },
  {
    id: "east",
    label: "🌆 東區",
    sub: "松山・內湖",
    venues: "彩虹、成美右岸",
  },
] as const;

const TIME_OPTIONS = [
  { id: "weekday_evening", label: "🌙 平日晚上", sub: "18:00 – 22:00" },
  { id: "weekend_morning", label: "☀️ 週末上午", sub: "08:00 – 12:00" },
  { id: "weekend_afternoon", label: "🌇 週末下午/晚上", sub: "12:00 – 21:00" },
] as const;

type DistrictId = typeof DISTRICT_OPTIONS[number]["id"];
type TimeId = typeof TIME_OPTIONS[number]["id"];

export default function LiffSetupPage() {
  const [liffReady, setLiffReady] = useState(false);
  const [lineUserId, setLineUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [districts, setDistricts] = useState<DistrictId[]>([]);
  const [timePrefs, setTimePrefs] = useState<TimeId[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    if (!liffId) {
      setError("LIFF ID 未設定，請聯繫開發者。");
      return;
    }

    import("@line/liff").then((mod) => {
      const liff = mod.default as typeof Liff;
      liff
        .init({ liffId })
        .then(() => {
          if (!liff.isLoggedIn()) {
            liff.login();
            return;
          }
          return liff.getProfile();
        })
        .then((profile) => {
          if (!profile) return;
          setLineUserId(profile.userId);
          setDisplayName(profile.displayName);
          setLiffReady(true);
        })
        .catch((e) => {
          console.error(e);
          setError("無法初始化 LINE 登入，請重新開啟。");
        });
    });
  }, []);

  function toggleDistrict(id: DistrictId) {
    setDistricts((prev) =>
      prev.includes(id)
        ? prev.filter((d) => d !== id)
        : prev.length >= 2
        ? prev  // 最多 2 個
        : [...prev, id]
    );
  }

  function toggleTime(id: TimeId) {
    setTimePrefs((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  async function handleSave() {
    if (!lineUserId) return;
    if (districts.length === 0) {
      setError("請至少選一個地區");
      return;
    }
    if (timePrefs.length === 0) {
      setError("請至少選一個時段");
      return;
    }
    setError(null);
    setSaving(true);

    try {
      const res = await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ line_user_id: lineUserId, display_name: displayName, districts, time_prefs: timePrefs }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSaved(true);

      // 2 秒後關閉 LIFF 視窗回 LINE
      setTimeout(async () => {
        const mod = await import("@line/liff");
        const liff = mod.default as typeof Liff;
        if (liff.isInClient()) {
          liff.closeWindow();
        }
      }, 2000);
    } catch (e) {
      console.error(e);
      setError("儲存失敗，請稍後再試。");
    } finally {
      setSaving(false);
    }
  }

  // ── 成功畫面
  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center gap-6">
        <div className="text-6xl">✅</div>
        <h1 className="text-2xl font-bold text-white">設定成功！</h1>
        <p className="text-zinc-400">場地雷達已啟動，有空位時我們會通知你。</p>
        <p className="text-zinc-600 text-sm">視窗將自動關閉...</p>
      </div>
    );
  }

  // ── 初始化中 / 錯誤畫面
  if (!liffReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center gap-4">
        {error ? (
          <>
            <div className="text-4xl">⚠️</div>
            <p className="text-red-400 font-semibold">{error}</p>
          </>
        ) : (
          <>
            <div className="w-8 h-8 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            <p className="text-zinc-400 text-sm">LINE 登入中...</p>
          </>
        )}
      </div>
    );
  }

  // ── 主體
  return (
    <div className="flex flex-col min-h-screen px-5 py-8 pb-12 max-w-lg mx-auto gap-8">
      {/* Header */}
      <header className="text-center">
        <h1 className="text-2xl font-bold text-white">🎯 設定你的週末場地雷達</h1>
        <p className="text-zinc-400 text-sm mt-2 leading-relaxed">
          只要 5 秒，熱門場地釋出立刻通知你！
          <br />
          <span className="text-green-400 font-semibold">目前完全免費</span>
        </p>
        {displayName && (
          <p className="text-zinc-500 text-xs mt-2">Hi, {displayName} 👋</p>
        )}
      </header>

      {/* 地區選擇 */}
      <section>
        <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-wider mb-3">
          📍 常駐地區 <span className="text-zinc-600 font-normal normal-case">（最多選 2 個）</span>
        </h2>
        <div className="flex flex-col gap-3">
          {DISTRICT_OPTIONS.map((opt) => {
            const selected = districts.includes(opt.id);
            const disabled = !selected && districts.length >= 2;
            return (
              <button
                key={opt.id}
                onClick={() => !disabled && toggleDistrict(opt.id)}
                className={`
                  w-full rounded-2xl border px-4 py-4 text-left transition-all duration-150
                  ${selected
                    ? "bg-green-500/10 border-green-500/50 shadow-[0_0_12px_rgba(34,197,94,0.1)]"
                    : disabled
                    ? "bg-zinc-900/40 border-zinc-800 opacity-40 cursor-not-allowed"
                    : "bg-zinc-900 border-zinc-800 hover:border-zinc-600 active:scale-[0.98]"
                  }
                `}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-white text-base">{opt.label}</p>
                    <p className="text-zinc-400 text-xs mt-0.5">{opt.sub}</p>
                    <p className="text-zinc-600 text-xs mt-1">{opt.venues}</p>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0
                    ${selected ? "bg-green-500 border-green-500" : "border-zinc-600"}`}>
                    {selected && <span className="text-black text-xs font-bold">✓</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 時段選擇 */}
      <section>
        <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-wider mb-3">
          🕐 偏好時段 <span className="text-zinc-600 font-normal normal-case">（可複選）</span>
        </h2>
        <div className="flex flex-col gap-3">
          {TIME_OPTIONS.map((opt) => {
            const selected = timePrefs.includes(opt.id);
            return (
              <button
                key={opt.id}
                onClick={() => toggleTime(opt.id)}
                className={`
                  w-full rounded-2xl border px-4 py-4 text-left transition-all duration-150 active:scale-[0.98]
                  ${selected
                    ? "bg-green-500/10 border-green-500/50 shadow-[0_0_12px_rgba(34,197,94,0.1)]"
                    : "bg-zinc-900 border-zinc-800 hover:border-zinc-600"
                  }
                `}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-white text-base">{opt.label}</p>
                    <p className="text-zinc-400 text-xs mt-0.5">{opt.sub}</p>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0
                    ${selected ? "bg-green-500 border-green-500" : "border-zinc-600"}`}>
                    {selected && <span className="text-black text-xs font-bold">✓</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 錯誤提示 */}
      {error && (
        <p className="text-red-400 text-sm text-center -mt-4">{error}</p>
      )}

      {/* CTA */}
      <button
        onClick={handleSave}
        disabled={saving || districts.length === 0 || timePrefs.length === 0}
        className={`
          w-full rounded-2xl py-4 font-bold text-base transition-all duration-200
          ${saving || districts.length === 0 || timePrefs.length === 0
            ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
            : "bg-green-500 text-black hover:bg-green-400 active:scale-[0.97] shadow-[0_0_20px_rgba(34,197,94,0.3)]"
          }
        `}
      >
        {saving ? "儲存中..." : "✅ 儲存設定，開始雷達"}
      </button>
    </div>
  );
}
