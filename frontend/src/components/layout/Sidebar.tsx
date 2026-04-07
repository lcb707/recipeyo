'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { apiClient as client } from '@/api/client';

export const Sidebar = () => {
    const pathname = usePathname();
    const router = useRouter();
    const { user, loading } = useUser();

    const handleLogout = async () => {
        try {
            await client.post('/api/v1/users/logout/');
        } catch (error) {
            console.error('Logout API failed', error);
        } finally {
            localStorage.removeItem('access');
            localStorage.removeItem('refresh');
            window.location.href = '/login';
        }
    };

    const navItems = [
        { name: '마이 대시보드', href: '/mypage', icon: 'dashboard' },
        { name: '나의 레시피', href: '/mypage/recipes', icon: 'menu_book' },
        { name: '스크랩한 레시피', href: '/mypage/scraps', icon: 'bookmark' },
        { name: '나의 요리 일지', href: '/mypage/journals', icon: 'edit_note' },
        { name: '나의 그룹', href: '/mypage/groups', icon: 'group' },
    ];

    return (
        <aside className="w-full md:w-72 flex flex-col gap-6 shrink-0">
            {/* Profile Card */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex flex-col items-center gap-4 text-center">
                    <div className="relative">
                        {loading ? (
                            <div className="size-24 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse border-4 border-slate-50 dark:border-slate-800 shadow-md"></div>
                        ) : (
                            <div
                                className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-24 border-4 border-slate-50 dark:border-slate-800 shadow-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden"
                                style={user?.profile_image ? { backgroundImage: `url(${user.profile_image})` } : {}}
                            >
                                {!user?.profile_image && <span className="material-symbols-outlined text-4xl text-slate-300">person</span>}
                            </div>
                        )}
                        <Link href="/mypage/profile" className="absolute bottom-0 right-0 bg-primary text-white p-1.5 rounded-full shadow-lg border-2 border-white dark:border-slate-900 hover:scale-110 transition-transform">
                            <span className="material-symbols-outlined text-sm">edit</span>
                        </Link>
                    </div>
                    <div className="w-full">
                        {loading ? (
                            <div className="space-y-2 flex flex-col items-center pt-1">
                                <div className="h-5 w-24 bg-slate-100 dark:bg-slate-800 animate-pulse rounded"></div>
                                <div className="h-4 w-32 bg-slate-100 dark:bg-slate-800 animate-pulse rounded"></div>
                            </div>
                        ) : (
                            <>
                                <p className="text-slate-900 dark:text-white text-xl font-bold mb-1 truncate px-2">{user?.nickname || '방문객'}</p>
                                <p className="text-slate-500 dark:text-slate-400 text-sm truncate px-2">{user?.email || ''}</p>
                            </>
                        )}
                    </div>
                    <Link
                        href="/mypage/profile"
                        className="w-full mt-2 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex justify-center items-center"
                    >
                        회원 정보 수정
                    </Link>
                </div>
            </div>

            {/* Navigation Menu */}
            <nav className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex flex-col gap-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
                                    ? 'bg-primary/10 text-primary font-semibold'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                            >
                                <span className="material-symbols-outlined">{item.icon}</span>
                                <span className="text-sm">{item.name}</span>
                            </Link>
                        );
                    })}

                    <hr className="my-2 border-slate-100 dark:border-slate-800" />

                    <Link
                        href="/mypage/settings"
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${pathname === '/mypage/settings' ? 'bg-primary/10 text-primary font-bold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium'}`}
                    >
                        <span className="material-symbols-outlined" style={pathname === '/mypage/settings' ? { fontVariationSettings: "'FILL' 1" } : {}}>settings</span>
                        <span className="text-sm">설정</span>
                    </Link>

                    <Link
                        href="/support"
                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                        <span className="material-symbols-outlined">support_agent</span>
                        <span className="text-sm">고객센터</span>
                    </Link>

                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
                    >
                        <span className="material-symbols-outlined">logout</span>
                        <span className="text-sm font-bold">로그아웃</span>
                    </button>
                </div>
            </nav>
        </aside>
    );
};
