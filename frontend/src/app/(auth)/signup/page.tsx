'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { apiClient } from '@/api/client';
import Link from 'next/link';
import { ApiResponse } from '@/types';

export default function SignupPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [nickname, setNickname] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');

    const [isEmailVerified, setIsEmailVerified] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isEmailSending, setIsEmailSending] = useState(false);

    const handleSendVerifyCode = async () => {
        if (!email) {
            setError('이메일을 입력해주세요.');
            return;
        }
        setError('');
        setIsEmailSending(true);
        try {
            const res = await apiClient.post<ApiResponse<null>>('/api/v1/users/verify-email/', { email });
            if (res.data.status === 'success') {
                alert('인증번호가 발송되었습니다. 이메일을 확인해주세요.');
            } else {
                setError(res.data.message || '인증번호 발송 실패');
            }
        } catch (err: any) {
            setError(err.response?.data?.message || '인증 메일 발송 중 오류가 발생했습니다.');
        } finally {
            setIsEmailSending(false);
        }
    };

    const handleVerifyCode = async () => {
        if (!email || !code) {
            setError('이메일과 인증번호를 모두 입력해주세요.');
            return;
        }
        setError('');
        try {
            const res = await apiClient.patch<ApiResponse<null>>('/api/v1/users/verify-email/', { email, code });
            if (res.data.status === 'success') {
                setIsEmailVerified(true);
                alert('이메일 인증이 완료되었습니다.');
            } else {
                setError(res.data.message || '인증 실패');
            }
        } catch (err: any) {
            setError(err.response?.data?.message || '인증 확인 중 오류가 발생했습니다.');
        }
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isEmailVerified) {
            setError('이메일 인증을 먼저 완료해주세요.');
            return;
        }
        if (password !== passwordConfirm) {
            setError('비밀번호가 일치하지 않습니다.');
            return;
        }
        setError('');
        setIsLoading(true);

        try {
            const res = await apiClient.post<ApiResponse<any>>('/api/v1/users/', {
                email,
                nickname,
                password,
            });

            if (res.data.status === 'success') {
                router.push('/signup/completion');
            } else {
                setError(res.data.message || '회원가입에 실패했습니다.');
            }
        } catch (err: any) {
            setError(err.response?.data?.message || '회원가입 중 서버 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-[480px] bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden relative z-10 text-slate-900 dark:text-slate-100">
            <header className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-8 py-5">
                <div className="flex items-center gap-2 text-primary">
                    <div className="size-6">
                        <svg fill="currentColor" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                            <path d="M6 6H42L36 24L42 42H6L12 24L6 6Z"></path>
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold leading-tight tracking-tight">Recipio</h2>
                </div>
                <button
                    onClick={() => router.back()}
                    className="flex items-center justify-center rounded-lg h-10 w-10 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 transition-colors"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
            </header>

            <div className="px-8 pt-8 pb-4">
                <div className="flex flex-col gap-2 mb-8">
                    <h1 className="text-2xl font-bold">회원가입</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Recipio의 새로운 회원이 되어 다양한 레시피를 만나보세요.</p>
                </div>

                <form className="flex flex-col gap-5" onSubmit={handleSignup}>
                    {error && (
                        <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg">
                            {error}
                        </div>
                    )}

                    <div className="flex flex-col gap-2">
                        <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold">이메일</label>
                        <div className="flex gap-2">
                            <input
                                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent px-4 py-3 text-sm outline-none transition-all placeholder:text-slate-400"
                                placeholder="example@email.com"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={isEmailVerified}
                                required
                            />
                            <button
                                className="whitespace-nowrap px-4 py-2 bg-primary/10 text-primary font-bold text-sm rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50"
                                type="button"
                                onClick={handleSendVerifyCode}
                                disabled={isEmailSending || isEmailVerified}
                            >
                                {isEmailSending ? '발송 중...' : '인증번호 발송'}
                            </button>
                        </div>
                    </div>

                    {!isEmailVerified && (
                        <div className="flex flex-col gap-2">
                            <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold">인증번호</label>
                            <div className="flex gap-2">
                                <input
                                    className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent px-4 py-3 text-sm outline-none transition-all placeholder:text-slate-400"
                                    placeholder="6자리 숫자 입력"
                                    type="text"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                />
                                <button
                                    className="whitespace-nowrap px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-sm rounded-lg hover:bg-slate-200 transition-colors border border-slate-200 dark:border-slate-700"
                                    type="button"
                                    onClick={handleVerifyCode}
                                >
                                    인증하기
                                </button>
                            </div>
                        </div>
                    )}

                    <Input
                        label="닉네임"
                        type="text"
                        placeholder="사용하실 닉네임을 입력해주세요"
                        maxLength={50}
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        required
                        disabled={!isEmailVerified}
                    />

                    <Input
                        label="비밀번호"
                        type="password"
                        placeholder="영문, 숫자 포함 8자 이상"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={!isEmailVerified}
                        helperText="보안을 위해 8~20자의 영문, 숫자, 특수문자를 조합해주세요."
                    />

                    <Input
                        label="비밀번호 확인"
                        type="password"
                        placeholder="비밀번호를 다시 입력해주세요"
                        value={passwordConfirm}
                        onChange={(e) => setPasswordConfirm(e.target.value)}
                        required
                        disabled={!isEmailVerified}
                    />

                    <div className="mt-4">
                        <Button type="submit" fullWidth className="py-4 text-base" disabled={isLoading || !isEmailVerified}>
                            회원가입 완료
                        </Button>
                    </div>
                </form>

                <div className="mt-8 mb-4 text-center">
                    <Link href="/login" className="text-slate-500 dark:text-slate-400 text-sm hover:text-primary transition-colors inline-flex items-center gap-1">
                        로그인 화면으로 돌아가기
                    </Link>
                </div>
            </div>

            <div className="px-8 pb-8">
                <div className="w-full h-32 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent"></div>
                    <img
                        alt="Healthy food background"
                        className="w-full h-full object-cover"
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuA6S32L0Iaai1-8QBQtT3jDFI9kmaaV_h86vAkjnFQ6Pq7FM7EETmAq63PK97qc6qo_0yT_Aaxuwaxqr0f4J_z20Gxn3rPbdQGutq-sqIlJGUROUa_auE6lGoAAKUBg5evt6FziVpJXORq0yBElJMc7mwHDOdM7qBgIQXmfBWoM8ULg8KF8GnK8hk9ub-CwyWbYExNaOxKed0ti0H5qTrmWl11DUZIYh2pxXfsDF2RG6JyMAnBOiAz2wwq2TQggv3yhko_9LZzmY3Lv"
                    />
                    <div className="absolute bottom-4 left-4 right-4">
                        <p className="text-white text-xs font-medium bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full w-fit">나만의 레시피 보관소, Recipio</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
