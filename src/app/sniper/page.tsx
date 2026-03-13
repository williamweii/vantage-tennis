"use client";

import { BellRing, Plus, Trash2, Clock, MapPin, Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

// Mock Data
const ACTIVE_TASKS = [
    {
        id: 1,
        courtName: "臺北市網球中心",
        dates: "Mar 10 - Mar 12",
        timeRange: "18:00 - 22:00",
        isActive: true,
    },
    {
        id: 2,
        courtName: "臺北網球場",
        dates: "Mar 7",
        timeRange: "19:00 - 21:00",
        isActive: false,
    },
];

export default function SniperPage() {
    return (
        <div className="flex flex-col min-h-screen p-4 pb-24">
            <header className="mb-6 mt-2">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <BellRing className="w-6 h-6 text-accent" />
                    Sniper Tasks
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                    Automated monitoring to catch canceled slots immediately.
                </p>
            </header>

            {/* Stats/Status */}
            <div className="flex gap-3 mb-8">
                <div className="flex-1 bg-card border border-border rounded-2xl p-4 flex flex-col justify-center">
                    <span className="text-2xl font-bold text-accent">2</span>
                    <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider mt-1">Active Tasks</span>
                </div>
                <div className="flex-1 bg-card border border-border rounded-2xl p-4 flex flex-col justify-center">
                    <span className="text-2xl font-bold">14</span>
                    <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider mt-1">Total Scans</span>
                </div>
            </div>

            {/* Task List */}
            <section className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold">Your Monitors</h2>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">Pro Limit: 2/5</span>
                </div>

                {ACTIVE_TASKS.map((task) => (
                    <div
                        key={task.id}
                        className={cn(
                            "relative overflow-hidden rounded-3xl border p-5 transition-all duration-300",
                            task.isActive
                                ? "bg-card border-accent/30 shadow-[0_0_20px_rgba(205,244,95,0.05)]"
                                : "bg-muted/30 border-border opacity-70"
                        )}
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="font-bold text-lg mb-1">{task.courtName}</h3>
                                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {task.dates}</span>
                                    <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {task.timeRange}</span>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button className={cn(
                                    "p-2 rounded-full transition-colors",
                                    task.isActive ? "bg-accent/10 text-accent hover:bg-accent/20" : "bg-muted text-foreground hover:bg-border"
                                )}>
                                    {task.isActive ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 ml-0.5" />}
                                </button>
                                <button className="p-2 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-border/50 flex items-center justify-between text-xs font-semibold">
                            <span className={task.isActive ? "text-accent animate-pulse" : "text-muted-foreground"}>
                                {task.isActive ? "● Scanning every 2 mins" : "Paused"}
                            </span>
                        </div>
                    </div>
                ))}

                {/* Add New Task Button */}
                <button className="mt-2 w-full border-2 border-dashed border-border rounded-3xl p-6 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-accent hover:text-accent hover:bg-accent/5 transition-all duration-300">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <Plus className="w-5 h-5" />
                    </div>
                    <span className="font-bold">Create New Sniper Task</span>
                </button>
            </section>
        </div>
    );
}
