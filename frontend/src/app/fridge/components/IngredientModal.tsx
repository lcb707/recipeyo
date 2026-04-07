"use client";

import React, { useState, useEffect } from 'react';
import { addFridgeItem, updateFridgeItem, deleteFridgeItem, getStandardIngredients } from '@/api/fridge';
import { FridgeItem, StandardIngredient } from '@/types';

interface IngredientModalProps {
    fridgeId: number;
    existingItem: FridgeItem | null;
    onClose: () => void;
    onSuccess: () => void;
}

export function IngredientModal({ fridgeId, existingItem, onClose, onSuccess }: IngredientModalProps) {
    const isEdit = !!existingItem;
    
    const [name, setName] = useState(existingItem?.name || '');
    const [quantity, setQuantity] = useState(existingItem?.quantity || '1');
    const [unit, setUnit] = useState(existingItem?.unit || '개');
    const [expiryDate, setExpiryDate] = useState(existingItem?.expiry_date ? String(existingItem.expiry_date).substring(0, 10) : '');
    const [status, setStatus] = useState<'ACTIVE' | 'CONSUMED' | 'EXPIRED' | 'DISCARDED'>(existingItem?.status || 'ACTIVE');
    const [memo, setMemo] = useState(existingItem?.memo || '');
    const [loading, setLoading] = useState(false);

    const [searchResults, setSearchResults] = useState<StandardIngredient[]>([]);

    useEffect(() => {
        if (!isEdit && name.length > 1) {
            const timer = setTimeout(async () => {
                try {
                    const res = await getStandardIngredients({ search: name, limit: 5 });
                    if (res.status === 'success') {
                        const sData = res.data as any;
                        setSearchResults(Array.isArray(sData) ? sData : (sData?.results || []));
                    }
                } catch (e) {
                    console.error(e);
                }
            }, 300);
            return () => clearTimeout(timer);
        } else {
            setSearchResults([]);
        }
    }, [name, isEdit]);

    const handleSelectStandard = (ingredient: StandardIngredient) => {
        setName(ingredient.name);
        setUnit(ingredient.default_unit);
        setSearchResults([]);
        
        // Calculate expiry date if not set
        if (!expiryDate && ingredient.default_expiry_days) {
            const date = new Date();
            date.setDate(date.getDate() + ingredient.default_expiry_days);
            setExpiryDate(date.toISOString().substring(0, 10));
        }
    };

    const handleSave = async () => {
        if (!name.trim()) {
            alert('식재료명을 입력해주세요.');
            return;
        }

        try {
            setLoading(true);
            if (isEdit) {
                await updateFridgeItem(existingItem.id, {
                    quantity,
                    expiry_date: expiryDate || null,
                    status,
                    memo
                });
            } else {
                await addFridgeItem(fridgeId, {
                    name,
                    quantity,
                    unit,
                    expiry_date: expiryDate || null,
                    memo
                });
            }
            onSuccess();
        } catch (error: any) {
            console.error(error);
            alert(error.response?.data?.message || '저장 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!isEdit) return;
        if (confirm('정말 삭제하시겠습니까?')) {
            try {
                setLoading(true);
                await deleteFridgeItem(existingItem.id);
                onSuccess();
            } catch (error: any) {
                alert(error.response?.data?.message || '삭제 중 오류가 발생했습니다.');
                setLoading(false);
            }
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-[520px] bg-white dark:bg-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                        {isEdit ? '식재료 정보 수정' : '식재료 추가'}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="p-6 space-y-5 overflow-y-auto hide-scrollbar flex-1">
                    <div className="relative">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">식재료명 {isEdit && '(수정 불가)'}</label>
                        <input 
                            className={`w-full rounded-xl border-none bg-slate-50 dark:bg-slate-900 px-4 py-3.5 focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-slate-100 ${isEdit ? 'opacity-70 cursor-not-allowed text-primary font-bold' : ''}`}
                            type="text" 
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="예: 당근, 우유"
                            disabled={isEdit}
                        />
                        {!isEdit && searchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-100 dark:border-slate-700 z-10 overflow-hidden">
                                {searchResults.map(ing => (
                                    <button 
                                        key={ing.id} 
                                        onClick={() => handleSelectStandard(ing)}
                                        className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-3 border-b last:border-b-0 border-slate-50 dark:border-slate-700/50"
                                    >
                                        <div className="size-10 rounded-lg bg-slate-100 dark:bg-slate-900 flex items-center justify-center overflow-hidden flex-shrink-0 border border-slate-200 dark:border-slate-700">
                                            {ing.icon_image ? (
                                                <img src={ing.icon_image} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="material-symbols-outlined text-slate-400 text-xl">
                                                    {ing.icon_url || 'kitchen'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{ing.name}</span>
                                                <span className="text-[10px] text-slate-400 font-bold border border-slate-200 dark:border-slate-600 rounded px-1.5 py-0.5 uppercase tracking-tighter shrink-0">{ing.category}</span>
                                            </div>
                                            <p className="text-[11px] text-slate-500 truncate mt-0.5">기본 수량: {ing.default_unit} / 권장 기한: {ing.default_expiry_days}일</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">수량</label>
                            <input 
                                className="w-full rounded-xl border-none bg-slate-50 dark:bg-slate-900 px-4 py-3.5 focus:ring-2 focus:ring-primary/50" 
                                type="number" 
                                value={quantity}
                                onChange={e => setQuantity(e.target.value)}
                            />
                        </div>
                        <div className="w-1/3 relative">
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">단위 {!isEdit && '(선택)'}</label>
                            <select 
                                className="w-full rounded-xl appearance-none border-none bg-slate-50 dark:bg-slate-900 px-4 py-3.5 focus:ring-2 focus:ring-primary/50"
                                value={unit}
                                onChange={e => setUnit(e.target.value)}
                                disabled={isEdit && !unit /* editing without changing fundamental base if possible, but actually we let them edit unit if they want? Wait API patch doesnt say unit is editable, wait the API doc says "수량, 유통기한, 상태, 메모만 수정 가능" for PATCH. So unit is read-only. */}
                            >
                                <option value="개">개</option>
                                <option value="팩">팩</option>
                                <option value="g">g</option>
                                <option value="kg">kg</option>
                                <option value="L">L</option>
                                <option value="ml">ml</option>
                                <option value="단">단</option>
                            </select>
                            <div className="absolute inset-y-0 right-4 top-[30px] flex items-center pointer-events-none">
                                <span className="material-symbols-outlined text-slate-400">expand_more</span>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">유통기한</label>
                        <input 
                            className="w-full rounded-xl border-none bg-slate-50 dark:bg-slate-900 px-4 py-3.5 focus:ring-2 focus:ring-primary/50" 
                            type="date" 
                            value={expiryDate}
                            onChange={e => setExpiryDate(e.target.value)}
                        />
                    </div>

                    {isEdit && (
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">상태</label>
                            <select 
                                className="w-full rounded-xl border-none bg-slate-50 dark:bg-slate-900 px-4 py-3.5 focus:ring-2 focus:ring-primary/50"
                                value={status}
                                onChange={e => setStatus(e.target.value as any)}
                            >
                                <option value="ACTIVE">보관 중 (ACTIVE)</option>
                                <option value="CONSUMED">소비 완료 (CONSUMED)</option>
                                <option value="EXPIRED">기한 만료 (EXPIRED)</option>
                                <option value="DISCARDED">폐기 (DISCARDED)</option>
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">메모</label>
                        <textarea 
                            className="w-full rounded-xl border-none bg-slate-50 dark:bg-slate-900 px-4 py-3.5 focus:ring-2 focus:ring-primary/50 min-h-[80px] resize-none" 
                            placeholder="메모를 입력하세요..."
                            value={memo}
                            onChange={e => setMemo(e.target.value)}
                        />
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex gap-3 bg-white dark:bg-slate-800">
                    {isEdit && (
                        <button 
                            onClick={handleDelete}
                            disabled={loading}
                            className="flex-1 h-14 border border-red-500 text-red-500 font-bold rounded-xl transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                            삭제
                        </button>
                    )}
                    <button 
                        onClick={handleSave}
                        disabled={loading}
                        className="flex-[2] h-14 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl transition-colors shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                    >
                        {loading ? '저장 중...' : (isEdit ? '수정 완료' : '냉장고에 추가')}
                        {!loading && !isEdit && <span className="material-symbols-outlined">add_circle</span>}
                    </button>
                </div>
            </div>
        </div>
    );
}
