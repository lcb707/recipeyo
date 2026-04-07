'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getMyGroups } from '@/api/community';
import { getMyRecipes } from '@/api/recipes';
import { getUserActivityCounts } from '@/api/users';
import type { Recipe, Group } from '@/types';

export default function MyPageHome() {
    const router = useRouter();
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [stats, setStats] = useState({ recipesCount: 0, scrapsCount: 0, journalsCount: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                setLoading(true);
                const [recipesRes, groupsRes, countsRes] = await Promise.all([
                    getMyRecipes(1, 3),
                    getMyGroups(),
                    getUserActivityCounts()
                ]);

                if (recipesRes.status === 'success') {
                    setRecipes(recipesRes.data.results || []);
                }
                
                if (countsRes.status === 'success') {
                    setStats({
                        recipesCount: countsRes.data.recipe_count || 0,
                        scrapsCount: countsRes.data.scrap_count || 0,
                        journalsCount: countsRes.data.cooking_journal_count ?? countsRes.data.cooking_journals_count ?? countsRes.data.journal_count ?? countsRes.data.journals_count ?? 0
                    });
                }

                if (groupsRes.status === 'success') {
                    const groupsData = groupsRes.data as any;
                    setGroups((groupsData?.results || groupsData || []).slice(0, 3));
                }
            } catch (err) {
                console.error('Failed to load dashboard data', err);
            } finally {
                setLoading(false);
            }
        };
        fetchDashboardData();
    }, []);
    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center py-20 gap-4">
                <div className="size-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <p className="text-slate-500 font-medium">대시보드 데이터를 불러오는 중...</p>
            </div>
        );
    }

    return (
        <>
            {/* Stats Section */}
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-1">
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">나의 레시피</p>
                    <div className="flex items-baseline gap-2">
                        <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.recipesCount}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-1">
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">스크랩</p>
                    <div className="flex items-baseline gap-2">
                        <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.scrapsCount}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-1">
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">요리 일지</p>
                    <div className="flex items-baseline gap-2">
                        <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.journalsCount}</p>
                    </div>
                </div>
            </section>

            {/* Recipe Grid */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">나의 레시피</h3>
                    <Link href="/mypage/recipes" className="text-primary text-sm font-bold flex items-center gap-1">
                        전체보기 <span className="material-symbols-outlined text-xs">arrow_forward_ios</span>
                    </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {recipes.length > 0 ? recipes.map((recipe) => (
                        <div key={recipe.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                            <Link href={`/recipes/${recipe.id}`} className="block h-40 bg-center bg-cover bg-slate-100" style={{ backgroundImage: `url(${recipe.thumbnail_image || 'https://via.placeholder.com/400'})` }}></Link>
                            <div className="p-4">
                                <Link href={`/recipes/${recipe.id}`} className="font-bold text-slate-900 dark:text-white mb-2 truncate block hover:text-primary">{recipe.title}</Link>
                                <div className="flex items-center text-slate-500 text-xs gap-3">
                                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">schedule</span> {recipe.cooking_time || 0}분</span>
                                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">trending_up</span> {recipe.difficulty === 'easy' ? '쉬움' : recipe.difficulty === 'medium' ? '보통' : '어려움'}</span>
                                </div>
                            </div>
                        </div>
                    )) : (
                        <div className="col-span-3 py-10 text-center text-slate-500">등록된 레시피가 없습니다.</div>
                    )}
                </div>
            </section>

            {/* My Groups Section */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">나의 그룹</h3>
                    <Link href="/mypage/groups" className="text-primary text-sm font-bold flex items-center gap-1">
                        전체 보기 <span className="material-symbols-outlined text-xs">arrow_forward_ios</span>
                    </Link>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {groups.length > 0 ? groups.map((group) => (
                            <div 
                                key={group.id} 
                                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                onClick={() => router.push(`/mypage/groups/${group.id}`)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="size-12 rounded-lg bg-green-100 flex items-center justify-center text-primary">
                                        <span className="material-symbols-outlined text-2xl">group</span>
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-900 dark:text-white text-sm">{group.name}</p>
                                        <p className="text-slate-500 text-xs">{group.my_role === 'admin' ? '운영자' : '일반멤버'}</p>
                                    </div>
                                </div>
                                <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full border border-primary/20">
                                    {group.my_role === 'admin' ? '관리자' : '멤버'}
                                </span>
                            </div>
                        )) : (
                            <div className="p-10 text-center text-slate-500">가입된 그룹이 없습니다.</div>
                        )}
                    </div>
                </div>
            </section>
        </>
    );
}
