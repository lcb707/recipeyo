"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCookingJournal, getJournalComments } from '@/api/community';
import { CookingJournal, Comment } from '@/types';
import Link from 'next/link';
import Image from 'next/image';
import { Header } from '@/components/layout/Header';
import { ArrowLeft, MessageSquare, Share2, Calendar, User, Clock, Link as LinkIcon } from 'lucide-react';

export default function JournalDetailPage() {
    const params = useParams();
    const router = useRouter();
    const journalId = parseInt(params.id as string);

    const [journal, setJournal] = useState<CookingJournal | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!journalId || isNaN(journalId)) return;

        const fetchDetails = async () => {
            try {
                setLoading(true);
                const [journalRes, commentsRes] = await Promise.all([
                    getCookingJournal(journalId),
                    getJournalComments(journalId).catch(() => ({ status: 'error', data: [] }))
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

    if (loading) {
        return (
            <div className="flex flex-col min-h-screen bg-transparent font-display">
                <div className="flex-1 flex items-center justify-center">
                    <span className="material-symbols-outlined animate-spin text-primary text-5xl">progress_activity</span>
                </div>
            </div>
        );
    }

    if (!journal) {
        return (
            <div className="flex flex-col min-h-screen bg-transparent font-display">
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2">일지를 찾을 수 없습니다</h2>
                    <p className="text-slate-500 mb-6">요청하신 요리 일지가 존재하지 않거나 삭제되었습니다.</p>
                    <button onClick={() => router.back()} className="px-6 py-2 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-colors">
                        이전으로 돌아가기
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-transparent font-display">
            <main className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 py-8">
                {/* Back button */}
                <button 
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors mb-6 group ml-2"
                >
                    <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="text-sm font-bold">목록으로 돌아가기</span>
                </button>

                <article className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-slate-100">
                    
                    {/* Header Image (Top) - Full Width & Adjusted Aspect */}
                    {journal.image && (
                        <div className="relative w-full aspect-[21/6] overflow-hidden">
                            <img 
                                src={journal.image.startsWith('http') ? journal.image : (process.env.NEXT_PUBLIC_API_URL || '') + '/media/' + journal.image} 
                                alt={journal.title} 
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                        </div>
                    )}

                    <div className="px-6 md:px-10 lg:px-14 py-12">
                        {/* Meta Info & Author - Simplified & Wide */}
                        <div className="flex flex-wrap items-center justify-between gap-6 mb-10 pb-8 border-b border-slate-50 dark:border-slate-800/50">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0 border border-slate-200 dark:border-slate-700">
                                    <User size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-slate-100">
                                        @{journal.user_identifier.substring(0, 8)}
                                    </h3>
                                    <p className="text-slate-400 text-xs font-semibold mt-0.5">
                                        {String(journal.created_at).substring(0, 10)}
                                    </p>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-4">
                                <button className="flex items-center gap-2 text-slate-400 hover:text-primary transition-colors text-sm font-bold">
                                    <Share2 size={18} />
                                    <span>공유하기</span>
                                </button>
                                <button className="px-6 py-2 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-all text-sm shadow-lg shadow-primary/20">
                                    팔로우
                                </button>
                            </div>
                        </div>

                        {/* Article Content - Grid Layout to fill width better on large screens */}
                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
                            <div className="xl:col-span-8">
                                <h1 className="text-3xl md:text-5xl lg:text-6xl font-black mb-8 leading-tight tracking-tight text-slate-900 dark:text-white">
                                    {journal.title}
                                </h1>
                                
                                <div className="flex items-center gap-2 mb-10 text-xs font-black text-primary bg-primary/5 px-3 py-1.5 rounded-full border border-primary/10 max-w-fit uppercase tracking-widest">
                                    <span className="material-symbols-outlined text-sm">restaurant</span>
                                    <span>{String(journal.cooked_at).substring(0, 10)} Cooked</span>
                                </div>

                                {/* Main Body Text - Truly full width within its column */}
                                <div className="prose prose-slate dark:prose-invert max-w-none mb-12">
                                    <p className="text-lg md:text-xl text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap font-medium">
                                        {journal.content}
                                    </p>
                                </div>
                                
                                {/* Tags */}
                                {journal.tags && journal.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-8 border-t border-slate-50 dark:border-slate-800/50">
                                        {journal.tags.map((tag, idx) => (
                                            <span key={idx} className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 rounded-lg text-xs font-bold border border-slate-100 dark:border-slate-700 hover:border-primary/30 hover:text-primary transition-all cursor-pointer">
                                                #{tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Sidebar Area for Wider Look on XL screens */}
                            <div className="xl:col-span-4 flex flex-col gap-8">
                                {/* Connected Recipe Card in Sidebar */}
                                {journal.recipe_id && (
                                    <Link 
                                        href={`/recipes/${journal.recipe_id}`}
                                        className="group block p-6 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-200 dark:border-slate-700 hover:border-primary/40 hover:bg-white dark:hover:bg-slate-800 transition-all relative overflow-hidden"
                                    >
                                        <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-4 px-1">Recipe Link</p>
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center text-primary shrink-0 shadow-sm border border-slate-100 dark:border-slate-700">
                                                <LinkIcon size={20} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-black text-lg text-slate-800 dark:text-slate-100 group-hover:text-primary transition-colors truncate">
                                                    {journal.recipe_title}
                                                </p>
                                            </div>
                                            <ArrowLeft size={20} className="rotate-180 text-slate-300 group-hover:text-primary transition-colors" />
                                        </div>
                                    </Link>
                                )}

                                {/* Informational Box (Placeholder/Decorative) */}
                                <div className="p-6 rounded-3xl bg-primary/5 border border-primary/10">
                                    <h5 className="text-sm font-black text-primary mb-3">Cooking Tip</h5>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                        이 일지의 작성자 @{journal.user_identifier.substring(0, 8)} 님에게 궁금한 점이 있다면 댓글로 남겨보세요!
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Comments Section - Full Width */}
                    <div className="bg-slate-50 dark:bg-slate-800/20 px-6 md:px-10 lg:px-14 py-16 border-t border-slate-100 dark:border-slate-800">
                        <div className="w-full">
                            <h4 className="font-black text-2xl mb-10 flex items-center gap-3 text-slate-800 dark:text-slate-100">
                                <MessageSquare size={24} className="text-primary" />
                                댓글 <span className="text-primary">{comments.length}</span>
                            </h4>
                            
                            <div className="space-y-6 mb-12">
                                {comments.length === 0 ? (
                                    <div className="py-12 text-center text-slate-500 bg-white dark:bg-slate-900 rounded-[2rem] border border-dashed border-slate-200 dark:border-slate-700">
                                        <p className="font-bold text-slate-400 uppercase text-xs tracking-widest">No comments yet</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {comments.map((comment) => (
                                            <div key={comment.id} className="flex gap-4">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 shrink-0 flex items-center justify-center text-slate-400 border border-slate-200 dark:border-slate-700">
                                                    <User size={20} />
                                                </div>
                                                <div className="flex-1 bg-white dark:bg-slate-900 p-6 rounded-[1.5rem] rounded-tl-none border border-slate-100 dark:border-slate-800 shadow-sm relative">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="font-black text-sm text-slate-800 dark:text-slate-200">{comment.user_nickname || 'Anonymous'}</span>
                                                        <span className="text-[10px] text-slate-400 font-bold">{String(comment.created_at).substring(0, 10)}</span>
                                                    </div>
                                                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{comment.content}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Comment Input */}
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-primary/10 shrink-0 flex items-center justify-center text-primary border border-primary/10">
                                    <User size={20} />
                                </div>
                                <div className="flex-1 relative group">
                                    <textarea 
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 pr-24 text-sm focus:ring-4 focus:ring-primary/10 focus:border-primary/30 outline-none resize-none min-h-[100px] transition-all" 
                                        placeholder="Add a comment..."
                                    ></textarea>
                                    <button className="absolute bottom-4 right-4 px-6 py-2.5 bg-primary text-white text-xs font-black rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
                                        등록
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </article>
            </main>
        </div>
    );
}
