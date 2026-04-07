'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Search, ChefHat, Clock, Star, Filter, SlidersHorizontal,
    Flame, Leaf, Coffee, UtensilsCrossed, Pizza, Soup, Salad, Loader2, X
} from 'lucide-react';
import { apiClient as client } from '@/api/client';
import type { Recipe, ApiResponse, PaginatedResult } from '@/types';

const DIFFICULTY_OPTIONS = [
    { value: '', label: '전체 난이도' },
    { value: 'easy', label: '쉬움' },
    { value: 'medium', label: '보통' },
    { value: 'hard', label: '어려움' },
];

const SORT_OPTIONS = [
    { value: 'latest', label: '최신순' },
    { value: 'views', label: '조회수순' },
];

const DIFFICULTY_BADGE: Record<string, { label: string; cls: string }> = {
    easy:   { label: '쉬움',   cls: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
    medium: { label: '보통',   cls: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
    hard:   { label: '어려움', cls: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
};

interface SearchRecipesParams {
    title?: string;
    difficulty?: string;
    sort?: string;
    page?: number;
    page_size?: number;
}

const searchRecipes = async (params: SearchRecipesParams): Promise<ApiResponse<PaginatedResult<Recipe>>> => {
    const res = await client.get<ApiResponse<PaginatedResult<Recipe>>>('/api/v1/recipes/search/', { params });
    return res.data;
};

const PAGE_SIZE = 8;

export default function RecipesPage() {
    const router = useRouter();

    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState('');
    const [inputValue, setInputValue] = useState('');
    const [difficulty, setDifficulty] = useState('');
    const [sort, setSort] = useState('latest');

    const searchInputRef = useRef<HTMLInputElement>(null);

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    const fetchRecipes = async (page = 1, term = searchTerm, diff = difficulty, sortBy = sort) => {
        try {
            setIsLoading(true);
            const params: SearchRecipesParams = { page, page_size: PAGE_SIZE, sort: sortBy };
            if (term.trim()) params.title = term.trim();
            if (diff) params.difficulty = diff;
            const res = await searchRecipes(params);
            if (res.status === 'success') {
                setRecipes(res.data.results);
                setTotalCount(res.data.count);
            }
        } catch (err) {
            console.error('Failed to search recipes', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Handle search query from URL if present
        const searchParams = new URLSearchParams(window.location.search);
        const searchFromUrl = searchParams.get('search');
        if (searchFromUrl && searchFromUrl !== searchTerm) {
            setSearchTerm(searchFromUrl);
            setInputValue(searchFromUrl);
            setCurrentPage(1);
        }
    }, []);

    useEffect(() => {
        fetchRecipes(currentPage, searchTerm, difficulty, sort);
    }, [currentPage, searchTerm, difficulty, sort]);

    const handleSearch = () => {
        setSearchTerm(inputValue);
        setCurrentPage(1);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSearch();
    };

    const handleDifficultyChange = (val: string) => {
        setDifficulty(val);
        setCurrentPage(1);
    };

    const handleSortChange = (val: string) => {
        setSort(val);
        setCurrentPage(1);
    };

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const clearSearch = () => {
        setInputValue('');
        setSearchTerm('');
        fetchRecipes(1, '', difficulty, sort);
    };

    return (
        <div className="bg-slate-50 dark:bg-slate-950 min-h-screen font-display">
            {/* Hero Section */}

            {/* Hero Section */}
            <section className="relative overflow-hidden bg-gradient-to-br from-primary/90 to-emerald-700 px-4 py-14 md:py-20 text-white text-center">
                <div className="absolute inset-0 opacity-10 pointer-events-none">
                    <div className="absolute top-10 left-10 text-8xl">🍳</div>
                    <div className="absolute bottom-10 right-10 text-8xl">🥘</div>
                    <div className="absolute top-1/2 left-1/4 text-6xl">🌿</div>
                </div>
                <div className="relative max-w-2xl mx-auto">
                    <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3 drop-shadow">
                        오늘은 뭐 해먹을까요? 🍽️
                    </h1>
                    <p className="text-white/80 md:text-lg mb-8">
                        다양한 레시피를 검색하고 나만의 요리를 완성해보세요.
                    </p>
                    {/* Search Bar */}
                    <div className="relative flex items-center bg-white rounded-2xl shadow-xl overflow-hidden max-w-xl mx-auto">
                        <Search className="absolute left-4 text-slate-400" size={20} />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="레시피 이름을 검색해보세요..."
                            className="w-full h-14 pl-12 pr-16 text-slate-800 focus:outline-none text-sm font-medium bg-transparent placeholder:text-slate-400"
                        />
                        {inputValue && (
                            <button onClick={clearSearch} className="absolute right-16 text-slate-400 hover:text-slate-600">
                                <X size={16} />
                            </button>
                        )}
                        <button
                            onClick={handleSearch}
                            className="absolute right-0 h-14 px-5 bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-colors"
                        >
                            검색
                        </button>
                    </div>
                </div>
            </section>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 py-8">
                {/* Filters Row */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                            <SlidersHorizontal size={14} /> 필터:
                        </span>
                        {DIFFICULTY_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => handleDifficultyChange(opt.value)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-full border transition-all ${
                                    difficulty === opt.value
                                        ? 'bg-primary text-white border-primary shadow-md shadow-primary/25'
                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary hover:text-primary'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">정렬:</span>
                        {SORT_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => handleSortChange(opt.value)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-full border transition-all ${
                                    sort === opt.value
                                        ? 'bg-primary text-white border-primary shadow-md shadow-primary/25'
                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary hover:text-primary'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Results Count Info */}
                {!isLoading && (
                    <div className="flex items-center justify-between mb-5">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {searchTerm ? (
                                <><span className="font-semibold text-slate-700 dark:text-slate-200">'{searchTerm}'</span> 검색 결과</>
                            ) : '전체 레시피'}{' '}
                            <span className="font-black text-primary">{totalCount}</span>개
                        </p>
                        <Link
                            href="/recipes/new"
                            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-md shadow-primary/25 hover:bg-primary/90 transition-all active:scale-95"
                        >
                            <span className="material-symbols-outlined text-base">add</span>
                            레시피 등록
                        </Link>
                    </div>
                )}

                {/* Recipe Grid */}
                {isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                        {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                            <div key={i} className="animate-pulse rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                                <div className="aspect-video bg-slate-100 dark:bg-slate-800" />
                                <div className="p-4 space-y-2">
                                    <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-3/4" />
                                    <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/2" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : recipes.length === 0 ? (
                    <div className="py-24 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900/50">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 mb-4">
                            <ChefHat className="text-slate-400" size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">검색 결과가 없습니다</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                            다른 검색어나 필터를 사용해 보세요.
                        </p>
                        <button
                            onClick={() => { clearSearch(); setDifficulty(''); }}
                            className="mt-5 px-5 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
                        >
                            필터 초기화
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                        {recipes.map((recipe) => {
                            const diff = DIFFICULTY_BADGE[recipe.difficulty];
                            return (
                                <Link
                                    key={recipe.id}
                                    href={`/recipes/${recipe.id}`}
                                    className="group flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
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
                                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 via-primary/5 to-transparent">
                                                <ChefHat className="text-primary/30" size={40} />
                                            </div>
                                        )}
                                        {diff && (
                                            <span className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full shadow ${diff.cls}`}>
                                                {diff.label}
                                            </span>
                                        )}
                                    </div>
                                    {/* Card Body */}
                                    <div className="flex flex-col flex-1 p-4">
                                        <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-snug line-clamp-2 mb-auto">
                                            {recipe.title}
                                        </h3>
                                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                                            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                                                <Clock size={11} />
                                                <span>{recipe.cooking_time}분</span>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}

                {/* Pagination */}
                {!isLoading && totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-10">
                        <button
                            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                            className="flex items-center gap-1 px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:border-primary hover:text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed font-semibold"
                        >
                            이전
                        </button>
                        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                            // Smart pagination: show current page neighbourhood
                            let page: number;
                            if (totalPages <= 7) {
                                page = i + 1;
                            } else if (currentPage <= 4) {
                                page = i + 1;
                            } else if (currentPage >= totalPages - 3) {
                                page = totalPages - 6 + i;
                            } else {
                                page = currentPage - 3 + i;
                            }
                            return (
                                <button
                                    key={page}
                                    onClick={() => handlePageChange(page)}
                                    className={`w-9 h-9 text-sm font-bold rounded-xl transition-all ${
                                        currentPage === page
                                            ? 'bg-primary text-white shadow-md shadow-primary/30'
                                            : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-primary hover:text-primary'
                                    }`}
                                >
                                    {page}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage === totalPages}
                            className="flex items-center gap-1 px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:border-primary hover:text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed font-semibold"
                        >
                            다음
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}
