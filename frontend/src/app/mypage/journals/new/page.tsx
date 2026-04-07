'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, X, ChefHat, Clock, Check, Loader2 } from 'lucide-react';
import { apiClient as client } from '@/api/client';
import { getMyGroups } from '@/api/community';
import type { Recipe, ApiResponse, PaginatedResult, Group } from '@/types';

type Visibility = 'public' | 'private' | 'all_groups' | 'specific_groups';

const VISIBILITY_OPTIONS: { value: Visibility; label: string; desc: string }[] = [
    { value: 'private',        label: '나만 보기',   desc: '나만 볼 수 있습니다' },
    { value: 'public',         label: '전체 공개',   desc: '모든 사람이 볼 수 있습니다' },
    { value: 'all_groups',     label: '모든 그룹',   desc: '내가 가입한 모든 그룹에 공개됩니다' },
    { value: 'specific_groups',label: '특정 그룹만', desc: '선택한 그룹에만 공개됩니다' },
];

const DIFFICULTY_BADGE: Record<string, string> = {
    easy:   'bg-emerald-50 text-emerald-600',
    medium: 'bg-amber-50   text-amber-600',
    hard:   'bg-red-50     text-red-600',
};

const searchRecipesAPI = async (title: string): Promise<Recipe[]> => {
    const res = await client.get<ApiResponse<PaginatedResult<Recipe>>>(
        '/api/v1/recipes/search/', { params: { title, page_size: 10 } }
    );
    return res.data.status === 'success' ? res.data.data.results : [];
};

const getTodayString = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

