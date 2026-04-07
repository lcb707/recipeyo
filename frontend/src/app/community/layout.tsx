import React from 'react';
import { BottomNav } from '@/components/layout/BottomNav';

export default function CommunityLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="relative flex h-auto min-h-screen w-full flex-col group/design-root overflow-x-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display">
            <div className="layout-container flex h-full grow flex-col">

                <main className="flex-1 flex justify-center py-8">
                    <div className="layout-content-container flex flex-col md:flex-row max-w-[1200px] flex-1 gap-8 px-4">
                        {children}
                    </div>
                </main>
                <BottomNav />
            </div>
        </div>
    );
}
