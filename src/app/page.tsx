"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { VENUE_DICT } from "@/lib/constants";

// ── Types ──────────────────────────────────────────────
type SlotRow = {
  venue_k: number;
  date: string;
  time_slot: string;
  status: string;
};

type VenueGroup = {
  venue_k: number;
  name: string;
  district: string;
  slots: { time_slot: string; status: string }[];
  availCount: number;   // 可預約（綠）
  lockedCount: number;  // 已過期 停止租借（黃，可碰運氣）
};

// ── Constants ───────────────────────────────────────────
const LOCKED_STATUS = "已過期 停止租借";
const DAYS_LOCKED = 10;

// 練習壁：永遠顯示在最後
const PRACTICE_WALLS = [
  { venue_k: 1017, name: '蘭興公園網球練習壁', district: '信義區' },
  { venue_k: 985,  name: '觀海公園網球練習壁', district: '北投區' },
  { venue_k: 969,  name: '天溪綠地網球練習壁', district: '北投區' },
  { venue_k: 117,  name: '青年公園網球練習壁', district: '萬華區' },
];

// 未開放租借場地：預設隱藏，可從開關顯示
const UNLISTED_VENUES = [
  { venue_k: 827, name: '青年公園運動休閒園區', district: '萬華區', desc: '未開放租借' },
];

function isLockedPeriod(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  return diffDays > 0 && diffDays <= DAYS_LOCKED;
}

function groupByVenue(rows: SlotRow[]): VenueGroup[] {
  // Pre-seed all venues from VENUE_DICT (excluding practice wall shown separately)
  const map = new Map<number, VenueGroup>();
  for (const [k, meta] of Object.entries(VENUE_DICT)) {
    const kNum = Number(k);
    if (PRACTICE_WALLS.some((w) => w.venue_k === kNum)) continue; // shown as static card
    map.set(kNum, {
      venue_k: kNum,
      name: meta.name,
      district: meta.district,
      slots: [],
      availCount: 0,
      lockedCount: 0,
    });
  }

  for (const row of rows) {
    if (row.status === "無開放") continue;
    const group = map.get(row.venue_k);
    if (!group) continue;
    group.slots.push({ time_slot: row.time_slot, status: row.status });
    if (row.status === "可預約") group.availCount++;
    if (row.status === LOCKED_STATUS) group.lockedCount++;
  }

  // Sort slots by time within each group
  for (const group of map.values()) {
    group.slots.sort((a, b) => a.time_slot.localeCompare(b.time_slot));
  }

  // Sort venues: online-bookable first, then walk-in chance, then fully booked
  return [...map.values()].sort((a, b) => {
    if (b.availCount !== a.availCount) return b.availCount - a.availCount;
    if (b.lockedCount !== a.lockedCount) return b.lockedCount - a.lockedCount;
    return a.name.localeCompare(b.name);
  });
}

// ── Slot pill styling ────────────────────────────────────
function slotStyle(status: string) {
  if (status === "可預約")
    return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
  if (status === LOCKED_STATUS)
    return "text-amber-400 border-amber-500/30 bg-amber-500/10";
  // 已額滿
  return "text-zinc-600 border-zinc-700/40 bg-zinc-800/20";
}

// Unique sorted districts from VENUE_DICT
const DISTRICTS = [...new Set(Object.values(VENUE_DICT).map((v) => v.district))].sort(
  (a, b) => a.localeCompare(b, 'zh-Hant')
);

