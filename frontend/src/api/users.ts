import { apiClient as client } from './client';
import { ApiResponse, User } from '../types';

export interface UserActivityCounts {
    recipe_count: number;
    scrap_count: number;
    journal_count?: number;
    cooking_journal_count?: number;
    cooking_journals_count?: number;
    journals_count?: number;
}

// 사용자 활동 요약 수치 조회
export const getUserActivityCounts = async (): Promise<ApiResponse<UserActivityCounts>> => {
    const response = await client.get<ApiResponse<UserActivityCounts>>('/api/v1/users/me/counts/');
    return response.data;
};

// 현재 로그인한 유저 정보 조회
export const getMe = async (): Promise<ApiResponse<User>> => {
    const response = await client.get<ApiResponse<User>>('/api/v1/users/me/');
    return response.data;
};

// 유저 검색 (멤버 초대용)
export const searchUsers = async (keyword: string): Promise<ApiResponse<User[]>> => {
    const response = await client.get<ApiResponse<User[]>>('/api/v1/users/search/', {
        params: { keyword },
    });
    return response.data;
};

