"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { getFeedJournals } from '@/api/community';
import { CookingJournal } from '@/types';
import JournalCard from './components/JournalCard';
import { Utensils, Loader2 } from 'lucide-react';

const PAGE_SIZE = 12;

export default function CommunityPage() {
    const [journals, setJournals] = useState<CookingJournal[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);

    const fetchInitialJournals = useCallback(async () => {
        try {
            setLoading(true);
            const res = await getFeedJournals({ page: 1, page_size: PAGE_SIZE });
            if (res.status === 'success') {
                const results = res.data.results || [];
                setJournals(results);
                setHasMore(res.data.next !== null);
                setPage(1);
            }
        } catch (error) {
            console.error('Failed to fetch initial community journals', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchMoreJournals = async () => {
        if (!hasMore || loadingMore) return;
        
        try {
            setLoadingMore(true);
            const nextPage = page + 1;
            const res = await getFeedJournals({ page: nextPage, page_size: PAGE_SIZE });
            if (res.status === 'success') {
                const results = res.data.results || [];
                setJournals(prev => [...prev, ...results]);
                setHasMore(res.data.next !== null);
                setPage(nextPage);
            }
        } catch (error) {
            console.error('Failed to fetch more community journals', error);
        } finally {
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        fetchInitialJournals();
    }, [fetchInitialJournals]);

    return (
        <div className="w-full">
            <div className="mb-8 p-6 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl text-white shadow-lg flex flex-col items-start">
                <h1 className="text-3xl font-black mb-2">커뮤니티 피드</h1>
                <p className="text-green-50 font-medium">우리 동네 레시피 달인들의 맛있는 일상을 구경해보세요.</p>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <Loader2 className="animate-spin mb-4" size={40} />
                    <p className="font-semibold">피드를 불러오고 있습니다...</p>
                </div>
            ) : journals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 shadow-sm">
                    <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                        <Utensils size={36} className="text-slate-400" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                        아직 올라온 요리 일지가 없어요.
                    </h3>
                    <p className="text-slate-500">
                        첫 번째 요리 일지를 작성하여 모두와 공유해 보세요!
                    </p>
                </div>
            ) : (
                <div className="flex flex-col pb-20">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {journals.map((journal) => (
                            <JournalCard key={journal.id} journal={journal} />
                        ))}
                    </div>
                    
                    {hasMore && (
                        <div className="mt-12 flex justify-center">
                            <button 
                                onClick={fetchMoreJournals}
                                disabled={loadingMore}
                                className="px-8 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full font-bold text-slate-700 dark:text-slate-300 hover:text-primary hover:border-primary/50 hover:bg-primary/5 shadow-sm transition-all disabled:opacity-70 flex items-center gap-2"
                            >
                                {loadingMore ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin text-primary" />
                                        <span>불러오는 중...</span>
                                    </>
                                ) : (
                                    <span>더 보기</span>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
