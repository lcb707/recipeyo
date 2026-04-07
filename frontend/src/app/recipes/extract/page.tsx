"use client";

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { importYoutubeRecipe } from '@/api/recipes';

const YOUTUBE_URL_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[A-Za-z0-9_-]{6,}$/i;

export default function RecipeExtractPage() {
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [resultMessage, setResultMessage] = useState('');
    const [createdRecipeId, setCreatedRecipeId] = useState<number | null>(null);
    const [jobId, setJobId] = useState<string | null>(null);

    const isValidUrl = useMemo(() => YOUTUBE_URL_REGEX.test(youtubeUrl.trim()), [youtubeUrl]);

    const resetResult = () => {
        setError('');
        setResultMessage('');
        setCreatedRecipeId(null);
        setJobId(null);
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        resetResult();

        if (!isValidUrl) {
            setError('유효한 유튜브 URL을 입력해주세요.');
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await importYoutubeRecipe({
                youtube_url: youtubeUrl.trim(),
                async: true,
            });

            if (response.status === 'success') {
                setResultMessage(response.message || '요청이 정상 처리되었습니다.');
                setCreatedRecipeId(response.data?.recipe_id ?? null);
                setJobId(response.data?.job_id ?? null);
            } else {
                setError(response.message || '요청 처리에 실패했습니다.');
            }
        } catch (err: any) {
            setError(err?.response?.data?.message || '요청 중 오류가 발생했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="max-w-3xl mx-auto w-full px-4 md:px-10 py-10">
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 md:p-8">
                <div className="mb-6">
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">레시피 추출</h1>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        유튜브 URL을 입력하면 레시피 초안을 자동 생성합니다. 인증된 사용자만 요청할 수 있습니다.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <Input
                        label="유튜브 URL"
                        name="youtube_url"
                        placeholder="https://www.youtube.com/watch?v=xxxxxxxxxxx"
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        required
                        helperText={
                            <span>
                                형식: <code>youtube.com/watch?v=...</code> 또는 <code>youtu.be/...</code>
                                {' '}| 20분 이하 영상만 추출 가능합니다.
                            </span>
                        }
                    />

                    {error && (
                        <div className="rounded-xl border border-red-200 bg-red-50 text-red-600 px-4 py-3 text-sm">
                            {error}
                        </div>
                    )}

                    {resultMessage && (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 px-4 py-3 text-sm space-y-1">
                            <p>{resultMessage}</p>
                            {createdRecipeId && (
                                <p>
                                    생성된 레시피: <Link className="font-semibold underline" href={`/recipes/${createdRecipeId}`}>#{createdRecipeId}</Link>
                                </p>
                            )}
                            {jobId && <p>작업 ID: {jobId}</p>}
                        </div>
                    )}

                    <Button type="submit" disabled={isSubmitting} fullWidth className="h-11">
                        {isSubmitting ? '추출 요청 중...' : '레시피 추출 요청'}
                    </Button>
                </form>
            </section>
        </main>
    );
}
