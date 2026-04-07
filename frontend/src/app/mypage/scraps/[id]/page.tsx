'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Folder, BookOpen, Clock, ChefHat, Star, Loader2 } from 'lucide-react';
import { getScrapFolderDetail, getScrapFolderRecipes } from '@/api/recipes';
import type { ScrapFolder, Recipe } from '@/types';

const DIFFICULTY_LABEL: Record<string, { label: string; color: string }> = {
    easy: { label: '쉬움', color: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30' },
    medium: { label: '보통', color: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30' },
    hard: { label: '어려움', color: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30' },
};

export default function ScrapFolderDetailPage() {
    const params = useParams();
    const router = useRouter();
    const folderId = Number(params.id);

    const [folder, setFolder] = useState<ScrapFolder | null>(null);
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!folderId) return;

        const fetchData = async () => {
            try {
                setIsLoading(true);
                const [folderRes, recipesRes] = await Promise.all([
                    getScrapFolderDetail(folderId),
                    getScrapFolderRecipes(folderId),
                ]);
                if (folderRes.status === 'success') setFolder(folderRes.data);
                if (recipesRes.status === 'success') setRecipes(recipesRes.data);
            } catch (err) {
                setError('폴더를 불러오는 데 실패했습니다.');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [folderId]);

    if (isLoading) {
        return (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col flex-1 overflow-hidden min-h-[400px] items-center justify-center">
                <Loader2 className="text-primary animate-spin" size={40} />
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">폴더를 불러오는 중...</p>
            </div>
        );
    }

    if (error || !folder) {
        return (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col flex-1 overflow-hidden min-h-[400px] items-center justify-center gap-4">
                <Folder size={40} className="text-slate-300" />
                <p className="text-slate-500">{error || '폴더를 찾을 수 없습니다.'}</p>
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-1 text-primary text-sm font-semibold hover:underline"
                >
                    <ChevronLeft size={16} /> 돌아가기
                </button>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col flex-1 overflow-hidden">
            <main className="flex-1 overflow-y-auto w-full p-6 lg:p-10">
                <div className="mx-auto max-w-5xl pb-10">
                    {/* Breadcrumb Back Nav */}
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-1 text-sm text-slate-500 hover:text-primary mb-6 transition-colors"
                    >
                        <ChevronLeft size={16} />
                        스크랩 폴더 목록
                    </button>

                    {/* Folder Header */}
                    <div className="mb-8 flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary flex-shrink-0">
                            <Folder size={28} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                                {folder.name}
                            </h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                레시피 <span className="font-semibold text-primary">{folder.scrap_count}</span>개 저장됨
                            </p>
                        </div>
                    </div>

                    {/* Recipe Grid */}
                    {recipes.length === 0 ? (
                        <div className="py-24 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-800/30">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 mb-4">
                                <BookOpen className="text-slate-400" size={32} />
                            </div>
                            <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">이 폴더에 담긴 레시피가 없습니다</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                                레시피 상세 페이지에서 스크랩하면 이 폴더에 저장됩니다.
                            </p>
                            <Link
                                href="/recipes"
                                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
                            >
                                레시피 둘러보기
                            </Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {recipes.map((recipe) => {
                                const diff = DIFFICULTY_LABEL[recipe.difficulty] ?? { label: recipe.difficulty, color: 'text-slate-500 bg-slate-100' };
                                return (
                                    <Link
                                        key={recipe.id}
                                        href={`/recipes/${recipe.id}`}
                                        className="group flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all"
                                    >
                                        {/* Thumbnail */}
                                        <div className="relative aspect-video w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                                            {recipe.thumbnail_image ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={recipe.thumbnail_image}
                                                    alt={recipe.title}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                                                    <ChefHat className="text-primary/40" size={36} />
                                                </div>
                                            )}
                                        </div>

                                        {/* Content */}
                                        <div className="flex flex-col flex-1 p-4">
                                            <h3 className="font-bold text-slate-900 dark:text-white text-base leading-snug line-clamp-2 mb-2">
                                                {recipe.title}
                                            </h3>

                                            <div className="flex items-center gap-3 mt-auto pt-2">
                                                <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                                                    <Clock size={12} />
                                                    <span>{recipe.cooking_time}분</span>
                                                </div>
                                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${diff.color}`}>
                                                    {diff.label}
                                                </span>
                                            </div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
