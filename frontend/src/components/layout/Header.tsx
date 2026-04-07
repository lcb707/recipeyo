"use client";

import React, { useState, KeyboardEvent } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';

export const Header = () => {
    const pathname = usePathname();
    const router = useRouter();
    const { user } = useUser();
    const isActive = (path: string) => pathname?.startsWith(path);

    const [searchQuery, setSearchQuery] = useState('');

    const handleSearch = () => {
        const q = searchQuery.trim();
        if (!q) return;
        router.push(`/recipes?search=${encodeURIComponent(q)}`);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') handleSearch();
    };

    // Hide header on login/register pages
    if (pathname === '/login' || pathname === '/register') return null;

    return (
        <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3 lg:px-20 sticky top-0 z-50">
            <div className="flex items-center gap-8">
                <Link href="/" className="flex items-center gap-3 text-primary">
                    <div className="size-6">
                        <svg fill="currentColor" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                            <path d="M6 6H42L36 24L42 42H6L12 24L6 6Z"></path>
                        </svg>
                    </div>
                    <h2 className="text-slate-900 dark:text-white text-xl font-bold leading-tight tracking-tight">Recipio</h2>
                </Link>
                {pathname !== '/recipes' && (
                    <label className="hidden md:flex flex-col min-w-40 h-10 max-w-64">
                        <div className="flex w-full flex-1 items-stretch rounded-xl h-full">
                            <button
                                onClick={handleSearch}
                                className="text-slate-400 flex border-none bg-slate-100 dark:bg-slate-800 items-center justify-center pl-4 rounded-l-xl hover:text-primary transition-colors"
                                aria-label="레시피 검색"
                            >
                                <span className="material-symbols-outlined text-xl">search</span>
                            </button>
                            <input
                                className="form-input flex w-full min-w-0 flex-1 border-none bg-slate-100 dark:bg-slate-800 focus:ring-0 h-full placeholder:text-slate-400 px-4 rounded-r-xl text-sm font-normal outline-none"
                                placeholder="레시피 검색"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={handleKeyDown}
                            />
                        </div>
                    </label>
                )}
            </div>

            <div className="flex flex-1 justify-end gap-8 items-center">
                <nav className="hidden md:flex items-center gap-8">
                    <Link href="/fridge" className={`text-sm font-semibold transition-colors ${isActive('/fridge') ? 'text-primary' : 'text-slate-600 dark:text-slate-300 hover:text-primary'}`}>냉장고</Link>
                    <Link href="/fridge-clearout" className={`text-sm font-bold transition-all px-3 py-1.5 rounded-lg ${isActive('/fridge-clearout') ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' : 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'}`}>냉장고 파먹기</Link>
                    <Link href="/recipes" className={`text-sm font-semibold transition-colors ${isActive('/recipes') ? 'text-primary' : 'text-slate-600 dark:text-slate-300 hover:text-primary'}`}>레시피</Link>
                    <Link href="/community" className={`text-sm font-semibold transition-colors ${isActive('/community') ? 'text-primary' : 'text-slate-600 dark:text-slate-300 hover:text-primary'}`}>커뮤니티</Link>
                </nav>
                <Link href="/mypage" className="bg-primary/10 p-0.5 rounded-full ring-2 ring-primary/20 cursor-pointer hover:ring-primary/40 transition-all focus:outline-none">
                    <div
                        className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-9 bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden"
                        style={user?.profile_image ? { backgroundImage: `url(${user.profile_image})` } : {}}
                    >
                        {!user?.profile_image && <span className="material-symbols-outlined text-xl text-slate-400">person</span>}
                    </div>
                </Link>
            </div>
        </header>
    );
};
