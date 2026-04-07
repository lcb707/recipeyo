"use client";

import React, { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { getAllFridges, getFridgeItems, GetFridgeItemsParams } from '@/api/fridge';
import { useSearchParams } from 'next/navigation';
import { Fridge, FridgeItem } from '@/types';
import { IngredientModal } from './components/IngredientModal';
import { getIngredientIcon } from '@/utils/iconMap';

type StorageFilter = '전체' | '냉장' | '냉동' | '실온';

const STORAGE_MAP: Record<StorageFilter, GetFridgeItemsParams['storage_type'] | undefined> = {
    '전체': undefined,
    '냉장': 'FRIDGE',
    '냉동': 'FREEZER',
    '실온': 'ROOM_TEMP',
};

function FridgePageContent() {
    const [fridgeList, setFridgeList] = useState<Fridge[]>([]);
    const [selectedFridgeId, setSelectedFridgeId] = useState<number | null>(null);
    const [currentFridge, setCurrentFridge] = useState<Fridge | null>(null);
    const [items, setItems] = useState<FridgeItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [listLoading, setListLoading] = useState(false);
    const [storageFilter, setStorageFilter] = useState<StorageFilter>('전체');
    const [searchKeyword, setSearchKeyword] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<FridgeItem | null>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchParams = useSearchParams();
    const queryGroupId = searchParams.get('groupId');

    // Load fridge list on mount
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
                        
                        // If groupId is in query, try to find that fridge
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

    // Fetch items whenever fridgeId, filter, or search changes
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

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleFridgeSelect = (fridge: Fridge) => {
        setSelectedFridgeId(fridge.id);
        setCurrentFridge(fridge);
        setIsDropdownOpen(false);
    };

    const handleAddItem = () => {
        setSelectedItem(null);
        setIsModalOpen(true);
    };

    const handleEditItem = (item: FridgeItem) => {
        setSelectedItem(item);
        setIsModalOpen(true);
    };

    const handleModalClose = (changed: boolean) => {
        setIsModalOpen(false);
        setSelectedItem(null);
        if (changed && selectedFridgeId) {
            fetchItems(selectedFridgeId, storageFilter, searchKeyword);
        }
    };

    const activeItems = items.filter(item => item.status === 'ACTIVE');

    if (loading) {
        return (
            <div className="flex flex-col flex-1 items-center justify-center py-20 text-slate-500">
                <span className="material-symbols-outlined animate-spin text-primary text-4xl mb-2">progress_activity</span>
                <p>냉장고 정보를 불러오는 중...</p>
            </div>
        );
    }

    if (fridgeList.length === 0) {
        return (
            <div className="flex flex-col flex-1 items-center justify-center py-20 text-slate-500">
                <span className="material-symbols-outlined text-4xl mb-2 opacity-40">kitchen</span>
                <p>접근 가능한 냉장고가 없습니다.</p>
            </div>
        );
    }

    const personalFridges = fridgeList.filter(f => f.fridge_type === 'personal');
    const sharedFridges = fridgeList.filter(f => f.fridge_type === 'shared');

    return (
        <div className="flex flex-col flex-1 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">

            {/* ─── Header ─── */}
            <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-slate-200 dark:border-slate-800 px-4 py-3">
                <div className="flex items-center gap-3">
                    <div className="text-primary">
                        <span className="material-symbols-outlined text-3xl">kitchen</span>
                    </div>

                    {/* Fridge Selector Dropdown */}
                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => setIsDropdownOpen((o) => !o)}
                            className="flex items-center gap-2 font-bold text-lg hover:text-primary transition-colors group"
                        >
                            <span>{currentFridge?.name ?? '냉장고 선택'}</span>
                            {currentFridge?.fridge_type === 'shared' && (
                                <span className="text-[10px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded">공유</span>
                            )}
                            <span className={`material-symbols-outlined text-base text-slate-400 group-hover:text-primary transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}>
                                expand_more
                            </span>
                        </button>

                        {isDropdownOpen && (
                            <div className="absolute left-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg z-50 overflow-hidden">
                                {personalFridges.length > 0 && (
                                    <>
                                        <p className="px-4 pt-3 pb-1 text-xs font-bold text-slate-400 uppercase tracking-wider">내 냉장고</p>
                                        {personalFridges.map(f => (
                                            <button
                                                key={f.id}
                                                onClick={() => handleFridgeSelect(f)}
                                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors ${selectedFridgeId === f.id ? 'text-primary font-semibold bg-primary/5' : 'text-slate-700 dark:text-slate-200'}`}
                                            >
                                                <span className="material-symbols-outlined text-base">kitchen</span>
                                                {f.name}
                                                {selectedFridgeId === f.id && <span className="material-symbols-outlined text-base ml-auto">check</span>}
                                            </button>
                                        ))}
                                    </>
                                )}
                                {sharedFridges.length > 0 && (
                                    <>
                                        <div className="border-t border-slate-100 dark:border-slate-700 my-1" />
                                        <p className="px-4 pt-2 pb-1 text-xs font-bold text-slate-400 uppercase tracking-wider">공유 냉장고</p>
                                        {sharedFridges.map(f => (
                                            <button
                                                key={f.id}
                                                onClick={() => handleFridgeSelect(f)}
                                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors ${selectedFridgeId === f.id ? 'text-primary font-semibold bg-primary/5' : 'text-slate-700 dark:text-slate-200'}`}
                                            >
                                                <span className="material-symbols-outlined text-base">group</span>
                                                {f.name}
                                                {selectedFridgeId === f.id && <span className="material-symbols-outlined text-base ml-auto">check</span>}
                                            </button>
                                        ))}
                                    </>
                                )}
                                <div className="pb-2" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowSearch(s => !s)}
                        className={`flex items-center justify-center rounded-xl h-10 w-10 transition-colors ${showSearch ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                    >
                        <span className="material-symbols-outlined">search</span>
                    </button>
                    <button
                        onClick={handleAddItem}
                        className="flex items-center justify-center rounded-xl h-10 w-10 bg-primary text-white hover:bg-primary/90 transition-colors"
                    >
                        <span className="material-symbols-outlined">add</span>
                    </button>
                </div>
            </header>

            {/* ─── Search Bar (toggleable) ─── */}
            {showSearch && (
                <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl px-4 h-10 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                        <button onClick={handleSearchSubmit} className="flex items-center hover:text-primary transition-colors">
                            <span className="material-symbols-outlined text-slate-400 hover:text-primary text-xl transition-colors">search</span>
                        </button>
                        <input
                            autoFocus
                            className="flex-1 bg-transparent outline-none text-sm placeholder:text-slate-400"
                            placeholder="식재료 이름 검색..."
                            value={searchInput}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                        {searchInput && (
                            <button onClick={() => { setSearchInput(''); setSearchKeyword(''); }} className="text-slate-400 hover:text-primary transition-colors">
                                <span className="material-symbols-outlined text-base">close</span>
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* ─── Storage Type Filter Tabs ─── */}
            <div className="flex flex-col">
                <div className="flex border-b border-slate-200 dark:border-slate-800 px-4 gap-8">
                    {(['전체', '냉장', '냉동', '실온'] as StorageFilter[]).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setStorageFilter(tab)}
                            className={`flex flex-col items-center justify-center border-b-[3px] pb-[13px] pt-4 font-bold transition-colors ${
                                storageFilter === tab
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* ─── Item Grid ─── */}
            <div className="relative">
                {listLoading && (
                    <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 flex items-center justify-center z-10">
                        <span className="material-symbols-outlined animate-spin text-primary text-3xl">progress_activity</span>
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                    {activeItems.length === 0 ? (
                        <div className="col-span-full py-12 text-center text-slate-500">
                            <span className="material-symbols-outlined text-4xl mb-2 opacity-50">kitchen</span>
                            <p>
                                {searchKeyword
                                    ? `'${searchKeyword}'에 해당하는 식재료가 없습니다.`
                                    : storageFilter !== '전체'
                                        ? `${storageFilter} 보관 식재료가 없습니다.`
                                        : '냉장고가 비어있습니다.\n우측 상단의 + 버튼을 눌러 식재료를 추가해보세요.'
                                }
                            </p>
                        </div>
                    ) : (
                        activeItems.map(item => {
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
                                    onClick={() => handleEditItem(item)}
                                    className="flex items-center gap-4 p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group"
                                >
                                    {/* Icon Container (Small, not replacing whole image) */}
                                    <div className="flex-shrink-0 w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                        {getIngredientIcon(item.category, "w-6 h-6")}
                                    </div>
                                    
                                    {/* Info Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="text-base font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-primary transition-colors">
                                                {item.name}
                                            </p>
                                            {dDayDisplay}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                            {item.category && (
                                                <span className="truncate max-w-[80px]">{item.category}</span>
                                            )}
                                            {item.category && <span className="w-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-full opacity-50" />}
                                            <span className="font-medium text-slate-600 dark:text-slate-300">
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
                                    
                                    <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="material-symbols-outlined text-slate-300 dark:text-slate-600">chevron_right</span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {isModalOpen && selectedFridgeId && (
                <IngredientModal
                    fridgeId={selectedFridgeId}
                    existingItem={selectedItem}
                    onClose={() => handleModalClose(false)}
                    onSuccess={() => handleModalClose(true)}
                />
            )}
        </div>
    );
}

export default function FridgePage() {
    return (
        <Suspense
            fallback={
                <div className="flex flex-col flex-1 items-center justify-center py-20 text-slate-500">
                    <span className="material-symbols-outlined animate-spin text-primary text-4xl mb-2">progress_activity</span>
                    <p>냉장고 정보를 불러오는 중...</p>
                </div>
            }
        >
            <FridgePageContent />
        </Suspense>
    );
}
