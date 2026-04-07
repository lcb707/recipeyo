'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { apiClient } from '@/api/client';
import { ApiResponse, User } from '@/types';

export default function ProfileEditPage() {
    const router = useRouter();
    const { user, refreshUser } = useUser();
    
    const [nickname, setNickname] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (user) {
            setNickname(user.nickname);
            setImagePreview(user.profile_image);
            setIsLoading(false);
        }
    }, [user]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        if (newPassword && newPassword !== confirmPassword) {
            alert('새 비밀번호가 일치하지 않습니다.');
            return;
        }

        setIsSaving(true);
        try {
            const formData = new FormData();
            formData.append('nickname', nickname);
            if (imageFile) {
                formData.append('profile_image', imageFile);
            }
            if (newPassword) {
                formData.append('current_password', currentPassword);
                formData.append('new_password', newPassword);
            }

            const res = await apiClient.patch<ApiResponse<User>>('/api/v1/users/me/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data.status === 'success') {
                alert('회원 정보가 성공적으로 수정되었습니다.');
                await refreshUser(); // Update global context
                setImageFile(null);
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
            } else {
                alert(res.data.message || '정보 수정에 실패했습니다.');
            }
        } catch (err: any) {
            alert(err.response?.data?.message || '서버 오류가 발생했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (confirm('정말로 회원 탈퇴를 진행하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
            try {
                const res = await apiClient.delete('/api/v1/users/me/');
                if (res.status === 204 || res.data?.status === 'success') {
                    alert('계정이 삭제되었습니다.');
                    localStorage.removeItem('access');
                    localStorage.removeItem('refresh');
                    document.cookie = 'access=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                    router.push('/login');
                }
            } catch (err) {
                alert('회원 탈퇴 처리 중 오류가 발생했습니다.');
            }
        }
    };

    if (isLoading) {
        return <div className="flex justify-center py-20"><span className="material-symbols-outlined max-w-fit animate-spin text-primary">progress_activity</span></div>;
    }

    return (
        <div className="w-full max-w-[560px] mx-auto">
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">회원 정보 수정</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-2">프로필 정보를 업데이트하고 계정을 안전하게 관리하세요.</p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="p-8 space-y-8">
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative group">
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept="image/*" 
                                onChange={handleImageChange}
                            />
                            <div className="size-24 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-primary/20 shadow-inner">
                                {imagePreview ? (
                                    <img src={imagePreview} alt="Profile Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="material-symbols-outlined text-4xl text-slate-300">person</span>
                                )}
                            </div>
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute bottom-0 right-0 bg-primary text-white size-8 rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform border-2 border-white dark:border-slate-900"
                            >
                                <span className="material-symbols-outlined text-sm">photo_camera</span>
                            </button>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">이메일</label>
                            <div className="flex items-center h-12 px-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 cursor-not-allowed">
                                <span>{user?.email || 'user@example.com'}</span>
                                <span className="material-symbols-outlined ml-auto text-sm">lock</span>
                            </div>
                            <p className="text-xs text-slate-400 italic">이메일 주소는 변경할 수 없습니다.</p>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="nickname">닉네임</label>
                            <input
                                id="nickname"
                                type="text"
                                className="h-12 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                maxLength={50}
                                placeholder="변경할 닉네임을 입력하세요"
                                value={nickname}
                                onChange={(e) => setNickname(e.target.value)}
                            />
                            <div className="flex justify-between items-center">
                                <p className="text-xs text-slate-500">최대 50자까지 입력 가능합니다.</p>
                                <span className="text-xs text-slate-400">{nickname.length}/50</span>
                            </div>
                        </div>

                        <hr className="border-slate-100 dark:border-slate-800" />

                        <div className="space-y-4">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">security</span>
                                비밀번호 변경
                            </h3>

                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-slate-600 dark:text-slate-400" htmlFor="current-pw">현재 비밀번호</label>
                                <input
                                    id="current-pw"
                                    type="password"
                                    className="h-12 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                    placeholder="현재 비밀번호를 입력하세요"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-slate-600 dark:text-slate-400" htmlFor="new-pw">새 비밀번호</label>
                                <input
                                    id="new-pw"
                                    type="password"
                                    className="h-12 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                    placeholder="새로운 비밀번호를 입력하세요"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-slate-600 dark:text-slate-400" htmlFor="confirm-pw">새 비밀번호 확인</label>
                                <input
                                    id="confirm-pw"
                                    type="password"
                                    className="h-12 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                    placeholder="새 비밀번호를 다시 한 번 입력하세요"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 space-y-3">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="w-full h-14 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isSaving ? '저장 중...' : '변경사항 저장'}
                        </button>
                        <button
                            onClick={() => router.back()}
                            className="w-full h-14 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-lg transition-all"
                        >
                            취소
                        </button>
                    </div>
                </div>
            </div>

            <div className="mt-8 flex justify-center pb-20">
                <button onClick={handleDeleteAccount} className="group flex items-center gap-1 text-slate-400 hover:text-red-500 transition-colors">
                    <span className="material-symbols-outlined text-sm">no_accounts</span>
                    <span className="text-sm font-medium decoration-dotted underline underline-offset-4">회원 탈퇴</span>
                </button>
            </div>
        </div>
    );
}
