'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createRecipe } from '@/api/recipes';

interface Ingredient {
    id: number;
    name: string;
    amount: string;
    unit: string;
}

interface Step {
    id: number;
    step_number: number;
    description: string;
    imageFile: File | null;
    imagePreview: string | null;
}

export default function NewRecipePage() {
    const router = useRouter();

    // Basic Info State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [cookingTime, setCookingTime] = useState('');
    const [difficulty, setDifficulty] = useState<'easy'|'medium'|'hard'>('medium');
    
    // Thumbnail State
    const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
    const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
    const thumbnailInputRef = useRef<HTMLInputElement>(null);

    // Ingredients State
    const [ingredients, setIngredients] = useState<Ingredient[]>([
        { id: Date.now(), name: '', amount: '', unit: '' }
    ]);

    // Steps State
    const [steps, setSteps] = useState<Step[]>([
        { id: Date.now(), step_number: 1, description: '', imageFile: null, imagePreview: null }
    ]);

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Thumbnail Handlers
    const handleThumbnailClick = () => thumbnailInputRef.current?.click();
    const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setThumbnailFile(file);
            setThumbnailPreview(URL.createObjectURL(file));
        }
    };

    // Ingredient Handlers
    const addIngredient = () => {
        setIngredients([...ingredients, { id: Date.now() + Math.random(), name: '', amount: '', unit: '' }]);
    };
    const removeIngredient = (id: number) => {
        if (ingredients.length > 1) {
            setIngredients(ingredients.filter(ing => ing.id !== id));
        }
    };
    const updateIngredient = (id: number, field: keyof Ingredient, value: string) => {
        setIngredients(ingredients.map(ing => ing.id === id ? { ...ing, [field]: value } : ing));
    };

    // Step Handlers
    const addStep = () => {
        setSteps([...steps, { id: Date.now() + Math.random(), step_number: steps.length + 1, description: '', imageFile: null, imagePreview: null }]);
    };
    const removeStep = (id: number) => {
        if (steps.length > 1) {
            const newSteps = steps.filter(step => step.id !== id).map((step, index) => ({
                ...step,
                step_number: index + 1
            }));
            setSteps(newSteps);
        }
    };
    const updateStepDescription = (id: number, value: string) => {
        setSteps(steps.map(step => step.id === id ? { ...step, description: value } : step));
    };
    const handleStepImageChange = (id: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const previewUrl = URL.createObjectURL(file);
            setSteps(steps.map(step => step.id === id ? { ...step, imageFile: file, imagePreview: previewUrl } : step));
        }
    };

    // Form Submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!title.trim() || !cookingTime || isNaN(Number(cookingTime))) {
            alert('필수 정보(제목, 요리 시간)를 정확히 입력해주세요.');
            return;
        }
        
        const validIngredients = ingredients.filter(ing => ing.name.trim() && ing.amount.trim());
        if (validIngredients.length === 0) {
            alert('최소 1개 이상의 재료를 입력해주세요.');
            return;
        }

        const validSteps = steps.filter(step => step.description.trim());
        if (validSteps.length === 0) {
            alert('최소 1개 이상의 요리 순서를 입력해주세요.');
            return;
        }

        try {
            setIsSubmitting(true);
            const formData = new FormData();
            
            formData.append('title', title);
            formData.append('description', description);
            formData.append('cooking_time', cookingTime);
            formData.append('difficulty', difficulty);
            
            if (thumbnailFile) {
                formData.append('thumbnail_image', thumbnailFile);
            }
            
            const cleanIngredients = validIngredients.map(ing => ({
                name: ing.name,
                amount: ing.amount,
                unit: ing.unit || null
            }));
            formData.append('ingredients', JSON.stringify(cleanIngredients));
            
            // Note: the step objects sent in JSON only contain step_number and description
            const cleanSteps = validSteps.map((step, index) => ({
                step_number: index + 1,
                description: step.description
            }));
            formData.append('steps', JSON.stringify(cleanSteps));

            validSteps.forEach((step, index) => {
                if (step.imageFile) {
                    formData.append(`step_image_${index}`, step.imageFile);
                }
            });

            const res = await createRecipe(formData);
            if (res.status === 'success') {
                router.push(`/recipes/${res.data.id}`);
            }
        } catch (error: any) {
            console.error('Failed to create recipe', error);
            const errData = error.response?.data;
            const detailMsg = errData?.message || JSON.stringify(errData?.data || errData || error.message);
            alert(`레시피 등록에 실패했습니다. (400)\n\n상세 내용:\n${detailMsg}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen font-display">
            {/* Top Navigation Bar */}


            <main className="max-w-4xl mx-auto w-full px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">새 레시피 등록</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">당신만의 특별한 맛의 기록을 공유해주세요.</p>
                </div>

                <form className="space-y-8 pb-12" onSubmit={handleSubmit}>
                    {/* Basic Info Card */}
                    <section className="bg-white dark:bg-slate-900 rounded-xl p-6 md:p-8 shadow-sm border border-slate-100 dark:border-slate-800">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">info</span> 기본 정보
                        </h3>
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="md:col-span-2 space-y-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">레시피 제목</label>
                                        <input 
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            required
                                            className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 focus:border-primary focus:ring-primary h-12 px-4 shadow-sm" 
                                            placeholder="예: 엄마표 묵은지 김치찌개" 
                                            type="text" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">레시피 설명 <span className="text-slate-400 font-normal">(선택)</span></label>
                                        <textarea 
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 focus:border-primary focus:ring-primary px-4 py-3 min-h-[120px] shadow-sm" 
                                            placeholder="이 레시피의 특징이나 유래를 짧게 소개해 주세요."
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">대표 이미지 <span className="text-slate-400 font-normal">(선택)</span></label>
                                    <div 
                                        onClick={handleThumbnailClick}
                                        className="relative overflow-hidden border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl aspect-square flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group shadow-sm"
                                    >
                                        <input 
                                            type="file" 
                                            ref={thumbnailInputRef}
                                            accept="image/*" 
                                            onChange={handleThumbnailChange}
                                            className="hidden" 
                                        />
                                        {thumbnailPreview ? (
                                            <div className="absolute inset-0">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={thumbnailPreview} alt="Thumbnail preview" className="w-full h-full object-cover" />
                                            </div>
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined text-slate-400 group-hover:text-primary text-4xl mb-2 transition-colors">add_a_photo</span>
                                                <span className="text-xs text-slate-500 font-medium tracking-wide">이미지 업로드</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">요리 시간</label>
                                    <div className="relative">
                                        <input 
                                            value={cookingTime}
                                            onChange={(e) => setCookingTime(e.target.value)}
                                            required
                                            min="1"
                                            className="w-full h-12 rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 pr-10 focus:border-primary focus:ring-primary shadow-sm" 
                                            type="number" 
                                            placeholder="예: 30" 
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">분</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">난이도</label>
                                    <div className="flex gap-2 h-12">
                                        <button 
                                            onClick={() => setDifficulty('easy')}
                                            className={`flex-1 rounded-lg border shadow-sm transition-all font-medium ${
                                                difficulty === 'easy' 
                                                ? 'border-2 border-primary bg-primary/10 text-primary font-bold' 
                                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-primary hover:text-primary'
                                            }`} 
                                            type="button"
                                        >
                                            쉬움
                                        </button>
                                        <button 
                                            onClick={() => setDifficulty('medium')}
                                            className={`flex-1 rounded-lg border shadow-sm transition-all font-medium ${
                                                difficulty === 'medium' 
                                                ? 'border-2 border-primary bg-primary/10 text-primary font-bold' 
                                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-primary hover:text-primary'
                                            }`} 
                                            type="button"
                                        >
                                            보통
                                        </button>
                                        <button 
                                            onClick={() => setDifficulty('hard')}
                                            className={`flex-1 rounded-lg border shadow-sm transition-all font-medium ${
                                                difficulty === 'hard' 
                                                ? 'border-2 border-primary bg-primary/10 text-primary font-bold' 
                                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-primary hover:text-primary'
                                            }`} 
                                            type="button"
                                        >
                                            어려움
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Ingredients Section */}
                    <section className="bg-white dark:bg-slate-900 rounded-xl p-6 md:p-8 shadow-sm border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">kitchen</span> 재료 정보
                            </h3>
                            <button onClick={addIngredient} className="flex items-center gap-1 text-sm font-bold text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors border border-dashed border-primary/50" type="button">
                                <span className="material-symbols-outlined text-lg">add</span> <span className="hidden sm:inline">항목 추가</span>
                            </button>
                        </div>
                        <div className="space-y-3">
                            {ingredients.map((ing) => (
                                <div key={ing.id} className="flex gap-2 sm:gap-3 items-center group">
                                    <input 
                                        value={ing.name}
                                        onChange={(e) => updateIngredient(ing.id, 'name', e.target.value)}
                                        className="w-1/2 sm:flex-[2] rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 focus:border-primary focus:ring-primary shadow-sm" 
                                        placeholder="재료명 (예: 돼지고기)" 
                                        type="text" 
                                    />
                                    <input 
                                        value={ing.amount}
                                        onChange={(e) => updateIngredient(ing.id, 'amount', e.target.value)}
                                        className="w-1/4 sm:flex-[1] rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 focus:border-primary focus:ring-primary shadow-sm" 
                                        placeholder="수량 (예: 300)" 
                                        type="text" 
                                    />
                                    <input 
                                        value={ing.unit}
                                        onChange={(e) => updateIngredient(ing.id, 'unit', e.target.value)}
                                        className="w-1/4 sm:flex-[1] rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 focus:border-primary focus:ring-primary shadow-sm" 
                                        placeholder="단위 (예: g)" 
                                        type="text" 
                                    />
                                    <button 
                                        onClick={() => removeIngredient(ing.id)}
                                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0" 
                                        type="button"
                                        disabled={ingredients.length <= 1}
                                    >
                                        <span className="material-symbols-outlined shrink-0 text-xl block">close</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Cooking Steps Section */}
                    <section className="bg-white dark:bg-slate-900 rounded-xl p-6 md:p-8 shadow-sm border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">format_list_numbered</span> 요리 순서
                            </h3>
                            <button onClick={addStep} className="flex items-center gap-1 text-sm font-bold text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors border border-dashed border-primary/50" type="button">
                                <span className="material-symbols-outlined text-lg">add</span> <span className="hidden sm:inline">단계 추가</span>
                            </button>
                        </div>
                        <div className="space-y-6">
                            {steps.map((step) => (
                                <div key={step.id} className="flex gap-3 sm:gap-4 group items-start">
                                    <div className="flex-none pt-2">
                                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-sm">
                                            {step.step_number}
                                        </div>
                                    </div>
                                    <div className="flex-1 space-y-3">
                                        <div className="flex flex-col sm:flex-row gap-4">
                                            <textarea 
                                                value={step.description}
                                                onChange={(e) => updateStepDescription(step.id, e.target.value)}
                                                className="flex-1 rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 focus:border-primary focus:ring-primary min-h-[100px] shadow-sm resize-y" 
                                                placeholder="단계를 설명해주세요."
                                            />
                                            <div className="relative w-full sm:w-36 h-36 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors overflow-hidden group/img shrink-0 shadow-sm">
                                                <input 
                                                    type="file" 
                                                    accept="image/*" 
                                                    className="absolute inset-0 opacity-0 cursor-pointer z-20"
                                                    onChange={(e) => handleStepImageChange(step.id, e)}
                                                    onClick={(e) => {
                                                        // Reset value so same file can be selected again
                                                        (e.target as HTMLInputElement).value = '';
                                                    }}
                                                />
                                                {step.imagePreview ? (
                                                    <div className="absolute inset-0">
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img src={step.imagePreview} alt={`Step ${step.step_number}`} className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center z-10 pointer-events-none">
                                                            <span className="material-symbols-outlined text-white text-2xl drop-shadow">edit</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <span className="material-symbols-outlined text-slate-400 group-hover/img:text-primary text-2xl transition-colors mb-1">add_photo_alternate</span>
                                                        <span className="text-xs text-slate-500 font-medium tracking-wide">이미지 추가</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex-none pt-2">
                                        <button 
                                            onClick={() => removeStep(step.id)}
                                            className="text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 p-2 rounded-lg transition-colors" 
                                            type="button"
                                            disabled={steps.length <= 1}
                                        >
                                            <span className="material-symbols-outlined shrink-0 block">close</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Action Buttons */}
                    <div className="flex gap-4 justify-end pt-4 sticky bottom-6 z-40 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xl">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            disabled={isSubmitting}
                            className="px-6 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex items-center gap-2 px-10 py-3 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? (
                                <>
                                    <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                                    등록 중...
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-lg">check_circle</span>
                                    레시피 등록하기
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </main>
        </div>
    );
}
