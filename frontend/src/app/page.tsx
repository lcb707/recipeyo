'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getMyFridge, getFridgeSummary } from '@/api/fridge';
import { apiClient } from '@/api/client';
import { ApiResponse, FridgeSummary, User } from '@/types';
import { useUser } from '@/context/UserContext';

export default function HomePage() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const [isLoading, setIsLoading] = useState(true);

  // Data States
  const [fridgeSummary, setFridgeSummary] = useState<FridgeSummary>({ imminent: 0, warning: 0, fresh: 0, total: 0 });
  const [groupSummary, setGroupSummary] = useState({ totalGroups: 0 });
  const [recommendedRecipes, setRecommendedRecipes] = useState<any[]>([]);
  const [recentJournals, setRecentJournals] = useState<any[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);

        const [fridgeRes, groupsRes, recipesRes, journalsRes] = await Promise.all([
          getMyFridge(),
          apiClient.get<ApiResponse<any>>('/api/v1/community/groups/'),
          apiClient.get<ApiResponse<any>>('/api/v1/recipes/'),
          apiClient.get<ApiResponse<any>>('/api/v1/community/cooking-journals/')
        ]);

        // 2. Fridge Summary
        const fridgeId = fridgeRes?.data?.id;
        if (fridgeId) {
          try {
            const summaryRes = await getFridgeSummary(fridgeId);
            if (summaryRes.status === 'success' && summaryRes.data) {
              const s = summaryRes.data;
              setFridgeSummary({
                imminent: s.imminent || 0,
                warning: s.warning || 0,
                fresh: s.fresh || 0,
                total: (s.imminent || 0) + (s.warning || 0) + (s.fresh || 0)
              });
            }
          } catch {
            const itemsRes = await apiClient.get<ApiResponse<any>>(`/api/v1/fridges/${fridgeId}/items/`);
            const items: any[] = Array.isArray(itemsRes.data?.data) ? itemsRes.data.data : (itemsRes.data?.data?.results || []);
            const active = items.filter((i: any) => i.status === 'ACTIVE');
            const today = new Date();
            const imminent = active.filter((i: any) => {
              if (!i.expiry_date) return false;
              const diff = Math.ceil((new Date(i.expiry_date).getTime() - today.getTime()) / 86400000);
              return diff >= 0 && diff <= 3;
            }).length;
            const warning = active.filter((i: any) => {
              if (!i.expiry_date) return false;
              const diff = Math.ceil((new Date(i.expiry_date).getTime() - today.getTime()) / 86400000);
              return diff > 3 && diff <= 7;
            }).length;
            const total = active.length;
            setFridgeSummary({ imminent, warning, fresh: total - imminent - warning, total });
          }
        }

        // 3. Groups
        const groupsData = groupsRes.data?.data;
        const groupsList = Array.isArray(groupsData) ? groupsData : (groupsData?.results || []);
        setGroupSummary({ totalGroups: groupsList.length });

        // 4. Recipes
        const recipesData = recipesRes.data?.data;
        const recipesList = Array.isArray(recipesData) ? recipesData : (recipesData?.results || []);
        setRecommendedRecipes(recipesList.slice(0, 3));

        // 5. Journals
        const journalsData = journalsRes.data?.data;
        const journalsList = Array.isArray(journalsData) ? journalsData : (journalsData?.results || []);
        setRecentJournals(journalsList.slice(0, 4));

      } catch (error) {
        console.error('Error loading dashboard:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Helper for D-Day rendering
  const getDdayBadge = (expiryDate: string) => {
    const diff = Math.ceil((new Date(expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return <div className="bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase">기한지남</div>;
    if (diff === 0) return <div className="bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase">D-Day</div>;
    if (diff <= 3) return <div className="bg-orange-500 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase">D-{diff}</div>;
    return <div className="bg-slate-400 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase">D-{diff}</div>;
  };

  if (isLoading || userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
        <span className="material-symbols-outlined max-w-fit animate-spin text-primary text-5xl">progress_activity</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100">
      <main className="max-w-7xl mx-auto w-full px-4 md:px-10 py-8 flex-1">
        {/* 1. Welcome Banner */}
        <section className="mb-8">
          <div className="bg-gradient-to-r from-primary to-green-600 rounded-xl p-8 text-white shadow-lg shadow-primary/20">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">안녕하세요, {user?.nickname || '회원'}님! 👋</h1>
            <p className="text-white/90 text-lg">
              오늘 냉장고의 신선도는 <span className="bg-white/20 px-2 py-0.5 rounded font-bold">'우수'</span> 입니다. 기분 좋은 요리 시간 되세요!
            </p>
          </div>
        </section>

        {/* 2. Summary Cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push('/fridge')}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-lg text-primary">
                  <span className="material-symbols-outlined">kitchen</span>
                </div>
                <h3 className="font-bold text-lg">나의 냉장고</h3>
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status</span>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{fridgeSummary.total}개 <span className="text-sm font-normal text-slate-500">품목</span></p>
              </div>
              <div className="flex gap-2">
                {fridgeSummary.imminent > 0 && (
                  <div className="flex items-center gap-1 bg-red-50 dark:bg-red-900/20 px-2.5 py-1 rounded-full text-red-600 dark:text-red-400 font-bold text-xs">
                    <span className="material-symbols-outlined text-xs" style={{fontSize:'14px'}}>priority_high</span>
                    임박 {fridgeSummary.imminent}
                  </div>
                )}
                {fridgeSummary.warning > 0 && (
                  <div className="flex items-center gap-1 bg-orange-50 dark:bg-orange-900/20 px-2.5 py-1 rounded-full text-orange-500 dark:text-orange-400 font-bold text-xs">
                    <span className="material-symbols-outlined text-xs" style={{fontSize:'14px'}}>warning</span>
                    주의 {fridgeSummary.warning}
                  </div>
                )}
                <div className="flex items-center gap-1 bg-green-50 dark:bg-green-900/20 px-2.5 py-1 rounded-full text-green-600 dark:text-green-400 font-bold text-xs">
                  <span className="material-symbols-outlined text-xs" style={{fontSize:'14px'}}>check_circle</span>
                  신선 {fridgeSummary.fresh}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push('/mypage/groups')}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
                  <span className="material-symbols-outlined">hub</span>
                </div>
                <h3 className="font-bold text-lg">공유 그룹</h3>
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Groups</span>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{groupSummary.totalGroups}개 <span className="text-sm font-normal text-slate-500">참여 그룹</span></p>
              </div>
              <div className="flex items-center gap-1 bg-primary/10 px-3 py-1.5 rounded-full text-primary font-bold text-sm">
                <span className="material-symbols-outlined text-sm">notifications_active</span>
                확인
              </div>
            </div>
          </div>
        </section>



        {/* 4. 오늘의 추천 레시피 */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">auto_awesome</span>
              오늘의 추천 레시피
            </h2>
            <button onClick={() => router.push('/recipes')} className="text-slate-500 text-sm font-semibold hover:underline">더보기</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {recommendedRecipes.length > 0 ? (
              recommendedRecipes.map(recipe => (
                <div key={recipe.id} onClick={() => router.push(`/recipes/${recipe.id}`)} className="group cursor-pointer bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-xl transition-all">
                  <div className="relative h-48 overflow-hidden bg-slate-100 dark:bg-slate-900">
                    {recipe.thumbnail_image ? (
                      <img src={recipe.thumbnail_image} alt={recipe.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <span className="material-symbols-outlined text-5xl">restaurant</span>
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded uppercase tracking-wider">추천</span>
                    </div>
                    <h3 className="font-bold text-lg mb-4 text-slate-900 dark:text-white line-clamp-1">{recipe.title}</h3>
                    <div className="flex items-center justify-between text-slate-500 text-sm">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-base">schedule</span> {recipe.cooking_time || 0}분
                        </span>
                      </div>
                      <button className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-primary/20 hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-xl">bookmark_border</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-12 text-center text-slate-500 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 mt-2">
                추천 레시피를 불러오지 못했습니다.
              </div>
            )}
          </div>
        </section>

        {/* 5. 최근 요리 일지 */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-500">forum</span>
              최근 요리 일지
            </h2>
            <button onClick={() => router.push('/community')} className="text-slate-500 text-sm font-semibold hover:text-primary hover:underline">커뮤니티 가기</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {recentJournals.length > 0 ? (
              recentJournals.map(journal => (
                <div key={journal.id} onClick={() => router.push(`/community/journals/${journal.id}`)} className="relative group cursor-pointer aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  {journal.image ? (
                    <img src={journal.image} alt="Journal" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <span className="material-symbols-outlined text-4xl">menu_book</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 flex flex-col justify-end p-3 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-xs font-bold truncate line-clamp-2 white-space-normal">{journal.content || '일지 내용'}</p>
                    <p className="text-[10px] opacity-80 mt-1">{journal.created_at ? journal.created_at.split('T')[0] : '최근'}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-12 text-center text-slate-500 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                아직 작성된 요리 일지가 없습니다.
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-10 mt-auto">
        <div className="max-w-7xl mx-auto px-4 md:px-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 text-primary/50 grayscale opacity-80 transition-all hover:grayscale-0 hover:opacity-100 cursor-pointer" onClick={() => window.scrollTo(0, 0)}>
            <span className="material-symbols-outlined text-2xl">restaurant_menu</span>
            <h2 className="text-lg font-bold tracking-tight text-slate-500 dark:text-slate-400">Recipio</h2>
          </div>
          <p className="text-slate-400 text-sm">© 2026 Recipio Inc. 스마트하게 관리하고 건강하게 요리하세요.</p>
          <div className="flex gap-6 text-slate-400">
            <a className="hover:text-primary transition-colors text-sm" href="#">이용약관</a>
            <a className="hover:text-primary transition-colors text-sm" href="#">개인정보처리방침</a>
            <a className="hover:text-primary transition-colors text-sm" href="#">문의하기</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
