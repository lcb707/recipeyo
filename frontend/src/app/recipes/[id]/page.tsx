'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { getRecipe, getScrapFolders, createScrapFolder, scrapRecipeToFolder, checkRecipeScrapStatus, RecipeScrapStatus } from '@/api/recipes';
import { Recipe, ScrapFolder } from '@/types';
import { useUser } from '@/context/UserContext';

export default function RecipeDetailPage() {
    const router = useRouter();
    const params = useParams();
    const recipeId = params.id as string;
    const { user: currentUser } = useUser();

    const [recipe, setRecipe] = useState<Recipe | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [isScrapModalOpen, setIsScrapModalOpen] = useState(false);
    const [scrapMode, setScrapMode] = useState<'list' | 'create'>('list');
    const [scrapFolders, setScrapFolders] = useState<ScrapFolder[]>([]);
    const [isScrapLoading, setIsScrapLoading] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    
    // Scrap status visual states
    const [scrapStatus, setScrapStatus] = useState<RecipeScrapStatus | null>(null);
    const [tempSelectedFolders, setTempSelectedFolders] = useState<number[]>([]);

    const fetchScrapStatus = async () => {
        if (!recipeId) return;
        try {
            const res = await checkRecipeScrapStatus(Number(recipeId));
            if (res.status === 'success') {
                setScrapStatus(res.data);
            }
        } catch (error) {
            console.error('Failed to check scrap status', error);
        }
    };

    useEffect(() => {
        const fetchRecipe = async () => {
            try {
                const res = await getRecipe(Number(recipeId));
                if (res.status === 'success') {
                    setRecipe(res.data);
                }
            } catch (err) {
                console.error('Failed to fetch recipe', err);
            } finally {
                setIsLoading(false);
            }
        };
        if (recipeId) {
            fetchRecipe();
            fetchScrapStatus();
        }
    }, [recipeId]);

    const fetchScrapFolders = async () => {
        setIsScrapLoading(true);
        try {
            const res = await getScrapFolders();
            if (res.status === 'success') {
                const fetchedData = res.data as any;
                setScrapFolders(Array.isArray(fetchedData) ? fetchedData : (fetchedData?.results || []));
            }
        } catch (error) {
            console.error('Failed to fetch scrap folders', error);
            // Ignore error for now, maybe show empty folder state
        } finally {
            setIsScrapLoading(false);
        }
    };

    useEffect(() => {
        if (isScrapModalOpen) {
            fetchScrapFolders();
            setScrapMode('list');
            setNewFolderName('');
            setTempSelectedFolders(scrapStatus?.folder_ids || []);
        }
    }, [isScrapModalOpen, scrapStatus]);

    const handleScrapToggle = (folderId: number) => {
        setTempSelectedFolders(prev => 
            prev.includes(folderId) ? prev.filter(id => id !== folderId) : [...prev, folderId]
        );
    };

    const handleConfirmScrap = async () => {
        setIsScrapLoading(true);
        try {
            // According to Requirement 5, call API individually for each folder
            // Actually scrapRecipeToFolder uses /api/v1/community/recipe-scraps/toggle/
            // But requirement asks for [POST] /api/v1/scrap-folders/{folderId}/add-recipe/
            // Let's implement it as requested if possible, or stick to established client logic if it's cleaner.
            // Documentation says: [POST] /api/v1/community/recipe-scraps/toggle/ { folder_id, recipe_id }
            // Let's assume scrapRecipeToFolder is the correct way but we do it for each folder that changed status.
            
            const currentFolders = scrapStatus?.folder_ids || [];
            const added = tempSelectedFolders.filter(id => !currentFolders.includes(id));
            const removed = currentFolders.filter(id => !tempSelectedFolders.includes(id));

            for (const folderId of [...added, ...removed]) {
                await scrapRecipeToFolder(folderId, Number(recipeId));
            }

            await fetchScrapStatus();
            setIsScrapModalOpen(false);
        } catch (error) {
            console.error(error);
            alert('스크랩 처리에 실패했습니다.');
        } finally {
            setIsScrapLoading(false);
        }
    };

    const handleCreateFolder = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = newFolderName.trim();
        if (!trimmed) return;
        try {
            await createScrapFolder(trimmed);
            setNewFolderName('');
            setScrapMode('list');
            await fetchScrapFolders(); // Refetch list after creation
        } catch (error) {
            console.error(error);
            alert('새 폴더 생성에 실패했습니다.');
        }
    };

    if (isLoading) {
        return <div className="flex justify-center py-20"><span className="material-symbols-outlined max-w-fit animate-spin text-primary text-4xl">progress_activity</span></div>;
    }

    if (!recipe) {
        return <div className="text-center py-20 text-slate-500">레시피를 찾을 수 없습니다.</div>;
    }

    return (
        <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display">


            <main className="flex flex-1 justify-center py-8 px-4 md:px-0">
                <div className="flex flex-col max-w-[960px] flex-1 gap-6">
                    <button onClick={() => router.push('/recipes')} className="flex items-center gap-2 text-slate-500 hover:text-primary w-fit transition-colors mb-2">
                        <span className="material-symbols-outlined text-sm">arrow_back</span>
                        <span className="text-sm font-bold">돌아가기</span>
                    </button>

                    {/* Recipe Hero Card */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-800">
                        <div
                            className="h-[400px] w-full bg-cover bg-center relative"
                            style={{ backgroundImage: `linear-gradient(0deg, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0) 50%), url("${recipe.thumbnail_image}")` }}
                        >
                            <div className="absolute bottom-6 left-8 right-8 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
                                <div className="text-white">
                                    <h1 className="text-4xl font-black leading-tight tracking-tight mb-2">{recipe.title}</h1>
                                    <p className="text-slate-200 text-lg font-normal max-w-xl">{recipe.description || '맛있는 레시피 설명이 없습니다.'}</p>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                     <button 
                                        onClick={() => setIsScrapModalOpen(true)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
                                            scrapStatus?.scraped
                                                ? 'bg-primary/20 text-white border-primary/50 backdrop-blur-md hover:bg-primary/30'
                                                : 'bg-white/20 text-white border-white/30 backdrop-blur-md hover:bg-white/30'
                                        }`}
                                    >
                                        <span 
                                            className="material-symbols-outlined" 
                                            style={scrapStatus?.scraped ? { fontVariationSettings: "'FILL' 1" } : {}}
                                        >
                                            bookmark
                                        </span>
                                        <span className="font-bold">스크랩</span>
                                    </button>
                                    <div className="flex gap-2">
                                        <Link 
                                            href={`/mypage/journals/new?recipe_id=${recipe.id}`}
                                            className="flex items-center gap-2 bg-white/20 text-white px-6 py-2 rounded-xl font-bold backdrop-blur-md border border-white/30 hover:bg-white/30 transition-all"
                                        >
                                            <span className="material-symbols-outlined text-[20px]">edit_note</span>
                                            <span>요리 일지 작성</span>
                                        </Link>
                                        {recipe.author?.id === currentUser?.id && (
                                            <Link 
                                                href={`/recipes/${recipe.id}/edit`}
                                                className="flex items-center gap-2 bg-primary text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
                                            >
                                                <span className="material-symbols-outlined text-[20px]">edit</span>
                                                <span>수정하기</span>
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-6 p-6 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">schedule</span>
                                <span className="text-slate-700 dark:text-slate-300 font-semibold">{recipe.cooking_time || 0}분 소요</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">signal_cellular_alt</span>
                                <span className="text-slate-700 dark:text-slate-300 font-semibold">난이도: {recipe.difficulty === 'easy' ? '하' : recipe.difficulty === 'hard' ? '상' : '중'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">restaurant</span>
                                <span className="text-slate-700 dark:text-slate-300 font-semibold">1인분 기준</span>
                            </div>
                        </div>

                        <div className="p-8">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">shopping_basket</span>
                                    필요한 재료
                                </h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {(recipe.ingredients || []).map((ing: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                        <span className="font-medium">{ing.name}</span>
                                        <span className="text-primary font-bold">{ing.amount || ing.quantity}{ing.unit || ''}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm border border-slate-100 dark:border-slate-800">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-8 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">cooking</span>
                            조리 순서
                        </h3>
                        <div className="flex flex-col gap-10">
                            {(recipe.steps || []).map((step: any, idx: number) => (
                                <div key={idx} className="flex flex-col md:flex-row gap-6 items-start">
                                    <div className="flex-none">
                                        <span className="flex items-center justify-center size-10 rounded-full bg-primary text-white font-bold text-lg">{step.step_number || idx + 1}</span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-slate-800 dark:text-slate-200 text-lg leading-relaxed mb-4 whitespace-pre-line">{step.description}</p>
                                        {step.image && (
                                            <div className="w-full aspect-video rounded-xl overflow-hidden bg-slate-100">
                                                <div
                                                    className="w-full h-full bg-cover bg-center"
                                                    style={{ backgroundImage: `url(${step.image})` }}
                                                ></div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </main>

            {/* Smart Scrap Modal */}
            {isScrapModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="w-full max-w-sm bg-white dark:bg-slate-900 shadow-xl rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">스크랩 폴더 선택</h3>
                            <button onClick={() => setIsScrapModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        
                        <div className="p-6">
                            {isScrapLoading ? (
                                <div className="flex justify-center py-10">
                                    <span className="material-symbols-outlined animate-spin text-primary text-3xl">progress_activity</span>
                                </div>
                            ) : scrapMode === 'list' ? (
                                <div className="flex flex-col gap-4">
                                    {scrapFolders.length > 0 ? (
                                        <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-2">
                                            {scrapFolders.map(folder => {
                                                const isScraped = scrapStatus?.folder_ids.includes(folder.id);
                                                return (
                                                    <button
                                                        key={folder.id}
                                                        onClick={() => handleScrapToggle(folder.id)}
                                                        className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left group/folder ${
                                                            tempSelectedFolders.includes(folder.id)
                                                                ? 'bg-primary/5 border-primary text-primary dark:bg-primary/10' 
                                                                : 'bg-slate-50 border-slate-100 text-slate-800 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            {/* Checkbox Icon */}
                                                            <div className={`size-5 rounded border-2 flex items-center justify-center transition-colors ${
                                                                tempSelectedFolders.includes(folder.id) ? 'bg-primary border-primary' : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600'
                                                            }`}>
                                                                {tempSelectedFolders.includes(folder.id) && <span className="material-symbols-outlined text-white text-xs font-bold">check</span>}
                                                            </div>
                                                            <span className="font-bold">{folder.name}</span>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                            <div className="flex gap-2 mt-4">
                                                <button 
                                                    onClick={() => setScrapMode('create')}
                                                    className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm"
                                                >
                                                    폴더 추가
                                                </button>
                                                <button 
                                                    onClick={handleConfirmScrap}
                                                    disabled={isScrapLoading}
                                                    className="flex-1 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-md shadow-primary/20 text-sm disabled:opacity-50"
                                                >
                                                    {isScrapLoading ? '처리 중...' : '확인'}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-6 text-center">
                                            <span className="material-symbols-outlined text-5xl text-slate-300 mb-3">folder_off</span>
                                            <p className="text-slate-500 mb-6 font-medium">생성된 스크랩 폴더가 없습니다.</p>
                                            <button 
                                                onClick={() => setScrapMode('create')}
                                                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
                                            >
                                                <span className="material-symbols-outlined">add</span>
                                                새 폴더 만들기
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <form onSubmit={handleCreateFolder} className="flex flex-col gap-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">새 폴더의 이름을 입력하세요</label>
                                        <input
                                            type="text"
                                            value={newFolderName}
                                            onChange={e => setNewFolderName(e.target.value)}
                                            placeholder="예: 다이어트 식단, 든든한 한끼"
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/50"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                        <button 
                                            type="button" 
                                            onClick={() => setScrapMode('list')}
                                            className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                        >
                                            취소
                                        </button>
                                        <button 
                                            type="submit" 
                                            disabled={!newFolderName.trim()}
                                            className="flex-1 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-md shadow-primary/20"
                                        >
                                            생성
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
