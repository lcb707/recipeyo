import React from 'react';

interface ComingSoonPageProps {
    title: string;
    description?: string;
}

export const ComingSoonPage: React.FC<ComingSoonPageProps> = ({
    title,
    description = '현재 페이지를 준비 중입니다. 곧 사용할 수 있도록 업데이트하겠습니다.',
}) => {
    return (
        <section className="w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-10 md:p-14">
            <div className="max-w-2xl mx-auto text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <span className="material-symbols-outlined">construction</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">{title}</h1>
                <p className="mt-3 text-sm md:text-base text-slate-500 dark:text-slate-400">{description}</p>
            </div>
        </section>
    );
};
