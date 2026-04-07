'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import Link from 'next/link';

export default function ResetPasswordPage() {
    const router = useRouter();

    const handleResetPassword = (e: React.FormEvent) => {
        e.preventDefault();
        alert('비밀번호 재설정 기능은 현재 준비 중입니다.');
    };

    return (
        <div className="w-full max-w-[480px] bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden relative z-10">
            <header className="flex items-center justify-between border-b border-solid border-slate-100 dark:border-slate-800 px-8 py-6">
                <div className="flex items-center gap-3">
                    <div className="text-primary">
                        <svg className="size-8" fill="currentColor" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                            <path d="M6 6H42L36 24L42 42H6L12 24L6 6Z"></path>
                        </svg>
                    </div>
                    <h2 className="text-slate-900 dark:text-slate-100 text-2xl font-bold leading-tight tracking-tight">Recipio</h2>
                </div>
                <button
                    onClick={() => router.back()}
                    className="flex items-center justify-center rounded-lg h-10 w-10 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 transition-colors"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
            </header>

            <div className="p-8">
                <div className="mb-8">
                    <div className="w-full h-48 mb-6 rounded-xl overflow-hidden bg-primary/10 flex items-center justify-center">
                        <div
                            className="relative w-full h-full bg-cover bg-center"
                            style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCSbwUe7IQuYfiqVjUJnDDMh72O0Can_rGF6HHJw12UQqzZfttbMRPl-8mDbIMf3UihJ_GnDtTevEpt-WjNTQGxvnBPc2fWyWbmTtGIm-SertLWFpXX697AoDhlO1TXwI8vlVHCSgTEhBvCGQo4gT-pREJxONdwH8ujnETaA_KbGPHLHQXzBtgGJR4OFYyRAZx_BphCbp0jP2hitvGkLgiSYXWVZ2XDusiDeUpl_zkAzMnJGsalByLl4l23pnIHtply-HdV8qa5ZBYF")' }}
                        ></div>
                    </div>
                    <h1 className="text-slate-900 dark:text-slate-100 text-3xl font-bold leading-tight mb-3">비밀번호 재설정</h1>
                    <p className="text-slate-600 dark:text-slate-400 text-base font-normal leading-relaxed">
                        가입하신 이메일 주소를 입력하시면 비밀번호 재설정 안내 메일을 보내드립니다.
                    </p>
                </div>

                <form className="flex flex-col gap-6" onSubmit={handleResetPassword}>
                    <div className="flex flex-col gap-2">
                        <Input
                            label="이메일"
                            type="email"
                            placeholder="example@email.com"
                            required
                        />
                    </div>

                    <Button type="submit" className="h-14 text-lg">
                        <span>인증 메일 발송</span>
                        <span className="material-symbols-outlined text-xl">send</span>
                    </Button>
                </form>

                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-center">
                    <Link href="/login" className="text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary text-sm font-medium transition-colors flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">login</span>
                        로그인 화면으로 돌아가기
                    </Link>
                </div>
            </div>

            <footer className="mt-8 pb-4 text-center text-slate-400 dark:text-slate-600 text-xs">
                © 2024 Recipio. All rights reserved.
            </footer>
        </div>
    );
}
