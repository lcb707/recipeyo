"use client";

import React from 'react';
import { CookingJournal } from '@/types';
import Link from 'next/link';
import { User, Clock, Globe, Lock, Users } from 'lucide-react';
import Image from 'next/image';

interface Props {
    journal: CookingJournal;
}

export default function JournalCard({ journal }: Props) {
    // 공개 범위 뱃지 설정
    const renderVisibilityBadge = () => {
        switch (journal.visibility) {
            case 'public':
                return (
                    <div className="flex items-center gap-1 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide">
                        <Globe size={10} /> 전체공개
                    </div>
                );
            case 'private':
                return (
                    <div className="flex items-center gap-1 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide">
                        <Lock size={10} /> 나만보기
                    </div>
                );
            case 'all_groups':
            case 'specific_groups':
                return (
                    <div className="flex items-center gap-1 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide">
                        <Users size={10} /> 그룹공개
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <Link 
            href={`/community/journals/${journal.id}`}
            className="group flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-md hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-300 hover:-translate-y-1 block"
        >
            {/* 작성자 & 메타 정보 (Header) */}
            <div className="p-5 pb-3 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0 border border-slate-200 dark:border-slate-700 overflow-hidden relative">
                            <User size={20} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                {journal.user_identifier.substring(0, 8)}
                            </p>
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                <Clock size={12} />
                                <span>{String(journal.created_at).substring(0, 10)}</span>
                            </div>
                        </div>
                    </div>
                    {renderVisibilityBadge()}
                </div>
            </div>

            {/* 본문 썸네일 */}
            {journal.image && (
                <div className="relative w-full aspect-[4/3] bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <img 
                        src={journal.image.startsWith('http') ? journal.image : (process.env.NEXT_PUBLIC_API_URL || '') + '/media/' + journal.image} 
                        alt="Journal thumbnail"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                </div>
            )}

            {/* 카드 본문 내용 */}
            <div className="p-5 pt-4 flex flex-col gap-3 flex-1">
                <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 leading-tight group-hover:text-primary transition-colors">
                    {journal.title}
                </h3>
                
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed line-clamp-3">
                    {journal.content}
                </p>

                {/* 태그 목록 */}
                {journal.tags && journal.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                        {journal.tags.map((tag, i) => (
                            <span key={i} className="text-xs font-semibold text-primary/80 dark:text-primary/60 hover:text-primary transition-colors">
                                #{tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>
            
            {/* 연결된 레시피 (하단 푸터) */}
            {journal.recipe_id && (
                <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between group/recipe">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <span className="material-symbols-outlined text-[18px] text-primary shrink-0">restaurant_menu</span>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate group-hover/recipe:text-primary transition-colors">
                            {journal.recipe_title}
                        </p>
                    </div>
                </div>
            )}
        </Link>
    );
}
