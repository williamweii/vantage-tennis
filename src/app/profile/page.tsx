"use client";

import { User, Settings, Crown, LogOut, CheckCircle2 } from "lucide-react";

export default function ProfilePage() {
    return (
        <div className="flex flex-col min-h-screen p-4 pb-24">
            <header className="mb-8 mt-2 flex justify-between items-center">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <User className="w-6 h-6 text-accent" />
                    Profile
                </h1>
                <button className="p-2 rounded-full hover:bg-muted transition-colors">
                    <Settings className="w-5 h-5" />
                </button>
            </header>

            {/* User Info */}
            <section className="flex flex-col items-center justify-center py-6 mb-8">
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-accent to-accent/20 flex items-center justify-center mb-4 border-4 border-background shadow-[0_0_20px_rgba(205,244,95,0.2)]">
                    <span className="text-3xl font-bold text-accent-foreground">VT</span>
                </div>
                <h2 className="text-xl font-bold mb-1">Tennis Player</h2>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Crown className="w-4 h-4 text-accent" /> Pro Member
                </p>
            </section>

            {/* Integrations */}
            <section className="mb-8">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-2">Integrations</h3>

                <div className="bg-card border border-border rounded-3xl p-2 relative overflow-hidden">
                    <div className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#06C755] flex items-center justify-center text-white font-bold text-xl">
                                L
                            </div>
                            <div>
                                <h4 className="font-bold">LINE Notify</h4>
                                <p className="text-xs text-muted-foreground">Connected for real-time sniper alerts</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 text-accent font-semibold text-sm">
                            <CheckCircle2 className="w-4 h-4" /> Connected
                        </div>
                    </div>
                </div>
            </section>

            {/* Subscription */}
            <section className="mb-8">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-2">Subscription</h3>

                <div className="bg-gradient-to-br from-[#1e1e1e] to-[#121212] border border-accent/20 rounded-3xl p-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 rounded-full blur-3xl -mr-10 -mt-10" />
                    <div className="relative z-10">
                        <h4 className="text-lg font-bold text-accent flex items-center gap-2 mb-2">
                            <Crown className="w-5 h-5 fill-current" /> Pro Plan
                        </h4>
                        <p className="text-sm text-muted-foreground mb-4">
                            You have access to unlimited sniper tasks and instant push notifications.
                        </p>
                        <button className="text-sm font-semibold bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl transition-colors w-full">
                            Manage Subscription
                        </button>
                    </div>
                </div>
            </section>

            {/* Actions */}
            <section className="mt-auto">
                <button className="w-full flex justify-center items-center gap-2 p-4 rounded-2xl text-destructive font-bold hover:bg-destructive/10 transition-colors">
                    <LogOut className="w-4 h-4" /> Log Out
                </button>
            </section>
        </div>
    );
}
