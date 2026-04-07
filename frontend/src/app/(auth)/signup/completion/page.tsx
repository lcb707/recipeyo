'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/common/Button';
import Link from 'next/link';

export default function SignupCompletionPage() {
    const router = useRouter();

    return (
        <div className="max-w-[480px] w-full bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden relative z-10">
            {/* Hero Image/Illustration Section */}
            <div className="p-8 pb-0 flex flex-col items-center">
                <div className="w-full aspect-video rounded-lg overflow-hidden relative bg-primary/5 flex items-center justify-center">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent"></div>
                    {/* Success Visualization */}
                    <div className="relative z-10 flex flex-col items-center gap-4">
                        <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center text-white shadow-lg shadow-primary/30">
                            <span className="material-symbols-outlined text-5xl">check_circle</span>
                        </div>
                    </div>
                    <div
                        className="absolute inset-0 opacity-10 bg-cover bg-center"
                        style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuD5W7k4HBm0Qya1bXlTU_xdgrPWL_iut1KHbv41SXkwvwqcsYBDw1GF-_CNtr8aynYkcnztNwLC8BKNQt3LjY6YJKKR7dJRKKeRgmnKzvHQxxdyM12No6KFeP7xMMf1xSscn5-gCw4QQSBATr1e_tSRl4OepiMScf7TOsIQFP6BDXD1Zqi6-_KB_DqU5W5bAwf-UzJEAq5oNaU4nmyOHHNu3clQ8piwqXo1iAya9psiYN5u6aFyOtMtGmJ5FSdMJ3yC03MdaqviTP0z")' }}
                    ></div>
                </div>
            </div>

            {/* Text Content */}
            <div className="p-8 text-center">
                <h1 className="text-slate-900 dark:text-slate-100 text-3xl font-bold leading-tight tracking-tight mb-4 font-display">
                    회원가입을 축하합니다!
                </h1>
                <p className="text-slate-600 dark:text-slate-400 text-base font-normal leading-relaxed mb-8">
                    환영합니다, Recipio의 회원이 되셨습니다!<br />
                    이제 로그인하여 냉장고를 관리하고<br />
                    신선한 레시피 생활을 시작해보세요.
                </p>

                {/* Primary Action */}
                <div className="flex flex-col gap-3">
                    <Button onClick={() => router.push('/login')} className="h-14 text-lg">
                        로그인하러 가기
                    </Button>

                    {/* Secondary Action */}
                    <Link href="/" className="w-full flex items-center justify-center rounded-xl h-12 bg-transparent text-slate-500 hover:text-primary transition-colors text-sm font-medium">
                        홈페이지 둘러보기
                    </Link>
                </div>
            </div>

            {/* Bottom Decorative Element */}
            <div className="h-1.5 w-full bg-primary/10 flex">
                <div className="h-full w-1/3 bg-primary"></div>
                <div className="h-full w-2/3 bg-transparent"></div>
            </div>
        </div>
    );
}
