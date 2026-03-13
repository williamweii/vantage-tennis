"use client";

import { useState } from "react";
import { ChevronLeft, MapPin, Clock, Crosshair, ExternalLink, Calendar as CalendarIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useParams } from "next/navigation";

// Mock data
const COURT_DETAILS = {
    1: { name: "臺北市網球中心", tags: ["Indoor", "Hard"], address: "台北市內湖區民權東路六段208號" },
    2: { name: "臺北網球場", tags: ["Outdoor", "Hard"], address: "台北市松山區南京東路四段10號" },
    3: { name: "臺北市政府體育局場地", tags: ["Outdoor", "Clay"], address: "各區河濱公園" },
};

const MOCK_SLOTS = [
    { time: "08:00", status: "booked" },
    { time: "09:00", status: "booked" },
    { time: "10:00", status: "available" },
    { time: "11:00", status: "booked" },
    { time: "12:00", status: "rangeout" },
    { time: "13:00", status: "available" },
    { time: "14:00", status: "booked" },
    { time: "15:00", status: "available" },
    { time: "16:00", status: "booked" },
    { time: "17:00", status: "booked" },
    { time: "18:00", status: "booked" },
    { time: "19:00", status: "booked" },
    { time: "20:00", status: "booked" },
    { time: "21:00", status: "booked" },
];

export default function CourtDetailPage() {
    const params = useParams();
    const id = Number(params.id) || 1;
    const court = COURT_DETAILS[id as keyof typeof COURT_DETAILS] || COURT_DETAILS[1];

    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

    return (
        <div className="flex flex-col min-h-screen pb-20">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
                <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div className="font-bold flex-1 truncate">{court.name}</div>
            </div>

            <div className="p-4 flex flex-col gap-6">
                {/* Court Info */}
                <section>
                    <div className="flex flex-wrap gap-2 mb-3">
                        {court.tags.map(t => (
                            <span key={t} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                                {t}
                            </span>
                        ))}
                    </div>
                    <div className="flex items-start gap-2 text-muted-foreground text-sm">
                        <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                        <p>{court.address}</p>
                    </div>
                </section>

                {/* Selected Date indicator */}
                <section className="flex items-center justify-between p-3 rounded-2xl border border-border bg-card">
                    <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-accent" />
                        <span className="font-medium text-sm">Tomorrow, Mar 6</span>
                    </div>
                    <span className="text-xs font-bold text-accent px-2 py-1 rounded-full bg-accent/10">3 Slots</span>
                </section>

                {/* Timeslots */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold">Availability</h2>
                        <div className="flex gap-3 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-accent" /> Open</span>
                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-muted-foreground/30" /> Full</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                        {MOCK_SLOTS.map((slot) => {
                            const isAvailable = slot.status === "available";
                            const isSelected = selectedSlot === slot.time;

                            return (
                                <button
                                    key={slot.time}
                                    disabled={!isAvailable}
                                    onClick={() => setSelectedSlot(slot.time)}
                                    className={cn(
                                        "flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-200",
                                        isAvailable
                                            ? isSelected
                                                ? "bg-accent text-accent-foreground border-accent shadow-[0_0_15px_rgba(205,244,95,0.4)] scale-105"
                                                : "bg-card border-accent/40 text-foreground hover:border-accent"
                                            : "bg-muted/50 border-transparent text-muted-foreground/40 opacity-50 cursor-not-allowed"
                                    )}
                                >
                                    <span className="text-sm font-bold">{slot.time}</span>
                                </button>
                            );
                        })}
                    </div>
                </section>
            </div>

            {/* Floating Action Area */}
            <div className="fixed bottom-16 left-0 w-full p-4 bg-gradient-to-t from-background via-background to-transparent pt-10 pointer-events-none">
                <div className="pointer-events-auto flex gap-3 max-w-md mx-auto">
                    {selectedSlot ? (
                        <button className="flex-1 bg-foreground text-background font-bold py-4 rounded-full flex items-center justify-center gap-2 hover:bg-foreground/90 transition-all shadow-lg active:scale-95">
                            <span>Book {selectedSlot}</span>
                            <ExternalLink className="w-4 h-4" />
                        </button>
                    ) : (
                        <button className="flex-1 bg-accent text-accent-foreground font-bold py-4 rounded-full flex items-center justify-center gap-2 hover:brightness-110 transition-all shadow-[0_0_20px_rgba(205,244,95,0.2)] active:scale-95">
                            <Crosshair className="w-4 h-4" />
                            <span>Snipe this day</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
