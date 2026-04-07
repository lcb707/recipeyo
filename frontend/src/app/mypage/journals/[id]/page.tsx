'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, Lock, Users, UserCheck, Calendar, ArrowLeft, Loader2, Link as LinkIcon } from 'lucide-react';
import { apiClient as client } from '@/api/client';
import type { CookingJournal } from '@/types';

const VISIBILITY_MAP: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
    public:          { label: '전체 공개',   icon: <Eye size={14} />,       cls: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
    private:         { label: '비공개',      icon: <Lock size={14} />,      cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
    all_groups:      { label: '모든 그룹',   icon: <Users size={14} />,     cls: 'bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400' },
    specific_groups: { label: '특정 그룹',   icon: <UserCheck size={14} />, cls: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
};

export default function JournalDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id;
    const [journal, setJournal] = useState<CookingJournal | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchJournal = async () => {
            if (!id) return;
            try {
                setIsLoading(true);
                const res = await client.get(`/api/v1/community/cooking-journals/${id}/`);
                if (res.data.status === 'success') {
                    setJournal(res.data.data);
                }
            } catch (error) {
                console.error('Failed to fetch journal detail', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchJournal();
    }, [id]);

    if (isLoading) {
        return (
            <div className="flex flex-1 items-center justify-center min-h-[400px]">
                <Loader2 className="animate-spin text-primary" size={40} />
            </div>
        );
    }

    if (!journal) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500">
                <p className="text-xl font-bold mb-4">요리 일지를 찾을 수 없습니다.</p>
                <button onClick={() => router.back()} className="text-primary hover:underline">뒤로 가기</button>
            </div>
        );
    }

    const visInfo = VISIBILITY_MAP[journal.visibility ?? 'private'];

    return (
        <div className="max-w-4xl mx-auto w-full p-6 md:p-10 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100 dark:border-slate-800">
                <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-500 hover:text-primary transition-colors">
                    <ArrowLeft size={20} />
                    <span className="font-bold">목록으로</span>
                </button>
                <div className="flex gap-2">
                    {/* Potential Edit/Delete buttons can go here */}
                </div>
            </div>

            {/* Content Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Left: Image */}
                <div className="rounded-2xl overflow-hidden aspect-square md:aspect-video lg:aspect-square bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800">
                    {journal.image ? (
                        <img 
                            src={journal.image} 
                            alt={journal.title} 
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                            <span className="material-symbols-outlined text-6xl mb-2">image</span>
                            <p>이미지가 없습니다</p>
                        </div>
                    )}
                </div>

                {/* Right: Info */}
                <div className="flex flex-col">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full flex items-center gap-1.5">
                            <Calendar size={12} />
                            {journal.cooked_at}
                        </span>
                        {visInfo && (
                            <span className={`px-3 py-1 text-xs font-bold rounded-full flex items-center gap-1.5 ${visInfo.cls}`}>
                                {visInfo.icon}
                                {visInfo.label}
                            </span>
                        )}
                    </div>

                    <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-6 leading-tight">
                        {journal.title}
                    </h1>

                    <div className="flex flex-wrap gap-2 mb-8">
                        {journal.tags && journal.tags.map((tag, idx) => (
                            <span key={idx} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl">
                                #{tag}
                            </span>
                        ))}
                    </div>

                    {journal.recipe_id && (
                        <Link 
                            href={`/recipes/${journal.recipe_id}`}
                            className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-primary/30 transition-all mb-8 group"
                        >
                            <div className="size-10 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center text-primary shadow-sm">
                                <LinkIcon size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">연결된 레시피</p>
                                <p className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-primary transition-colors">
                                    {journal.recipe_title}
                                </p>
                            </div>
                            <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors">chevron_right</span>
                        </Link>
                    )}

                    <div className="flex-1">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">기록 내용</h3>
                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                            {journal.content}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
