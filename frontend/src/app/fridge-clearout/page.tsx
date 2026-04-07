"use client";

import React, { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getAllFridges, getFridgeItems, GetFridgeItemsParams, recommendRecipes } from '@/api/fridge';
import { useSearchParams } from 'next/navigation';
import { Fridge, FridgeItem } from '@/types';
import { Header } from '@/components/layout/Header';
import { Search, Check, Utensils, ArrowRight } from 'lucide-react';
import { getIngredientIcon } from '@/utils/iconMap';

type StorageFilter = '전체' | '냉장' | '냉동' | '실온';

const STORAGE_MAP: Record<StorageFilter, GetFridgeItemsParams['storage_type'] | undefined> = {
    '전체': undefined,
    '냉장': 'FRIDGE',
    '냉동': 'FREEZER',
    '실온': 'ROOM_TEMP',
};

function FridgeClearoutPageContent() {
    const router = useRouter();
    const [fridgeList, setFridgeList] = useState<Fridge[]>([]);
    const [selectedFridgeId, setSelectedFridgeId] = useState<number | null>(null);
    const [currentFridge, setCurrentFridge] = useState<Fridge | null>(null);
    const [items, setItems] = useState<FridgeItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [listLoading, setListLoading] = useState(false);
    const [isRecommending, setIsRecommending] = useState(false);
    
    const [storageFilter, setStorageFilter] = useState<StorageFilter>('전체');
    const [searchKeyword, setSearchKeyword] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    
    // Multi-selection state
    const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
    
    const debounceRef = useRef<NodeJS.Timeout | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchParams = useSearchParams();
    const queryGroupId = searchParams.get('groupId');

    // 1. Load fridge list & set default (personal)
    useEffect(() => {
        const loadFridges = async () => {
            try {
                setLoading(true);
                const res = await getAllFridges();
                if (res.status === 'success' && res.data) {
                    const list = Array.isArray(res.data) ? res.data : (res.data as any)?.results || [];
                    setFridgeList(list);
                    if (list.length > 0) {
                        let target = list.find((f: Fridge) => f.fridge_type === 'personal') || list[0];
                        
                        if (queryGroupId) {
                            const groupFridge = list.find((f: Fridge) => f.group === Number(queryGroupId));
                            if (groupFridge) target = groupFridge;
                        }

                        setSelectedFridgeId(target.id);
                        setCurrentFridge(target);
                    }
                }
            } catch (err) {
                console.error('Failed to load fridges:', err);
            } finally {
                setLoading(false);
            }
        };
        loadFridges();
    }, []);

    // 2. Fetch items
    const fetchItems = useCallback(async (
        fridgeId: number,
        filter: StorageFilter,
        keyword: string
    ) => {
        try {
            setListLoading(true);
            const params: GetFridgeItemsParams = {};
            const storageType = STORAGE_MAP[filter];
            if (storageType) params.storage_type = storageType;
            if (keyword.trim()) params.search = keyword.trim();

            const res = await getFridgeItems(fridgeId, params);
            if (res.status === 'success') {
                const data = res.data as any;
                setItems(Array.isArray(data) ? data : (data?.results || []));
            }
        } catch (err) {
            console.error('Failed to fetch items:', err);
        } finally {
            setListLoading(false);
        }
    }, []);

    useEffect(() => {
        if (selectedFridgeId === null) return;
        fetchItems(selectedFridgeId, storageFilter, searchKeyword);
    }, [selectedFridgeId, storageFilter, searchKeyword, fetchItems]);

    // Search input change
    const handleSearchChange = (value: string) => {
        setSearchInput(value);
    };

    // Trigger search
    const handleSearchSubmit = () => {
        setSearchKeyword(searchInput.trim());
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSearchSubmit();
        }
    };

    // Outside click for dropdown
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleItemSelection = (id: number) => {
        setSelectedItemIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleRecommendClick = async () => {
        if (!selectedFridgeId) return;
        
        const selectedItems = items.filter(item => selectedItemIds.includes(item.id));
        const selectedNames = selectedItems.map(item => item.name);
        
        // 사용자의 요청: 선택한 식재료의 standard_ingredient_id 값을 추출 (null 또는 undefined 제외)
        const standardIds = selectedItems
            .map(item => item.standard_ingredient_id)
            .filter((id): id is number => id !== null && id !== undefined);

        setIsRecommending(true);
        try {
            const res = await recommendRecipes(selectedFridgeId, {
                selected_standard_ingredient_ids: standardIds,
                selected_ingredients: selectedNames
            });
            if (res.status === 'success') {
                sessionStorage.setItem('recommendResult', JSON.stringify(res.data));
                sessionStorage.setItem('recommendIngredients', JSON.stringify(selectedNames));
                router.push('/recipes/recommend-result');
            }
        } catch (error) {
            console.error('Failed to get recommendations:', error);
            alert('레시피 추천에 실패했습니다. 다시 시도해주세요.');
        } finally {
            setIsRecommending(false);
        }
    };

    const activeItems = items.filter(item => item.status === 'ACTIVE');

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
                <span className="material-symbols-outlined animate-spin text-primary text-5xl">progress_activity</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 font-display text-slate-900 dark:text-slate-100 pb-24">
            <main className="max-w-7xl mx-auto w-full px-4 md:px-10 py-8">
                {/* Intro */}
                <header className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-green-500 rounded-lg text-white">
                            <Utensils size={24} />
                        </div>
                        <h1 className="text-3xl font-black tracking-tight">냉장고 파먹기</h1>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400">냉장고 속 남은 재료들을 선택해 보세요. 가장 잘 어울리는 레시피를 추천해 드립니다.</p>
                </header>

                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                    {/* Toolbar */}
                    <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4 py-3 gap-4">
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                            {/* Fridge Selector */}
                            <div className="relative" ref={dropdownRef}>
                                <button
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    className="flex items-center gap-2 font-bold text-base hover:text-primary transition-colors h-10 px-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700"
                                >
                                    <span>{currentFridge?.name}</span>
                                    <span className={`material-symbols-outlined text-sm text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}>expand_more</span>
                                </button>
                                {isDropdownOpen && (
                                    <div className="absolute left-0 top-full mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                                        {fridgeList.map(f => (
                                            <button
                                                key={f.id}
                                                onClick={() => { setSelectedFridgeId(f.id); setCurrentFridge(f); setIsDropdownOpen(false); }}
                                                className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors ${selectedFridgeId === f.id ? 'text-primary font-bold bg-primary/5' : ''}`}
                                            >
                                                <span className="material-symbols-outlined text-base">{f.fridge_type === 'personal' ? 'kitchen' : 'group'}</span>
                                                {f.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Storage Filter */}
                            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                                {(['전체', '냉장', '냉동', '실온'] as StorageFilter[]).map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setStorageFilter(tab)}
                                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${storageFilter === tab ? 'bg-white dark:bg-slate-900 text-primary shadow-sm' : 'text-slate-500'}`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                             <div className="relative flex-1 sm:w-64">
                                <button onClick={handleSearchSubmit} className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center hover:text-primary transition-colors z-10">
                                    <Search className="text-slate-400 hover:text-primary transition-colors" size={16} />
                                </button>
                                <input
                                    className="w-full h-10 pl-9 pr-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 outline-none text-sm focus:border-primary transition-all"
                                    placeholder="재료 찾기..."
                                    value={searchInput}
                                    onChange={(e) => handleSearchChange(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                />
                             </div>
                        </div>
                    </div>

                    {/* Content Grid */}
                    <div className="p-5">
                        {listLoading ? (
                            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                                <span className="material-symbols-outlined animate-spin text-3xl mb-2">progress_activity</span>
                                <p className="text-sm">식재료를 불러오는 중입니다...</p>
                            </div>
                        ) : activeItems.length === 0 ? (
                            <div className="py-20 flex flex-col items-center justify-center text-center text-slate-400 grayscale opacity-60">
                                <Utensils size={48} className="mb-4" />
                                <p className="font-bold">선택 가능한 식재료가 없습니다.</p>
                                <p className="text-xs mt-1">다른 냉장고를 선택하거나 필터를 조정해보세요.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {activeItems.map(item => {
                                    const isSelected = selectedItemIds.includes(item.id);
                                    
                                    // D-Day 계산
                                    let dDayDisplay = null;
                                    if (item.expiry_date) {
                                        const expiry = new Date(item.expiry_date);
                                        const today = new Date();
                                        today.setHours(0,0,0,0);
                                        const diffTime = expiry.getTime() - today.getTime();
                                        const dDay = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                        
                                        if (dDay < 0) dDayDisplay = <span className="text-[11px] font-bold px-2 py-0.5 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-full">지남</span>;
                                        else if (dDay === 0) dDayDisplay = <span className="text-[11px] font-bold px-2 py-0.5 bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 rounded-full">D-Day</span>;
                                        else if (dDay <= 3) dDayDisplay = <span className="text-[11px] font-bold px-2 py-0.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-full">D-{dDay}</span>;
                                        else dDayDisplay = <span className="text-[11px] font-semibold px-2 py-0.5 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 rounded-full">D-{dDay}</span>;
                                    }

                                    return (
                                        <div
                                            key={item.id}
                                            onClick={() => toggleItemSelection(item.id)}
                                            className={`relative flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer group select-none ${
                                                isSelected 
                                                    ? 'border-primary bg-primary/5 shadow-md scale-[1.02]' 
                                                    : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-md hover:border-primary/40'
                                            }`}
                                        >
                                            {/* Icon Container */}
                                            <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isSelected ? 'bg-primary/20 text-primary' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 group-hover:bg-primary/10 group-hover:text-primary'}`}>
                                                {getIngredientIcon(item.category, "w-6 h-6")}
                                            </div>
                                            
                                            {/* Info Content */}
                                            <div className="flex-1 min-w-0 pr-6">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p className={`text-base font-bold truncate transition-colors ${isSelected ? 'text-primary' : 'text-slate-800 dark:text-slate-100 group-hover:text-primary'}`}>
                                                        {item.name}
                                                    </p>
                                                    {dDayDisplay}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                    {item.category && (
                                                        <span className="truncate max-w-[80px]">{item.category}</span>
                                                    )}
                                                    {item.category && <span className="w-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-full opacity-50" />}
                                                    <span className={`font-medium ${isSelected ? 'text-primary/70' : 'text-slate-600 dark:text-slate-300'}`}>
                                                        {item.quantity} {item.unit}
                                                    </span>
                                                    {item.memo && (
                                                        <>
                                                            <span className="w-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-full opacity-50" />
                                                            <span className="truncate max-w-[100px] text-slate-400 overflow-hidden line-clamp-1 flex-1">{item.memo}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Selection Overlay/Indicator */}
                                            {isSelected && (
                                                <div className="absolute right-4 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/30 animate-in zoom-in duration-200">
                                                    <Check size={14} strokeWidth={4} />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Bottom Sticky CTA */}
            <div className={`fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 z-[60] transition-transform duration-300 translate-y-0`}>
                <div className="max-w-xl mx-auto">
                    <button
                        onClick={handleRecommendClick}
                        disabled={isRecommending}
                        className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/30 flex items-center justify-center gap-3 hover:bg-primary/90 hover:-translate-y-0.5 active:scale-95 transition-all text-lg disabled:opacity-70 disabled:hover:translate-y-0"
                    >
                        {isRecommending ? (
                            <span className="material-symbols-outlined animate-spin">progress_activity</span>
                        ) : (
                            <>
                                <span>{selectedItemIds.length > 0 ? (
                                    <>선택한 <strong className="text-yellow-300">{selectedItemIds.length}개</strong>의 재료로</>
                                ) : (
                                    <>내 냉장고 속 재료로 알아서</>
                                )} 레시피 추천받기</span>
                                <ArrowRight size={20} />
                            </>
                        )}
                    </button>
                    <button 
                        onClick={() => setSelectedItemIds([])}
                        className="w-full py-2 text-slate-500 text-xs font-semibold mt-1 hover:text-slate-700 transition-colors"
                    >
                        선택 초기화
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function FridgeClearoutPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
                    <span className="material-symbols-outlined animate-spin text-primary text-5xl">progress_activity</span>
                </div>
            }
        >
            <FridgeClearoutPageContent />
        </Suspense>
    );
}
