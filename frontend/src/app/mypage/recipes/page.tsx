'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { getMyRecipes, bulkDeleteRecipes } from '@/api/recipes';
import ConfirmModal from '@/components/ConfirmModal';

function RecipesContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    const initialPage = Number(searchParams.get('page')) || 1;
    const initialSearch = searchParams.get('search') || '';
    
    const [page, setPage] = useState(initialPage);
    const [searchTerm, setSearchTerm] = useState(initialSearch);
    const [query, setQuery] = useState(initialSearch);
    const [totalPages, setTotalPages] = useState(1);

    const [recipes, setRecipes] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Selection state
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    const fetchRecipes = async (currentPage: number, currentQuery: string) => {
        try {
            setIsLoading(true);
            const res = await getMyRecipes(currentPage, 6, currentQuery);
            if (res.status === 'success') {
                const data = res.data;
                setRecipes(data.results || []);
                setTotalPages(Math.ceil((data.count || 0) / 6) || 1);
            }
        } catch (err) {
            console.error('Failed to fetch recipes', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const urlSearch = searchParams.get('search') || '';
        if (urlSearch !== query) {
            setQuery(urlSearch);
            setSearchTerm(urlSearch);
            setPage(1);
        }
    }, [searchParams]);

    useEffect(() => {
        fetchRecipes(page, query);
    }, [page, query]);

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setPage(newPage);
            setSelectedIds([]); // Clear selection on page change
            const params = new URLSearchParams(searchParams.toString());
            params.set('page', newPage.toString());
            if (query) params.set('search', query);
            router.push(`${pathname}?${params.toString()}`);
        }
    };

    const handleSearch = () => {
        setQuery(searchTerm);
        setPage(1);
        const params = new URLSearchParams();
        params.set('page', '1');
        if (searchTerm.trim()) {
            params.set('search', searchTerm.trim());
        }
        router.push(`${pathname}?${params.toString()}`);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const toggleSelect = (id: number) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(selectedId => selectedId !== id) : [...prev, id]
        );
    };

    const handleBulkDelete = async () => {
        try {
            const res = await bulkDeleteRecipes(selectedIds);
            if (res.status === 'success') {
                setSelectedIds([]);
                setIsDeleteModalOpen(false);
                // Refetch current page
                fetchRecipes(page, query);
            }
        } catch (error) {
            console.error('Failed to bulk delete recipes', error);
            alert('삭제에 실패했습니다. 다시 시도해주세요.');
        }
    };

    return (
        <div className="flex-1 w-full max-w-[1440px] mx-auto pb-10">
            <div className="mb-8">
                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-2">나의 레시피</h1>
                <p className="text-slate-500 dark:text-slate-400">내가 직접 작성하고 관리하는 나만의 소중한 레시피 목록입니다.</p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
                {/* Search Bar (Left/Center) */}
                <div className="relative w-full sm:max-w-md">
                    <button onClick={handleSearch} className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 hover:text-primary transition-colors">
                        <span className="material-symbols-outlined">search</span>
                    </button>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-full pl-12 pr-4 py-3 border-none bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 focus:ring-2 focus:ring-primary/30 text-base"
                        placeholder="레시피 제목 또는 재료로 검색"
                    />
                </div>

                {/* Actions (Right) */}
                <div className="flex flex-wrap items-center justify-end gap-3 w-full sm:w-auto">
                    <button 
                        onClick={() => setIsDeleteModalOpen(true)}
                        disabled={selectedIds.length === 0}
                        className={`flex items-center gap-2 px-4 py-3 rounded-xl font-bold transition-all shadow-sm border ${
                            selectedIds.length > 0 
                            ? 'bg-white dark:bg-slate-900 border-red-200 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10' 
                            : 'bg-slate-50 dark:bg-slate-800 border-transparent text-slate-400 cursor-not-allowed'
                        }`}
                    >
                        <span className="material-symbols-outlined text-lg">delete</span>
                        선택 삭제
                    </button>
                    
                    <Link href="/recipes/new" className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all">
                        <span className="material-symbols-outlined text-lg">add</span>
                        새 레시피 추가
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

                {isLoading ? (
                    <div className="col-span-1 md:col-span-2 flex justify-center py-20">
                        <span className="material-symbols-outlined animate-spin text-primary text-4xl">progress_activity</span>
                    </div>
                ) : recipes.length > 0 ? (
                    recipes.map((recipe) => (
                        <div key={recipe.id} className="relative bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-800 group hover:shadow-md transition-shadow">
                            
                            {/* Custom Checkbox for selection */}
                            <div className="absolute top-3 left-3 z-10">
                                <label className="flex items-center justify-center cursor-pointer p-1 group/checkbox">
                                    <input 
                                        type="checkbox" 
                                        className="appearance-none hidden"
                                        checked={selectedIds.includes(recipe.id)}
                                        onChange={() => toggleSelect(recipe.id)}
                                    />
                                    <div className={`size-7 rounded-full border-2 shadow-sm transition-colors duration-200 flex items-center justify-center ${
                                        selectedIds.includes(recipe.id)
                                            ? 'bg-primary border-primary'
                                            : 'bg-white border-transparent'
                                    }`}>
                                        {selectedIds.includes(recipe.id) && (
                                            <span className="material-symbols-outlined font-bold text-white text-sm">check</span>
                                        )}
                                    </div>
                                </label>
                            </div>

                            <Link href={`/recipes/${recipe.id}`} className="block relative h-48 w-full cursor-pointer">
                                <div
                                    className="w-full h-full object-cover bg-center bg-cover bg-slate-100"
                                    style={{ backgroundImage: `url(${recipe.thumbnail_image || 'https://via.placeholder.com/400x300'})` }}
                                />
                            </Link>
                            <div className="p-5">
                                <Link href={`/recipes/${recipe.id}`} className="block">
                                    <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2 truncate group-hover:text-primary transition-colors pr-6">{recipe.title}</h4>
                                </Link>
                                <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mb-4">
                                    <div className="flex items-center gap-1">
                                        <span className="material-symbols-outlined text-sm">schedule</span>
                                        <span>{recipe.cooking_time || 0}분</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="material-symbols-outlined text-sm">stairs</span>
                                        <span>{recipe.difficulty === 'easy' ? '쉬움' : recipe.difficulty === 'hard' ? '어려움' : '보통'}</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-slate-800">
                                    <span className="text-xs text-slate-400">{new Date(recipe.created_at).toLocaleDateString()} 작성</span>
                                    <Link href={`/recipes/${recipe.id}/edit`} className="text-sm font-bold text-primary hover:underline">
                                        수정하기
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="col-span-1 md:col-span-2 flex flex-col items-center justify-center py-20 text-slate-400">
                        <span className="material-symbols-outlined text-6xl mb-4">restaurant_menu</span>
                        <p>아직 등록된 레시피가 없습니다.</p>
                        <Link href="/recipes/new" className="mt-4 px-6 py-2 bg-primary text-white font-bold rounded-xl shadow hover:bg-primary/90">
                            첫 레시피 작성하기
                        </Link>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {!isLoading && totalPages > 1 && (
                <div className="mt-12 flex justify-center items-center gap-2">
                    <button 
                        onClick={() => handlePageChange(page - 1)} 
                        disabled={page === 1}
                        className="flex items-center justify-center size-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                        <span className="material-symbols-outlined text-sm">arrow_back_ios_new</span>
                    </button>
                    <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }).map((_, idx) => {
                            const p = idx + 1;
                            return (
                                <button
                                    key={p}
                                    onClick={() => handlePageChange(p)}
                                    className={`flex items-center justify-center size-10 text-sm font-bold rounded-xl transition-colors ${
                                        page === p 
                                        ? 'bg-primary text-white shadow-sm' 
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    {p}
                                </button>
                            );
                        })}
                    </div>
                    <button 
                        onClick={() => handlePageChange(page + 1)} 
                        disabled={page === totalPages}
                        className="flex items-center justify-center size-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                        <span className="material-symbols-outlined text-sm">arrow_forward_ios</span>
                    </button>
                </div>
            )}

            <ConfirmModal
                isOpen={isDeleteModalOpen}
                title="선택 삭제"
                message={`정말로 선택하신 ${selectedIds.length}개의 레시피를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
                confirmText="삭제하기"
                cancelText="취소"
                onConfirm={handleBulkDelete}
                onCancel={() => setIsDeleteModalOpen(false)}
                isDestructive={true}
            />
        </div>
    );
}

export default function MyRecipesPageWrapper() {
    return (
        <Suspense fallback={<div className="flex justify-center py-20"><span className="material-symbols-outlined animate-spin text-primary text-4xl">progress_activity</span></div>}>
            <RecipesContent />
        </Suspense>
    );
}
