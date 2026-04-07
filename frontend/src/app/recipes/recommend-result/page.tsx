"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Recipe } from '@/types';
import { ArrowLeft, Clock, ChefHat, Heart, Star } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface PaginatedRecipeResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: Recipe[];
}

export default function RecommendResultPage() {
    const router = useRouter();
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [ingredients, setIngredients] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        try {
            const resultData = sessionStorage.getItem('recommendResult');
            const ingredientsData = sessionStorage.getItem('recommendIngredients');
            
            if (resultData) {
                const parsedResult = JSON.parse(resultData);
                // Handle both raw array and paginated response
                if (Array.isArray(parsedResult)) {
                    setRecipes(parsedResult);
                } else if (parsedResult && typeof parsedResult === 'object' && parsedResult.results) {
                    setRecipes(parsedResult.results);
                }
            }
            
            if (ingredientsData) {
                setIngredients(JSON.parse(ingredientsData));
            }
        } catch (error) {
            console.error('Failed to parse recommendation results:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
                <span className="material-symbols-outlined animate-spin text-primary text-5xl">progress_activity</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-transparent font-display">
            <main className="max-w-4xl mx-auto w-full px-4 md:px-10 py-8">
                {/* Header */}
                <div className="mb-8">
                    <button 
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors mb-4"
                    >
                        <ArrowLeft size={20} />
                        <span>뒤로 가기</span>
                    </button>
                    
                    <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 mb-2">
                        추천 레시피 결과
                    </h1>
                    {ingredients.length > 0 && (
                        <p className="text-slate-600 dark:text-slate-400">
                            선택하신 <span className="font-bold text-primary">{ingredients.join(', ')}</span> 
                            {ingredients.length > 0 && ' (으)로 만들 수 있는 레시피입니다.'}
                        </p>
                    )}
                </div>

                {/* Recipe List */}
                {recipes.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-800 shadow-sm">
                        <ChefHat size={48} className="mx-auto text-slate-300 dark:text-slate-700 mb-4" />
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
                            검색된 레시피가 없습니다
                        </h3>
                        <p className="text-slate-500 dark:text-slate-400">
                            선택하신 식재료의 조합으로 가능한 추천 레시피를 찾지 못했습니다.<br/>
                            다른 식재료를 추가하거나 변경해보세요.
                        </p>
                        <button 
                            onClick={() => router.back()}
                            className="mt-6 px-6 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-colors"
                        >
                            식재료 다시 선택하기
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {recipes.map((recipe) => (
                            <Link href={`/recipes/${recipe.id}`} key={recipe.id} className="group">
                                <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-md hover:border-primary/30 transition-all duration-300 group-hover:-translate-y-1">
                                    <div className="aspect-video relative bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                        {recipe.thumbnail_image ? (
                                            <img 
                                                src={recipe.thumbnail_image} 
                                                alt={recipe.title}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center text-slate-300 dark:text-slate-700">
                                                <ChefHat size={48} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-5">
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2 truncate group-hover:text-primary transition-colors">
                                            {recipe.title}
                                        </h3>
                                        <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                                            <div className="flex items-center gap-1.5">
                                                <Clock size={16} />
                                                <span>{recipe.cooking_time}분</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Star size={16} className="text-yellow-400 fill-yellow-400" />
                                                <span className="capitalize">{recipe.difficulty}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