// ── Component ────────────────────────────────────────────
export default function Home() {
  const [date, setDate] = useState("");
  const [showAvailOnly, setShowAvailOnly] = useState(false);
  const [showUnlisted, setShowUnlisted] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [venues, setVenues] = useState<VenueGroup[]>([]);

  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setDate(tomorrow.toISOString().slice(0, 10));
  }, []);

  const handleSearch = async () => {
    if (!date) return;
    setIsLoading(true);
    setHasSearched(true);

    try {
      const { data, error } = await supabase
        .from("court_availability")
        .select("venue_k, date, time_slot, status")
        .eq("date", date);

      if (error) {
        console.error(error);
        setVenues([]);
      } else {
        setVenues(groupByVenue(data ?? []));
      }
    } catch (e) {
      console.error(e);
      setVenues([]);
    } finally {
      setIsLoading(false);
    }
  };

  const locked = isLockedPeriod(date);

  // Filter logic: showAvailOnly hides venues with 0 online-bookable slots
  // But if locked period, "有空位" means has locked (walk-in chance) slots
  const displayed = venues
    .filter((v) => !showAvailOnly || (locked ? v.lockedCount > 0 : v.availCount > 0))
    .filter((v) => !selectedDistrict || v.district === selectedDistrict);

  const totalAvailVenues = venues.filter((v) =>
    locked ? v.lockedCount > 0 : v.availCount > 0
  ).length;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* ── NAV ─────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-xl">
        <div className="max-w-screen-xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-sm font-semibold tracking-widest text-zinc-100 uppercase">
            Vantage&nbsp;<span className="text-emerald-400">Tennis</span>
          </span>
          <span className="text-xs text-zinc-500">台北市網球場即時空位</span>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────── */}
      <header className="max-w-screen-xl mx-auto px-6 pt-20 pb-14 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3 leading-tight">
          今天，找到你的場地
        </h1>
        <p className="text-zinc-500 text-base mb-10">
          掃遍台北 {Object.keys(VENUE_DICT).length} 座網球場，空位即時更新
        </p>

        {/* ── SEARCH BAR ─────────────────────────────── */}
        <div className="inline-flex flex-col sm:flex-row items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 shadow-xl">
          <input
            type="date"
            id="date-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ colorScheme: "dark" }}
            className="bg-transparent text-sm text-zinc-100 outline-none cursor-pointer min-w-[150px]"
          />
          <div className="h-px w-full sm:h-8 sm:w-px bg-zinc-700 shrink-0" />
          <button
            onClick={handleSearch}
            disabled={isLoading}
            className="w-full sm:w-auto px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-black text-sm font-bold rounded-xl transition-all duration-150 disabled:opacity-60 disabled:pointer-events-none whitespace-nowrap"
          >
            {isLoading ? "查詢中…" : "查詢空位"}
          </button>
        </div>
      </header>

      {/* ── LOCKED PERIOD BANNER ────────────────────── */}
      {hasSearched && !isLoading && locked && (
        <div className="max-w-screen-xl mx-auto px-6 mb-6">
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-500/25 bg-amber-500/5 text-sm text-amber-300">
            <span className="text-base shrink-0">⚠️</span>
            <p>
              <span className="font-semibold">此日期在線上預約鎖定期內（距今 ≤{DAYS_LOCKED} 天）</span>，無法網路預約。
              <span className="text-amber-400/70 ml-1">
                🟡 黃色時段代表仍未被預約，可親自前往場地現場排隊、碰運氣。
              </span>
            </p>
          </div>
        </div>
      )}

      {/* ── DISTRICT FILTER ────────────────────────────── */}
      {hasSearched && !isLoading && venues.length > 0 && (
        <div className="max-w-screen-xl mx-auto px-6 mb-4">
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
            {['', ...DISTRICTS].map((d) => (
              <button
                key={d || '__all__'}
                onClick={() => setSelectedDistrict(d)}
                className={[
                  'shrink-0 px-3.5 py-1.5 text-xs font-medium rounded-full border transition-all duration-150 active:scale-95',
                  selectedDistrict === d
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                    : 'bg-zinc-900/60 border-zinc-700/50 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200',
                ].join(' ')}
              >
                {d || '全部地區'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── LEGEND ───────────────────────────────────── */}
      {hasSearched && !isLoading && venues.length > 0 && (
        <div className="max-w-screen-xl mx-auto px-6 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-5 text-xs text-zinc-500">
              <span>
                <span className="text-emerald-400 font-semibold text-sm">{totalAvailVenues}</span>
                &nbsp;/ {venues.length} 個場地
                {locked ? " 有碰運氣機會" : " 可線上預約"}
              </span>
              <span className="text-zinc-700">|</span>
              <span>{date}</span>
              <span className="hidden sm:flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                  可線上預約
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                  現場排隊
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-zinc-600 inline-block" />
                  已額滿
                </span>
              </span>
            </div>
            {/* Toggle 1: available only */}
            <div className="flex flex-col items-end gap-2">
              <label className="flex items-center gap-2.5 cursor-pointer select-none text-sm text-zinc-400">
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={showAvailOnly}
                    onChange={(e) => setShowAvailOnly(e.target.checked)}
                  />
                  <div className="w-10 h-5 bg-zinc-700 peer-checked:bg-emerald-500 rounded-full transition-colors" />
                  <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-all peer-checked:translate-x-5" />
                </div>
                {locked ? "只顯示有排隊機會" : "只顯示有空位"}
              </label>
              {/* Toggle 2: show unlisted venues */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none text-sm text-zinc-400">
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={showUnlisted}
                    onChange={(e) => setShowUnlisted(e.target.checked)}
                  />
                  <div className="w-10 h-5 bg-zinc-700 peer-checked:bg-violet-500 rounded-full transition-colors" />
                  <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-all peer-checked:translate-x-5" />
                </div>
                顯示未開放租借場地
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN ─────────────────────────────────────── */}
      <main className="max-w-screen-xl mx-auto px-6 pb-24">
        {/* Empty – not searched yet */}
        {!hasSearched && (
          <div className="flex flex-col items-center justify-center py-32 gap-4 text-zinc-600">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="2" />
              <path d="M12 24 Q 18 14 24 24 Q 30 34 36 24" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
            <p className="text-sm">選擇日期，開始尋找空位</p>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-32 gap-4 text-zinc-500">
            <div className="w-8 h-8 border-2 border-zinc-700 border-t-emerald-400 rounded-full animate-spin" />
            <p className="text-sm tracking-wide">掃描中…</p>
          </div>
        )}

        {/* No data in DB */}
        {hasSearched && !isLoading && venues.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 gap-3 text-zinc-600">
            <p className="text-sm">查無資料，請確認此日期已有爬蟲資料</p>
          </div>
        )}

        {/* No available courts (filter active) */}
        {hasSearched && !isLoading && venues.length > 0 && displayed.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 gap-3 text-zinc-600">
            <p className="text-sm">當日所有場地均已額滿 😔</p>
            <button
              onClick={() => setShowAvailOnly(false)}
              className="text-xs text-emerald-500 underline"
            >
              顯示全部場地
            </button>
          </div>
        )}

        {/* Grid of venue cards */}
        {hasSearched && !isLoading && displayed.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {displayed.map((venue, i) => {
              const hasOnlineAvail = venue.availCount > 0;
              const hasWalkIn = venue.lockedCount > 0;
              const hasAnything = hasOnlineAvail || hasWalkIn;
              const hasNoData = venue.slots.length === 0;
              return (
                <div
                  key={venue.venue_k}
                  className={[
                    "group flex flex-col gap-4 rounded-xl p-5 border transition-all duration-200 min-h-[200px]",
                    "hover:-translate-y-0.5 hover:shadow-lg",
                    hasOnlineAvail
                      ? "bg-zinc-900/60 border-zinc-800 hover:border-emerald-500/40 backdrop-blur-md"
                      : hasWalkIn
                        ? "bg-zinc-900/60 border-zinc-800 hover:border-amber-500/30 backdrop-blur-md"
                        : "bg-zinc-900/30 border-zinc-800/40 opacity-60",
                  ].join(" ")}
                  style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold leading-snug text-zinc-100 group-hover:text-white">
                        {venue.name}
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5">{venue.district}</p>
                    </div>
                    {hasOnlineAvail && (
                      <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                        {venue.availCount} 可約
                      </span>
                    )}
                    {!hasOnlineAvail && hasWalkIn && (
                      <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 whitespace-nowrap">
                        現場排隊
                      </span>
                    )}
                    {hasNoData && (
                      <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-700/50 text-zinc-500 border border-zinc-700/30 whitespace-nowrap">
                        待更新
                      </span>
                    )}
                  </div>

                  {/* Time slot pills or no-data message */}
                  {hasNoData ? (
                    <p className="text-xs text-zinc-600">此場地尚未有當日資料</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {venue.slots.map((slot) => {
                        const isAvail = slot.status === "可預約";
                        const isLocked = slot.status === LOCKED_STATUS;
                        const isFull = !isAvail && !isLocked;
                        if (showAvailOnly && isFull) return null;
                        return (
                          <span
                            key={slot.time_slot}
                            title={isAvail ? "可線上預約" : isLocked ? "鎖定中，可現場排隊" : "已額滿"}
                            className={[
                              "text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors cursor-default",
                              slotStyle(slot.status),
                            ].join(" ")}
                          >
                            {slot.time_slot.slice(0, 5)}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* CTA */}
                  {hasAnything && (
                    <a
                      href={`https://vbs.sports.taipei/venues/?K=${venue.venue_k}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={[
                        "mt-auto block text-center text-xs font-bold py-2.5 rounded-lg border transition-all duration-150 active:scale-95",
                        hasOnlineAvail
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500 hover:text-black"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500 hover:text-black",
                      ].join(" ")}
                    >
                      {hasOnlineAvail ? "前往預約 →" : "查看場地 →"}
                    </a>
                  )}
                </div>
              );
            })}

            {/* ── 未開放租借場地（開關控制）────── */}
            {showUnlisted &&
              UNLISTED_VENUES.filter((v) => !selectedDistrict || v.district === selectedDistrict).map((v) => (
                <div
                  key={v.venue_k}
                  className="group flex flex-col gap-4 rounded-xl p-5 border min-h-[200px] border-violet-500/20 bg-violet-500/5 hover:border-violet-400/40 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold leading-snug text-zinc-100">{v.name}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{v.district}</p>
                    </div>
                    <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 whitespace-nowrap">
                      未開放租借
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">{v.desc}</p>
                  <a
                    href={`https://vbs.sports.taipei/venues/?K=${v.venue_k}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-auto block text-center text-xs font-bold py-2.5 rounded-lg border border-violet-500/20 bg-violet-500/10 text-violet-400 hover:bg-violet-500 hover:text-white transition-all duration-150 active:scale-95"
                  >
                    查看場地 →
                  </a>
                </div>
              ))}

            {/* ── 練習壁靜態卡片（永遠顯示）────── */}
            {PRACTICE_WALLS.filter((w) => !selectedDistrict || w.district === selectedDistrict).map((w) => (
              <div
                key={w.venue_k}
                className="group flex flex-col gap-4 rounded-xl p-5 border min-h-[200px] border-sky-500/20 bg-sky-500/5 hover:border-sky-400/40 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold leading-snug text-zinc-100 group-hover:text-white">{w.name}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{w.district}</p>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 whitespace-nowrap">
                    練習壁
                  </span>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  無需預約，隨時可用。沒有找到合適球場時，可前往練習壁暖身 🎾
                </p>
                <a
                  href={`https://vbs.sports.taipei/venues/?K=${w.venue_k}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto block text-center text-xs font-bold py-2.5 rounded-lg border border-sky-500/20 bg-sky-500/10 text-sky-400 hover:bg-sky-500 hover:text-black transition-all duration-150 active:scale-95"
                >
                  查看場地 →
                </a>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── FOOTER ───────────────────────────────────── */}
      <footer className="border-t border-zinc-800/60 py-8 text-center text-xs text-zinc-600">
        資料來源：台北市政府體育局場地租借系統 · 僅供參考，以官網為準
      </footer>
    </div>
  );
}
