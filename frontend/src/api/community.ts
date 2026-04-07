import { apiClient as client } from './client';
import { ApiResponse, PaginatedResult, Group, CookingJournal, ScrapFolder, Comment } from '../types';

// 내가 속한 그룹 목록 조회
export const getMyGroups = async (): Promise<ApiResponse<PaginatedResult<Group>>> => {
    const response = await client.get<ApiResponse<PaginatedResult<Group>>>('/api/v1/community/groups/');
    return response.data;
};

// 그룹 상세 및 멤버 조회
export const getGroupDetail = async (groupId: number): Promise<ApiResponse<Group>> => {
    const response = await client.get<ApiResponse<Group>>(`/api/v1/community/groups/${groupId}/`);
    return response.data;
};

// 그룹 요리 일지 목록 조회
export const getGroupJournals = async (groupId: number): Promise<ApiResponse<PaginatedResult<CookingJournal>>> => {
    const response = await client.get<ApiResponse<PaginatedResult<CookingJournal>>>(`/api/v1/community/groups/${groupId}/journals/`);
    return response.data;
};

// 스크랩 폴더 조회
export const getScrapFolders = async (): Promise<ApiResponse<ScrapFolder[]>> => {
    const response = await client.get<ApiResponse<ScrapFolder[]>>('/api/v1/community/scrap-folders/');
    return response.data;
};

// 내 요리 일지 목록 조회
export const getMyJournals = async (): Promise<ApiResponse<PaginatedResult<CookingJournal>>> => {
    const response = await client.get<ApiResponse<PaginatedResult<CookingJournal>>>('/api/v1/community/cooking-journals/');
    return response.data;
};

// 특정 요리 일지 상세 조회
export const getCookingJournal = async (journalId: number): Promise<ApiResponse<CookingJournal>> => {
    const response = await client.get<ApiResponse<CookingJournal>>(`/api/v1/community/cooking-journals/${journalId}/`);
    return response.data;
};

// 요리 일지 댓글 조회
export const getJournalComments = async (journalId: number): Promise<ApiResponse<PaginatedResult<Comment>>> => {
    const response = await client.get<ApiResponse<PaginatedResult<Comment>>>('/api/v1/community/comments/', {
        params: { journal_id: journalId }
    });
    return response.data;
};

// 그룹 피드용 일지 조회
export const getFeedJournals = async (params?: { page?: number; page_size?: number }): Promise<ApiResponse<PaginatedResult<CookingJournal>>> => {
    const response = await client.get<ApiResponse<PaginatedResult<CookingJournal>>>('/api/v1/community/cooking-journals/', { params });
    return response.data;
};

// 그룹 해체 (관리자 전용)
export const deleteGroup = async (groupId: number): Promise<ApiResponse<null>> => {
    const response = await client.delete<ApiResponse<null>>(`/api/v1/community/groups/${groupId}/`);
    return response.data;
};

// 그룹 탈퇴
export const leaveGroup = async (groupId: number): Promise<ApiResponse<null>> => {
    const response = await client.post<ApiResponse<null>>(`/api/v1/community/groups/${groupId}/leave/`);
    return response.data;
};

// 그룹 멤버 역할 변경 (ADMIN 이상)
export const updateMemberRole = async (groupId: number, userId: number, role: 'admin' | 'member'): Promise<ApiResponse<{group_id: number; user_id: number; role: string}>> => {
    const response = await client.patch<ApiResponse<{group_id: number; user_id: number; role: string}>>(`/api/v1/community/groups/${groupId}/members/${userId}/role/`, { role });
    return response.data;
};
