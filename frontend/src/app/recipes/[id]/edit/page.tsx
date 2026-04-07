'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/api/client';
import { ApiResponse } from '@/types';

export default function EditRecipePage() {
    const router = useRouter();
    const params = useParams();
    const recipeId = params.id as string;

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Form States
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [cookingTime, setCookingTime] = useState(20);
    const [difficulty, setDifficulty] = useState('normal');
    const [ingredients, setIngredients] = useState<any[]>([]);
    const [steps, setSteps] = useState<any[]>([]);
    const [thumbnailImage, setThumbnailImage] = useState('');

    useEffect(() => {
        const fetchRecipe = async () => {
            try {
                const res = await apiClient.get<ApiResponse<any>>(`/api/v1/recipes/${recipeId}/`);
                if (res.data.status === 'success') {
                    const data = res.data.data;
                    setTitle(data.title || '');
                    setDescription(data.description || '');
                    setCookingTime(data.cooking_time || 0);
                    setDifficulty(data.difficulty || 'normal');
                    setThumbnailImage(data.thumbnail_image || '');
                    setIngredients(data.ingredients || []);
                    setSteps(data.steps || []);
                }
            } catch (err) {
                console.error('Failed to fetch recipe for editing', err);
                alert('레시피 정보를 불러오는데 실패했습니다.');
            } finally {
                setIsLoading(false);
            }
        };
        if (recipeId) fetchRecipe();
    }, [recipeId]);

    const handleIngredientChange = (index: number, field: string, value: string) => {
        const newIngredients = [...ingredients];
        newIngredients[index] = { ...newIngredients[index], [field]: value };
        setIngredients(newIngredients);
    };

    const handleStepChange = (index: number, value: string) => {
        const newSteps = [...steps];
        newSteps[index] = { ...newSteps[index], description: value };
        setSteps(newSteps);
    };

    const handleSave = async () => {
        try {
            setIsSaving(true);
            const payload = {
                title,
                description,
                cooking_time: cookingTime,
                difficulty,
                ingredients: ingredients.map((ing) => ({
                    name: ing.name,
                    amount: ing.amount || ing.quantity,
                    unit: ing.unit
                })),
                steps: steps.map((s, idx) => ({
                    step_number: idx + 1,
                    description: s.description
                }))
            };

            const res = await apiClient.patch<ApiResponse<any>>(`/api/v1/recipes/${recipeId}/`, payload);
            if (res.data.status === 'success') {
                alert('레시피가 성공적으로 수정되었습니다.');
                router.push(`/recipes/${recipeId}`);
            } else {
                alert('수정에 실패했습니다: ' + res.data.message);
            }
        } catch (err) {
            console.error('Failed to update recipe', err);
            alert('레시피 수정 중 오류가 발생했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className="flex min-h-screen items-center justify-center"><span className="material-symbols-outlined max-w-fit animate-spin text-primary text-4xl">progress_activity</span></div>;
    }

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen font-display">
            <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 md:px-10 py-3 sticky top-0 z-50">
                <div className="flex items-center gap-4 text-primary cursor-pointer" onClick={() => router.push('/')}>
                    <span className="material-symbols-outlined text-2xl">restaurant_menu</span>
                    <h2 className="text-lg font-bold">Recipio</h2>
                </div>
                <div className="hidden md:flex items-center gap-8">
                    <Link href="/fridge" className="text-slate-600 dark:text-slate-300 font-medium hover:text-primary">냉장고</Link>
                    <Link href="/recipes" className="text-primary font-bold border-b-2 border-primary pb-1">레시피</Link>
                    <Link href="/community" className="text-slate-600 dark:text-slate-300 font-medium hover:text-primary">커뮤니티</Link>
                </div>
                <div className="flex gap-4 items-center">
                    <Link href="/mypage" className="bg-slate-200 dark:bg-slate-700 rounded-full border border-slate-300 dark:border-slate-600 size-10 flex items-center justify-center overflow-hidden">
                        <span className="material-symbols-outlined text-slate-500 text-2xl">account_circle</span>
                    </Link>
                </div>
            </header>

            <main className="max-w-4xl mx-auto w-full px-4 py-8">
                <div className="flex items-center gap-2 mb-8">
                    <button onClick={() => router.back()} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">레시피 수정</h1>
                </div>

                <div className="space-y-8 pb-20">
                    <section className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                        <h3 className="text-lg font-bold mb-6 text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">info</span> 기본 정보
                        </h3>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">레시피 제목</label>
                                <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white focus:ring-primary focus:border-primary px-4 py-3" placeholder="제목을 입력하세요" type="text" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">레시피 설명</label>
                                <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white focus:ring-primary focus:border-primary px-4 py-3 min-h-[100px]" placeholder="간단한 설명을 작성해주세요"></textarea>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">대표 이미지</label>
                                <div className="relative group aspect-video md:w-1/2 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center bg-slate-50 dark:bg-slate-800/50 overflow-hidden cursor-pointer">
                                    <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${thumbnailImage || "https://via.placeholder.com/600x400"}')` }}></div>
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
                                        <span className="material-symbols-outlined text-3xl">photo_camera</span>
                                        <p className="text-xs mt-1">이미지 변경</p>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">소요 시간 (분)</label>
                                    <div className="relative">
                                        <input value={cookingTime} onChange={(e) => setCookingTime(Number(e.target.value))} className="w-full rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white px-4 py-3 pr-10 focus:ring-primary focus:border-primary" type="number" />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">분</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">난이도</label>
                                    <div className="flex gap-2 h-12">
                                        <button onClick={() => setDifficulty('easy')} className={`flex-1 rounded-xl text-sm font-medium transition-colors ${difficulty === 'easy' ? 'bg-primary/10 border-2 border-primary text-primary' : 'border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}`} type="button">쉬움</button>
                                        <button onClick={() => setDifficulty('normal')} className={`flex-1 rounded-xl text-sm font-medium transition-colors ${difficulty === 'normal' ? 'bg-primary/10 border-2 border-primary text-primary' : 'border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}`} type="button">보통</button>
                                        <button onClick={() => setDifficulty('hard')} className={`flex-1 rounded-xl text-sm font-medium transition-colors ${difficulty === 'hard' ? 'bg-primary/10 border-2 border-primary text-primary' : 'border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}`} type="button">어려움</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">kitchen</span> 재료 목록
                            </h3>
                            <button onClick={() => setIngredients([...ingredients, { name: '', amount: '', unit: '' }])} className="text-primary text-sm font-bold flex items-center gap-1 hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors" type="button">
                                <span className="material-symbols-outlined text-lg">add</span> 재료 추가
                            </button>
                        </div>
                        <div className="space-y-3">
                            {ingredients.map((ing, idx) => (
                                <div key={idx} className="flex gap-3">
                                    <input value={ing.name || ''} onChange={(e) => handleIngredientChange(idx, 'name', e.target.value)} className="flex-1 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white px-4 py-3 focus:ring-primary focus:border-primary" placeholder="재료명" type="text" />
                                    <input value={ing.amount || ing.quantity || ''} onChange={(e) => handleIngredientChange(idx, 'amount', e.target.value)} className="w-24 sm:w-32 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white px-4 py-3 focus:ring-primary focus:border-primary" placeholder="용량" type="text" />
                                    <input value={ing.unit || ''} onChange={(e) => handleIngredientChange(idx, 'unit', e.target.value)} className="w-20 sm:w-24 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white px-4 py-3 focus:ring-primary focus:border-primary" placeholder="단위" type="text" />
                                    <button onClick={() => setIngredients(ingredients.filter((_, i) => i !== idx))} className="p-3 text-slate-400 hover:text-red-500 transition-colors" type="button">
                                        <span className="material-symbols-outlined">delete</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">format_list_numbered</span> 요리 순서
                            </h3>
                            <button onClick={() => setSteps([...steps, { description: '', image: null }])} className="text-primary text-sm font-bold flex items-center gap-1 hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors" type="button">
                                <span className="material-symbols-outlined text-lg">add</span> 단계 추가
                            </button>
                        </div>
                        <div className="space-y-8">
                            {steps.map((step, idx) => (
                                <div key={idx} className="relative pl-10 border-l-2 border-slate-100 dark:border-slate-800 pb-2">
                                    <div className="absolute -left-[13px] top-0 bg-primary text-white rounded-full size-6 flex items-center justify-center text-xs font-bold">{idx + 1}</div>
                                    <div className="flex flex-col lg:flex-row gap-4">
                                        <div className="flex-1">
                                            <textarea value={step.description || ''} onChange={(e) => handleStepChange(idx, e.target.value)} className="w-full rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white px-4 py-3 focus:ring-primary focus:border-primary min-h-[80px]" placeholder="단계를 설명해주세요"></textarea>
                                        </div>
                                        {step.image ? (
                                            <div className="lg:w-32 aspect-video lg:aspect-square rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700 overflow-hidden relative group cursor-pointer">
                                                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${step.image}')` }}></div>
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                                                    <span className="material-symbols-outlined">edit</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="lg:w-32 aspect-video lg:aspect-square rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                                                <span className="material-symbols-outlined text-slate-400">add_photo_alternate</span>
                                            </div>
                                        )}
                                        <button onClick={() => setSteps(steps.filter((_, i) => i !== idx))} className="self-start p-2 text-slate-400 hover:text-red-500 transition-colors" type="button">
                                            <span className="material-symbols-outlined">close</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <div className="flex flex-col sm:flex-row gap-4 pt-6 justify-end">
                        <button onClick={() => router.back()} disabled={isSaving} className="sm:w-32 h-14 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-lg transition-colors order-2 sm:order-1 disabled:opacity-50" type="button">
                            취소
                        </button>
                        <button onClick={handleSave} disabled={isSaving} className="sm:w-48 h-14 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-lg transition-all shadow-lg shadow-primary/20 order-1 sm:order-2 disabled:opacity-50" type="button">
                            {isSaving ? '저장 중...' : '수정 완료'}
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}