export default function NewJournalPage() {
    const router = useRouter();

    // Form state
    const [title, setTitle] = useState('');
    const [cookedAt, setCookedAt] = useState(getTodayString());
    const [selectedRecipe, setSelectedRecipe] = useState<{ id: number; title: string } | null>(null);
    const [content, setContent] = useState('');
    const [tags, setTags] = useState('');
    const [visibility, setVisibility] = useState<Visibility>('private');
    const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // My groups
    const [myGroups, setMyGroups] = useState<Group[]>([]);

    // Recipe search modal
    const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
    const [recipeSearchInput, setRecipeSearchInput] = useState('');
    const [recipeResults, setRecipeResults] = useState<Recipe[]>([]);
    const [isRecipeLoading, setIsRecipeLoading] = useState(false);
    const recipeSearchRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchGroups = async () => {
            try {
                const res = await getMyGroups();
                if (res.status === 'success') setMyGroups(res.data.results ?? []);
            } catch { /* ignore */ }
        };
        fetchGroups();
    }, []);

    // Recipe search
    useEffect(() => {
        if (!isRecipeModalOpen) return;
        setTimeout(() => recipeSearchRef.current?.focus(), 100);
    }, [isRecipeModalOpen]);

    const handleRecipeSearch = async (q: string) => {
        setRecipeSearchInput(q);
        if (!q.trim()) { setRecipeResults([]); return; }
        try {
            setIsRecipeLoading(true);
            const results = await searchRecipesAPI(q);
            setRecipeResults(results);
        } catch { setRecipeResults([]); }
        finally { setIsRecipeLoading(false); }
    };

    const handleSelectRecipe = (recipe: Recipe) => {
        setSelectedRecipe({ id: recipe.id, title: recipe.title });
        setIsRecipeModalOpen(false);
        setRecipeSearchInput('');
        setRecipeResults([]);
    };

    // Image upload
    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    // Group selection
    const toggleGroup = (id: number) => {
        setSelectedGroupIds(prev =>
            prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
        );
    };

    // Submit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !content.trim() || !cookedAt) {
            alert('필수 항목을 모두 입력해주세요.');
            return;
        }

        try {
            setIsSubmitting(true);
            const formData = new FormData();

            formData.append('title', title);
            formData.append('content', content);
            formData.append('cooked_at', cookedAt);
            formData.append('visibility', visibility);

            if (selectedRecipe) {
                formData.append('recipe_id', String(selectedRecipe.id));
            }

            // Tags: parse #hashtags into array, or split by comma
            const tagArray = tags
                .split(/[,\s]+/)
                .map(t => t.replace(/^#/, '').trim())
                .filter(Boolean);
            formData.append('tags', JSON.stringify(tagArray));

            // Groups
            if (visibility === 'specific_groups' && selectedGroupIds.length > 0) {
                formData.append('target_group_ids', JSON.stringify(selectedGroupIds));
            }

            if (imageFile) {
                formData.append('image', imageFile);
            }

            const res = await client.post('/api/v1/community/cooking-journals/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data.status === 'success') {
                router.push('/mypage/journals');
            }
        } catch (error: any) {
            const msg = error.response?.data?.message || '등록에 실패했습니다. 다시 시도해주세요.';
            alert(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="w-full">
            <div className="max-w-3xl mx-auto pb-20">
                {/* Title */}
                <div className="mb-8">
                    <Link href="/mypage/journals" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary transition-colors mb-4">
                        <span className="material-symbols-outlined text-sm">arrow_back</span>
                        <span className="font-bold">목록으로 돌아가기</span>
                    </Link>
                    <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white">요리 일지 작성</h1>
                    <p className="text-slate-500 mt-2">오늘 완성한 요리의 특별한 순간을 기록해보세요.</p>
                </div>

                <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="p-6 lg:p-8 flex flex-col gap-8">

                        {/* Image Upload */}
                        <div className="flex flex-col gap-3">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">완성된 요리 사진</label>
                            <div className="relative aspect-video rounded-xl bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors group overflow-hidden">
                                {imagePreview ? (
                                    <>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={imagePreview} alt="preview" className="absolute inset-0 w-full h-full object-cover" />
                                        <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }}
                                            className="absolute top-2 right-2 z-10 bg-black/50 text-white rounded-full p-1 hover:bg-black/70 transition-colors">
                                            <X size={14} />
                                        </button>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center text-slate-400 group-hover:text-primary z-10 gap-2">
                                        <span className="material-symbols-outlined text-4xl">add_a_photo</span>
                                        <p className="text-sm font-medium">사진을 업로드하거나 끌어다 놓으세요</p>
                                    </div>
                                )}
                                <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-20" onChange={handleImageChange} />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Journal Title */}
                            <div className="flex flex-col gap-2 col-span-full">
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300" htmlFor="title">
                                    일지 제목 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    id="title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all dark:text-white"
                                    placeholder="오늘의 요리를 한마디로 표현해주세요"
                                    type="text"
                                    required
                                />
                            </div>

                            {/* Cooking Date */}
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300" htmlFor="cooked_at">
                                    요리한 날짜 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    id="cooked_at"
                                    value={cookedAt}
                                    onChange={(e) => setCookedAt(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all dark:text-white"
                                    type="date"
                                    required
                                />
                            </div>

                            {/* Recipe Connection — Modal Trigger */}
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">연결된 레시피 <span className="text-slate-400 font-normal">(선택)</span></label>
                                <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => setIsRecipeModalOpen(true)}
                                    onKeyDown={(e) => e.key === 'Enter' && setIsRecipeModalOpen(true)}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-primary hover:bg-primary/5 text-left transition-all group cursor-pointer"
                                >
                                    <ChefHat className="text-slate-400 group-hover:text-primary flex-shrink-0 transition-colors" size={18} />
                                    <span className={selectedRecipe ? 'font-semibold text-slate-800 dark:text-white text-sm' : 'text-slate-400 text-sm'}>
                                        {selectedRecipe ? selectedRecipe.title : '레시피를 검색해서 연결하세요...'}
                                    </span>
                                    {selectedRecipe && (
                                        <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedRecipe(null); }}
                                            className="ml-auto text-slate-400 hover:text-red-500 flex-shrink-0 transition-colors">
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300" htmlFor="content">
                                상세 기록 <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                id="content"
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all resize-none dark:text-white"
                                placeholder="요리 과정에서의 팁이나 오늘 느꼈던 맛을 자유롭게 기록하세요"
                                rows={6}
                                required
                            />
                        </div>

                        {/* Tags */}
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300" htmlFor="tags">태그</label>
                            <input
                                id="tags"
                                value={tags}
                                onChange={(e) => setTags(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all dark:text-white"
                                placeholder="#김치찌개 #성공적 #저녁식사"
                                type="text"
                            />
                            <p className="text-xs text-slate-500">콤마(,) 또는 공백으로 구분하거나 # 기호를 사용하세요.</p>
                        </div>

                        {/* Visibility */}
                        <div className="flex flex-col gap-3">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">공개 범위</label>
                            <div className="grid grid-cols-2 gap-2">
                                {VISIBILITY_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setVisibility(opt.value)}
                                        className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                                            visibility === opt.value
                                                ? 'border-primary bg-primary/5 text-primary'
                                                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                                        }`}
                                    >
                                        <span className="text-sm font-bold">{opt.label}</span>
                                        <span className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Specific Groups Picker */}
                            {visibility === 'specific_groups' && (
                                <div className="mt-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                    <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-3">공개할 그룹 선택</p>
                                    {myGroups.length === 0 ? (
                                        <p className="text-xs text-slate-400">가입한 그룹이 없습니다.</p>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {myGroups.map(group => (
                                                <button
                                                    key={group.id}
                                                    type="button"
                                                    onClick={() => toggleGroup(group.id)}
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                                                        selectedGroupIds.includes(group.id)
                                                            ? 'bg-primary text-white border-primary'
                                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary'
                                                    }`}
                                                >
                                                    {selectedGroupIds.includes(group.id) && <Check size={11} />}
                                                    {group.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
                            <button type="button" onClick={() => router.back()}
                                className="px-8 py-3 rounded-xl font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                취소
                            </button>
                            <button type="submit" disabled={isSubmitting}
                                className="flex items-center gap-2 px-10 py-3 rounded-xl font-bold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                {isSubmitting ? (
                                    <><Loader2 size={16} className="animate-spin" /> 등록 중...</>
                                ) : '등록하기'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            {/* Recipe Search Modal */}
            {isRecipeModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                        {/* Modal Header */}
                        <div className="flex items-center gap-3 p-5 border-b border-slate-100 dark:border-slate-800">
                            <ChefHat className="text-primary flex-shrink-0" size={22} />
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex-1">레시피 검색</h3>
                            <button onClick={() => setIsRecipeModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Search Input */}
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    ref={recipeSearchRef}
                                    type="text"
                                    value={recipeSearchInput}
                                    onChange={(e) => handleRecipeSearch(e.target.value)}
                                    placeholder="레시피 이름으로 검색..."
                                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all dark:text-white"
                                />
                            </div>
                        </div>

                        {/* Results */}
                        <div className="flex-1 overflow-y-auto p-2">
                            {isRecipeLoading ? (
                                <div className="flex items-center justify-center py-10 gap-2 text-slate-400">
                                    <Loader2 size={20} className="animate-spin" />
                                    <span className="text-sm">검색 중...</span>
                                </div>
                            ) : recipeResults.length === 0 && recipeSearchInput ? (
                                <div className="text-center py-10 text-slate-400">
                                    <ChefHat className="mx-auto mb-2 text-slate-300" size={32} />
                                    <p className="text-sm">일치하는 레시피가 없습니다</p>
                                </div>
                            ) : recipeResults.length === 0 ? (
                                <div className="text-center py-10 text-slate-400">
                                    <Search className="mx-auto mb-2 text-slate-300" size={32} />
                                    <p className="text-sm">검색어를 입력하세요</p>
                                </div>
                            ) : (
                                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {recipeResults.map((recipe) => (
                                        <li key={recipe.id}>
                                            <button
                                                type="button"
                                                onClick={() => handleSelectRecipe(recipe)}
                                                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-primary/5 text-left transition-colors group"
                                            >
                                                <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 flex-shrink-0">
                                                    {recipe.thumbnail_image ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img src={recipe.thumbnail_image} alt={recipe.title} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <ChefHat className="text-slate-300" size={20} />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-slate-800 dark:text-white text-sm line-clamp-1 group-hover:text-primary transition-colors">
                                                        {recipe.title}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="flex items-center gap-1 text-[11px] text-slate-400">
                                                            <Clock size={10} />{recipe.cooking_time}분
                                                        </span>
                                                        {recipe.difficulty && (
                                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${DIFFICULTY_BADGE[recipe.difficulty] ?? 'bg-slate-100 text-slate-600'}`}>
                                                                {{ easy: '쉬움', medium: '보통', hard: '어려움' }[recipe.difficulty]}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <Check size={16} className="text-primary opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
