"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function BottomNav() {
    const pathname = usePathname();

    const navItems = [
        { name: "找場地", href: "/", icon: "🎾" },
        { name: "收藏", href: "/favorites", icon: "❤️" },
        { name: "Sniper", href: "/sniper", icon: "🎯" },
        { name: "我的", href: "/profile", icon: "👤" },
    ];

    return (
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[1080px] bg-[#09090b]/85 backdrop-blur-[16px] border-t border-[#27272a] flex justify-around pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 z-50">
            {navItems.map((item) => {
                const isActive = pathname === item.href;

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            "flex flex-col items-center gap-1 text-[11px] font-medium transition-all duration-200 flex-1",
                            isActive ? "text-[#10b981]" : "text-[#71717a]"
                        )}
                    >
                        <span
                            className={cn(
                                "text-[24px] leading-none transition-transform duration-200 drop-shadow-sm",
                                isActive
                                    ? "-translate-y-[2px] grayscale-0 opacity-100"
                                    : "grayscale opacity-60"
                            )}
                        >
                            {item.icon}
                        </span>
                        <span>{item.name}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
