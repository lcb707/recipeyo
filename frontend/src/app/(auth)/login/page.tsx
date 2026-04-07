'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/common/Button';
import { apiClient } from '@/api/client';
import { ApiResponse, LoginResponse } from '@/types';
import Link from 'next/link';
import { Input } from '@/components/common/Input';
import { useUser } from '@/context/UserContext';

export default function LoginPage() {
    const router = useRouter();
    const { refreshUser } = useUser();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const response = await apiClient.post<ApiResponse<LoginResponse>>('/api/v1/users/login/', {
                email,
                password,
            });

            if (response.data.status === 'success') {
                const { access_token, refresh_token } = response.data.data;

                // Save to localStorage as per constraints
                localStorage.setItem('access', access_token);
                localStorage.setItem('refresh', refresh_token);

                // ALSO save to cookies for Next.js middleware
                document.cookie = `access=${access_token}; path=/; max-age=86400; SameSite=Lax`;
                document.cookie = `refresh=${refresh_token}; path=/; max-age=604800; SameSite=Lax`;

                // 유저 정보 가져오기 (전역 상태에 즉시 반영)
                await refreshUser();

                router.push('/');
            } else {
                setError(response.data.message || '로그인에 실패했습니다.');
            }
        } catch (err: any) {
            if (err.response?.data?.message) {
                setError(err.response.data.message);
            } else {
                setError('서버와 통신 중 오류가 발생했습니다.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md bg-white dark:bg-slate-900 shadow-xl rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 z-10 relative">
            {/* Logo Section */}
            <div className="pt-10 pb-6 px-8 text-center">
                <div className="flex items-center justify-center gap-2 mb-4">
                    <div className="text-primary size-8">
                        <svg fill="currentColor" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                            <path d="M6 6H42L36 24L42 42H6L12 24L6 6Z"></path>
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-primary">Recipio</h1>
                </div>
                <p className="text-slate-600 dark:text-slate-400 font-medium">즐거운 요리 생활의 시작, 레시피오</p>
            </div>

            {/* Form Section */}
            <div className="px-8 pb-10">
                <form className="space-y-5" onSubmit={handleLogin}>
                    {error && (
                        <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg">
                            {error}
                        </div>
                    )}

                    <div>
                        <Input
                            label="이메일"
                            type="email"
                            name="email"
                            placeholder="example@email.com"
                            icon="mail"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-0">
                            {/* Note: Input handles the label, I will wrap it */}
                        </div>
                        <Input
                            label="비밀번호"
                            type="password"
                            name="password"
                            placeholder="••••••••"
                            icon="lock"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        <div className="flex justify-end mt-1">
                            <Link href="/reset-password" className="text-xs font-medium text-primary hover:underline">
                                비밀번호를 잊으셨나요?
                            </Link>
                        </div>
                    </div>

                    <Button type="submit" fullWidth disabled={isLoading} className="py-3.5 mt-2">
                        {isLoading ? '로그인 중...' : '로그인'}
                    </Button>

                    <div className="relative flex items-center py-2">
                        <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                        <span className="flex-shrink mx-4 text-slate-400 text-xs font-medium uppercase">또는</span>
                        <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                    </div>

                    <Button type="button" variant="outline" fullWidth className="py-3">
                        <img
                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDAtBmwSgx_dR0WlYhszrrpNwYN8HQlOASvM2kYUzLtCMMmkj_K8kvuKBHffpynFvM28MMnEbwAFGUjyMjpCCKoG4H1kTr-3-m5qZ9cXj8tuJGAoaIv9Arqyjefapw-t035P73U_MOp25LPyNhpFOzbovNAtPMoUtxqkRfnFM5jtmiCQP1_b9WjjtvgDBhpJogNTLBUA6fXSFXL4z4TYnSAKKbqFTwEnCcP9gweRySF8NpCOG1IY1haJa_Q35tejnueMabkSdJKLgLx"
                            alt="Google Icon"
                            className="w-5 h-5 mr-1"
                        />
                        구글로 시작하기
                    </Button>
                </form>

                <p className="mt-8 text-center text-slate-600 dark:text-slate-400 text-sm">
                    아직 회원이 아니신가요?
                    <Link href="/signup" className="text-primary font-bold hover:underline ml-1">
                        회원가입
                    </Link>
                </p>
            </div>

            <div className="h-2 bg-gradient-to-r from-primary/40 via-primary to-primary/40"></div>
        </div>
    );
}
