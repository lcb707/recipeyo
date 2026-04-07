'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Folder, FolderPlus, BookmarkCheck, Pencil, Trash2, ChevronLeft, ChevronRight, LayoutGrid } from 'lucide-react';
import { getScrapFolders, createScrapFolder, updateScrapFolder, deleteScrapFolder } from '@/api/recipes';
import type { ScrapFolder } from '@/types';
import ConfirmModal from '@/components/ConfirmModal';

const PAGE_SIZE = 6;

export default function ScrapsPage() {
    const router = useRouter();

    const [folders, setFolders] = useState<ScrapFolder[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    // Modal States
    const [isNameModalOpen, setIsNameModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [targetFolder, setTargetFolder] = useState<ScrapFolder | null>(null);
    const [nameInputValue, setNameInputValue] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [folderToDelete, setFolderToDelete] = useState<number | null>(null);

    const fetchFolders = async () => {
        try {
            setIsLoading(true);
            const res = await getScrapFolders();
            if (res.status === 'success') {
                setTotalCount(res.data.length);
                // 클라이언트 사이드 페이지네이션
                const start = (currentPage - 1) * PAGE_SIZE;
                setFolders(res.data.slice(start, start + PAGE_SIZE));
            }
        } catch (error) {
            console.error('Failed to fetch scrap folders', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchFolders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage]);

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    // Handlers
    const handleOpenCreateModal = () => {
        setModalMode('create');
        setNameInputValue('');
        setTargetFolder(null);
        setIsNameModalOpen(true);
    };

    const handleOpenEditModal = (e: React.MouseEvent, folder: ScrapFolder) => {
        e.stopPropagation();
        setModalMode('edit');
        setTargetFolder(folder);
        setNameInputValue(folder.name);
        setIsNameModalOpen(true);
    };

    const handleNameSubmit = async () => {
        if (!nameInputValue.trim() || isSaving) return;
        try {
            setIsSaving(true);
            if (modalMode === 'create') {
                await createScrapFolder(nameInputValue.trim());
            } else if (modalMode === 'edit' && targetFolder) {
                await updateScrapFolder(targetFolder.id, nameInputValue.trim());
            }
            setIsNameModalOpen(false);
            fetchFolders();
        } catch (error) {
            console.error('Failed to save scrap folder', error);
            alert('폴더 저장에 실패했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleOpenDeleteConfirm = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        setFolderToDelete(id);
        setIsConfirmOpen(true);
    };

    const handleDelete = async () => {
        if (!folderToDelete) return;
        try {
            await deleteScrapFolder(folderToDelete);
            setIsConfirmOpen(false);
            setFolderToDelete(null);
            if (folders.length === 1 && currentPage > 1) {
                setCurrentPage(prev => prev - 1);
            } else {
                fetchFolders();
            }
        } catch (error) {
            console.error('Failed to delete scrap folder', error);
            alert('폴더 삭제에 실패했습니다.');
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col flex-1 overflow-hidden relative">
            <main className="flex-1 overflow-y-auto w-full p-6 lg:p-10">
                <div className="mx-auto max-w-5xl pb-10">
                    {/* Header */}
                    <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <BookmarkCheck className="text-primary" size={22} />
                                <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">스크랩 폴더</h1>
                            </div>
                            <p className="text-slate-500 dark:text-slate-400 text-sm">
                                마음에 드는 레시피를 폴더별로 저장하고 관리하세요.
                                {!isLoading && <span className="ml-2 font-semibold text-primary">{totalCount}개</span>}
                            </p>
                        </div>
                        <button
                            onClick={handleOpenCreateModal}
                            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-primary/20 hover:bg-primary/90 active:scale-95 transition-all"
                        >
                            <FolderPlus size={18} />
                            새 폴더 만들기
                        </button>
                    </div>

                    {/* Folder Grid */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {isLoading ? (
                            Array.from({ length: PAGE_SIZE }).map((_, i) => (
                                <div key={i} className="animate-pulse rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 h-40" />
                            ))
                        ) : folders.length > 0 ? (
                            folders.map((folder) => (
                                <div
                                    key={folder.id}
                                    onClick={() => router.push(`/mypage/scraps/${folder.id}`)}
                                    className="group relative flex flex-col justify-between rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 cursor-pointer transition-all hover:shadow-lg hover:border-primary/40 hover:-translate-y-0.5"
                                >
                                    {/* Top Row */}
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                                            <Folder size={24} />
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                onClick={(e) => handleOpenEditModal(e, folder)}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors"
                                                title="편집"
                                            >
                                                <Pencil size={15} />
                                            </button>
                                            <button
                                                onClick={(e) => handleOpenDeleteConfirm(e, folder.id)}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                                title="삭제"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Bottom Content */}
                                    <div>
                                        <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base leading-snug line-clamp-1">{folder.name}</h3>
                                        <div className="flex items-center gap-1.5 mt-1.5">
                                            <LayoutGrid size={13} className="text-slate-400" />
                                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                                레시피 <span className="font-semibold text-slate-700 dark:text-slate-300">{folder.scrap_count}</span>개
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full py-24 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-800/30">
                                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 mb-4">
                                    <Folder className="text-slate-400" size={32} />
                                </div>
                                <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">스크랩 폴더가 없습니다</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 mb-5">
                                    새 폴더를 만들어 마음에 드는 레시피를 저장해보세요.
                                </p>
                                <button
                                    onClick={handleOpenCreateModal}
                                    className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-primary/20 hover:bg-primary/90 transition-all"
                                >
                                    <FolderPlus size={16} />
                                    첫 폴더 만들기
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    {!isLoading && totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-8">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:border-primary hover:text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <button
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    className={`w-9 h-9 rounded-lg text-sm font-bold transition-all ${
                                        currentPage === page
                                            ? 'bg-primary text-white shadow-md shadow-primary/30'
                                            : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-primary hover:text-primary'
                                    }`}
                                >
                                    {page}
                                </button>
                            ))}
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:border-primary hover:text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    )}
                </div>
            </main>

            {/* Create/Edit Folder Modal */}
            {isNameModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden">
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                                    <FolderPlus className="text-primary" size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                        {modalMode === 'create' ? '새 폴더 만들기' : '폴더 이름 수정'}
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {modalMode === 'create' ? '저장할 폴더의 이름을 입력해주세요.' : '변경할 이름을 입력해주세요.'}
                                    </p>
                                </div>
                            </div>
                            <input
                                type="text"
                                autoFocus
                                value={nameInputValue}
                                onChange={(e) => setNameInputValue(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
                                placeholder="예: 주말 요리 모음"
                                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all dark:text-white text-sm"
                            />
                        </div>
                        <div className="flex border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 p-4 gap-3">
                            <button
                                onClick={() => setIsNameModalOpen(false)}
                                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-sm text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleNameSubmit}
                                disabled={!nameInputValue.trim() || isSaving}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-primary font-bold text-sm text-white hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSaving ? '저장 중...' : '확인'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={isConfirmOpen}
                title="폴더 삭제"
                message="이 폴더를 삭제하시겠습니까? 폴더 안의 스크랩 내역도 함께 정리됩니다."
                confirmText="삭제하기"
                cancelText="취소"
                onConfirm={handleDelete}
                onCancel={() => setIsConfirmOpen(false)}
                isDestructive={true}
            />
        </div>
    );
}
