"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const BottomNav = () => {
    const pathname = usePathname();
    const isActive = (path: string) => pathname?.startsWith(path);
    return (
        <div className="md:hidden sticky bottom-0 w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 py-3 flex justify-between items-center z-50">
            <Link href="/fridge" className={`flex flex-col items-center gap-1 transition-colors ${isActive('/fridge') ? 'text-primary' : 'text-slate-400 hover:text-primary'}`}>
                <span className="material-symbols-outlined">kitchen</span>
                <span className="text-[10px] font-medium">냉장고</span>
            </Link>
            <Link href="/recipes" className={`flex flex-col items-center gap-1 transition-colors ${isActive('/recipes') ? 'text-primary' : 'text-slate-400 hover:text-primary'}`}>
                <span className="material-symbols-outlined">menu_book</span>
                <span className="text-[10px] font-medium">레시피</span>
            </Link>
            <Link href="/mypage" className={`flex flex-col items-center gap-1 transition-colors ${isActive('/mypage') ? 'text-primary' : 'text-slate-400 hover:text-primary'}`}>
                <span className="material-symbols-outlined">person</span>
                <span className="text-[10px] font-medium">마이</span>
            </Link>
            <Link href="/community" className={`flex flex-col items-center gap-1 transition-colors ${isActive('/community') ? 'text-primary' : 'text-slate-400 hover:text-primary'}`}>
                <span className="material-symbols-outlined">group</span>
                <span className="text-[10px] font-medium">커뮤니티</span>
            </Link>
        </div>
    );
};
