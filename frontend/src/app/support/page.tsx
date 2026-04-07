import React from 'react';
import { ComingSoonPage } from '@/components/common/ComingSoonPage';

export default function SupportPage() {
    return (
        <div className="min-h-[calc(100vh-220px)] flex items-center justify-center px-4">
            <ComingSoonPage
                title="고객센터 준비 중"
                description="고객센터 페이지를 준비 중입니다. 빠른 시일 내에 문의 기능을 제공하겠습니다."
            />
        </div>
    );
}
