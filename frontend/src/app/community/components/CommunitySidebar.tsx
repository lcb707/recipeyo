"use client";

import React from 'react';

export default function CommunitySidebar() {
    return (
        <aside className="hidden md:flex flex-col w-80 gap-6">
            <button className="w-full bg-primary text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform">
                <span className="material-symbols-outlined">edit_square</span>
                요리 일지 작성하기
            </button>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">trending_up</span>
                    인기 해시태그
                </h4>
                <div className="flex flex-col gap-3">
                    <a className="flex items-center justify-between group cursor-pointer">
                        <span className="text-sm text-slate-600 dark:text-slate-400 group-hover:text-primary transition-colors">#집밥의정석</span>
                        <span className="text-xs text-slate-400 font-medium">1.2k</span>
                    </a>
                    <a className="flex items-center justify-between group cursor-pointer">
                        <span className="text-sm text-slate-600 dark:text-slate-400 group-hover:text-primary transition-colors">#다이어트식단</span>
                        <span className="text-xs text-slate-400 font-medium">940</span>
                    </a>
                    <a className="flex items-center justify-between group cursor-pointer">
                        <span className="text-sm text-slate-600 dark:text-slate-400 group-hover:text-primary transition-colors">#원팬요리</span>
                        <span className="text-xs text-slate-400 font-medium">856</span>
                    </a>
                    <a className="flex items-center justify-between group cursor-pointer">
                        <span className="text-sm text-slate-600 dark:text-slate-400 group-hover:text-primary transition-colors">#자취일기</span>
                        <span className="text-xs text-slate-400 font-medium">720</span>
                    </a>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">stars</span>
                    이 주의 베스트 요리사
                </h4>
                <div className="flex flex-col gap-5">
                    {[
                        { name: '베이킹마스터', followers: '2.5k' },
                        { name: '자연주의 식탁', followers: '1.8k' },
                        { name: '심야식당 요한', followers: '3.1k' },
                    ].map((chef, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <div className="size-10 rounded-full bg-cover bg-center bg-slate-200 border border-slate-100"></div>
                            <div className="flex-1">
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{chef.name}</p>
                                <p className="text-xs text-slate-500">팔로워 {chef.followers}</p>
                            </div>
                            <button className="text-primary text-xs font-bold px-3 py-1.5 bg-primary/10 rounded-lg hover:bg-primary hover:text-white transition-all">팔로우</button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="px-2 flex flex-wrap gap-x-4 gap-y-2">
                <a className="text-[11px] text-slate-400 hover:underline cursor-pointer">서비스 이용약관</a>
                <a className="text-[11px] text-slate-400 hover:underline cursor-pointer">개인정보 처리방침</a>
                <a className="text-[11px] text-slate-400 hover:underline cursor-pointer">도움말</a>
                <p className="text-[11px] text-slate-300 w-full mt-2">© 2024 Recipio. All rights reserved.</p>
            </div>
        </aside>
    );
}
