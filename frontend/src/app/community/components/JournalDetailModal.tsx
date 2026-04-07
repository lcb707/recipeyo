"use client";

import React, { useEffect, useState } from 'react';
import { getCookingJournal, getJournalComments } from '@/api/community';
import { CookingJournal, Comment } from '@/types';
import Link from 'next/link';

interface Props {
    journalId: number;
    onClose: () => void;
}

export default function JournalDetailModal({ journalId, onClose }: Props) {
    const [journal, setJournal] = useState<CookingJournal | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                setLoading(true);
                const [journalRes, commentsRes] = await Promise.all([
                    getCookingJournal(journalId),
                    getJournalComments(journalId).catch(() => ({ status: 'error', data: [] })) // Mock or ignore error if comments fail
                ]);

                if (journalRes.status === 'success') {
                    setJournal(journalRes.data);
                }
                if (commentsRes.status === 'success') {
                    const cData = commentsRes.data as any;
                    setComments(Array.isArray(cData) ? cData : (cData?.results || []));
                }
            } catch (error) {
                console.error("Failed to load journal details", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [journalId]);

    if (loading || !journal) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-white dark:bg-slate-900 p-8 rounded-xl">
                    <p>로딩 중...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
                
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="bg-slate-200 dark:bg-slate-800 rounded-full size-12 flex items-center justify-center shrink-0 border-2 border-primary/20 text-slate-400">
                            <span className="material-symbols-outlined">person</span>
                        </div>
                        <div className="flex flex-col">
                            <h3 className="text-slate-900 dark:text-white font-bold text-base leading-none">
                                {journal.user_identifier.substring(0, 8)}
                            </h3>
                            <p className="text-slate-500 text-xs mt-1">@user_{journal.user_identifier.substring(0, 4)}</p>
                        </div>
                        <button className="ml-4 px-4 py-1.5 bg-primary text-white text-xs font-bold rounded-full hover:bg-primary/90 transition-colors">팔로우</button>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-2">
                        
                        <div className="relative bg-slate-100 dark:bg-slate-800 aspect-square lg:aspect-auto h-full min-h-[400px]">
                            {journal.image && (
                                <img 
                                    className="w-full h-full object-cover" 
                                    src={journal.image.startsWith('http') ? journal.image : process.env.NEXT_PUBLIC_API_URL + '/media/' + journal.image} 
                                    alt={journal.title} 
                                />
                            )}
                        </div>

                        <div className="p-6 lg:p-8 flex flex-col">
                            <div className="mb-2">
                                <span className="text-primary text-xs font-bold bg-primary/10 px-2 py-1 rounded-md uppercase tracking-wider">Cooking Journal</span>
                            </div>
                            <h2 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white mb-4 leading-tight">
                                {journal.title}
                            </h2>
                            <div className="flex flex-wrap items-center gap-y-2 gap-x-4 mb-6 text-sm text-slate-500">
                                <div className="flex items-center gap-1">
                                    <span className="material-symbols-outlined text-base">calendar_today</span>
                                    <span>{String(journal.cooked_at).substring(0, 10)} 조리</span>
                                </div>
                                {journal.recipe_id && (
                                    <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                                        <span className="material-symbols-outlined text-base text-primary">link</span>
                                        <span className="font-medium text-slate-700 dark:text-slate-300">연동 레시피: </span>
                                        <Link href={`/recipes/${journal.recipe_id}`} className="text-primary hover:underline font-bold">
                                            {journal.recipe_title}
                                        </Link>
                                    </div>
                                )}
                            </div>
                            
                            <div className="prose prose-slate dark:prose-invert mb-8">
                                <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                    {journal.content}
                                </p>
                            </div>
                            
                            {journal.tags && journal.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-8">
                                    {journal.tags.map((tag, idx) => (
                                        <span key={idx} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full text-xs font-medium">
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            )}

                            <div className="flex items-center gap-6 py-4 border-t border-slate-100 dark:border-slate-800">
                                <span className="flex items-center gap-2 group text-slate-500">
                                    <span className="material-symbols-outlined text-slate-400 transition-colors">chat_bubble</span>
                                    <span className="text-sm font-bold text-slate-600 dark:text-slate-400">{comments.length}</span>
                                </span>
                                <button className="flex items-center gap-2 group ml-auto">
                                    <span className="material-symbols-outlined text-slate-400 group-hover:text-slate-600 transition-colors">share</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 lg:p-8 border-t border-slate-100 dark:border-slate-800">
                        <h4 className="text-slate-900 dark:text-white font-bold mb-6">댓글 ({comments.length})</h4>
                        <div className="space-y-6 mb-8">
                            {comments.map((comment) => (
                                <div key={comment.id} className="flex gap-4">
                                    <div className="bg-slate-200 dark:bg-slate-700 rounded-full size-10 shrink-0 flex items-center justify-center text-slate-400">
                                        <span className="material-symbols-outlined text-sm">person</span>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-bold text-sm text-slate-900 dark:text-white">{comment.user_nickname || '유저'}</span>
                                            <span className="text-xs text-slate-500">{String(comment.created_at).substring(0, 10)}</span>
                                        </div>
                                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-normal">{comment.content}</p>
                                        <div className="mt-2 flex items-center gap-3">
                                            <button className="text-xs font-bold text-slate-500 hover:text-primary">답글 달기</button>
                                            <button className="text-xs font-bold text-slate-500 hover:text-red-400">좋아요</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {comments.length === 0 && (
                                <p className="text-slate-500 text-sm">첫 번째 댓글을 남겨보세요.</p>
                            )}
                        </div>
                    </div>

                    <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky bottom-0">
                        <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 rounded-full px-4 py-2 focus-within:ring-2 focus-within:ring-primary/50 transition-all">
                            <div className="bg-slate-200 dark:bg-slate-700 rounded-full size-8 shrink-0 flex items-center justify-center text-slate-400">
                                <span className="material-symbols-outlined text-xs">person</span>
                            </div>
                            <input className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-slate-900 dark:text-white placeholder:text-slate-500" placeholder="댓글을 남겨주세요..." type="text" />
                            <button className="text-primary font-bold text-sm px-2 hover:opacity-80 transition-opacity">게시</button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
