'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, Lock, Users, UserCheck, Trash2, NotebookPen, Loader2 } from 'lucide-react';
import { getMyJournals } from '@/api/community';
import { apiClient as client } from '@/api/client';
import type { CookingJournal } from '@/types';
import ConfirmModal from '@/components/ConfirmModal';

const VISIBILITY_MAP: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
    public:          { label: '전체 공개',   icon: <Eye size={10} />,       cls: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
    private:         { label: '비공개',      icon: <Lock size={10} />,      cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
    all_groups:      { label: '모든 그룹',   icon: <Users size={10} />,     cls: 'bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400' },
    specific_groups: { label: '특정 그룹',   icon: <UserCheck size={10} />, cls: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
};

export default function JournalsPage() {
    const router = useRouter();
    const [journals, setJournals] = useState<CookingJournal[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Confirm Delete Modal
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchJournals = async () => {
        try {
            setIsLoading(true);
            const res = await getMyJournals();
            if (res.status === 'success') {
                setJournals(res.data.results || []);
            }
        } catch (error) {
            console.error('Failed to load journals', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchJournals();
    }, []);

    const handleDeleteClick = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        setDeletingId(id);
        setIsConfirmOpen(true);
    };

    const confirmDelete = async () => {
        if (!deletingId) return;
        try {
            setIsDeleting(true);
            await client.delete(`/api/v1/community/cooking-journals/${deletingId}/`);
            setIsConfirmOpen(false);
            setDeletingId(null);
            fetchJournals();
        } catch (error) {
            console.error('Failed to delete journal', error);
            alert('삭제에 실패했습니다. 다시 시도해주세요.');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 p-6 md:p-10 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex-1">
            {/* Breadcrumbs */}
            <nav className="flex items-center gap-2 mb-6 text-sm">
                <Link href="/mypage" className="text-slate-500 hover:text-primary transition-colors flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                    마이페이지
                </Link>
                <span className="text-slate-300">/</span>
                <span className="text-slate-900 dark:text-white font-semibold">나의 요리 일지</span>
            </nav>

            {/* Title Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">나의 요리 일지</h2>
                    <p className="text-slate-500 dark:text-slate-400">내가 직접 만든 요리들의 기록입니다.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => router.push('/mypage/journals/new')}
                        className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 hover:-translate-y-0.5 transition-all"
                    >
                        <NotebookPen size={18} />
                        새 일지 작성
                    </button>
                </div>
            </div>

            {/* Journals Grid */}
            {isLoading ? (
                <div className="flex justify-center items-center py-20 gap-3 text-slate-400">
                    <Loader2 className="animate-spin text-primary" size={32} />
                </div>
            ) : journals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 border-dashed">
                    <span className="material-symbols-outlined text-6xl mb-4 text-slate-300">history_edu</span>
                    <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-2">아직 작성된 일지가 없어요</h3>
                    <p className="text-slate-500 mb-6">첫 번째 요리 기록을 남겨보세요!</p>
                    <button
                        onClick={() => router.push('/mypage/journals/new')}
                        className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-colors"
                    >
                        새 일지 작성하러 가기
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {journals.map((journal) => {
                        const visInfo = VISIBILITY_MAP[journal.visibility ?? 'private'];
                        return (
                            <div
                                key={journal.id}
                                className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 group hover:border-primary/50 hover:shadow-md transition-all cursor-pointer flex flex-col"
                                onClick={() => router.push(`/mypage/journals/${journal.id}`)}
                            >
                                {/* Image or Placeholder */}
                                <div className="relative aspect-video w-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                    {journal.image ? (
                                        <div
                                            className="absolute inset-0 bg-center bg-cover transition-transform duration-500 group-hover:scale-105"
                                            style={{ backgroundImage: `url("${journal.image}")` }}
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center text-slate-300">
                                            <span className="material-symbols-outlined text-4xl">image</span>
                                        </div>
                                    )}

                                    {/* Delete button (top-right) */}
                                    <div className="absolute top-3 right-3 flex gap-1">
                                        <button
                                            onClick={(e) => handleDeleteClick(e, journal.id)}
                                            className="size-8 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur shadow-sm flex items-center justify-center text-slate-500 hover:text-red-500 hover:bg-white transition-colors"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>

                                    {/* Cooked date + visibility badge (bottom-left) */}
                                    <div className="absolute bottom-3 left-3 flex gap-2">
                                        <span className="px-2 py-1 bg-black/60 backdrop-blur text-white text-xs font-medium rounded-lg flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                                            {journal.cooked_at}
                                        </span>
                                        {visInfo && (
                                            <span className={`px-2 py-1 text-[10px] font-bold rounded-lg flex items-center gap-1 ${visInfo.cls}`}>
                                                {visInfo.icon}
                                                {visInfo.label}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="p-5 flex flex-col flex-1">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 group-hover:text-primary transition-colors line-clamp-1">
                                        {journal.title}
                                    </h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-4 flex-1">
                                        {journal.content}
                                    </p>

                                    {journal.tags && journal.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mb-4">
                                            {journal.tags.map((tag: string, idx: number) => (
                                                <span key={idx} className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-md">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                                        {journal.recipe_id ? (
                                            <div
                                                className="flex items-center gap-2 text-sm text-slate-500 hover:text-primary transition-colors cursor-pointer"
                                                onClick={(e) => { e.stopPropagation(); router.push(`/recipes/${journal.recipe_id}`); }}
                                            >
                                                <span className="material-symbols-outlined text-base">link</span>
                                                <span className="font-medium truncate">{journal.recipe_title}</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-sm text-slate-400">
                                                <span className="material-symbols-outlined text-base">link_off</span>
                                                <span>연결된 레시피 없음</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Confirm Delete Modal */}
            <ConfirmModal
                isOpen={isConfirmOpen}
                title="요리 일지 삭제"
                message="이 요리 일지를 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다."
                confirmText={isDeleting ? '삭제 중...' : '삭제하기'}
                cancelText="취소"
                onConfirm={confirmDelete}
                onCancel={() => { setIsConfirmOpen(false); setDeletingId(null); }}
                isDestructive={true}
            />
        </div>
    );
}
