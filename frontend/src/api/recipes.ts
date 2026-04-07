import { apiClient as client } from './client';
import { ApiResponse, Recipe, PaginatedResult, ScrapFolder } from '../types';

// 레시피 목록 조회 (페이지네이션/검색 지원)
export const getMyRecipes = async (page: number = 1, limit: number = 6, search: string = ''): Promise<ApiResponse<PaginatedResult<Recipe>>> => {
    const params: any = { page, page_size: limit };
    if (search.trim()) {
        params.search = search.trim();
        params.keyword = search.trim(); // keyword 파라미터도 지원 루틴 추가
    }
    const response = await client.get<ApiResponse<PaginatedResult<Recipe>>>('/api/v1/recipes/me/', { params });
    return response.data;
};

// 레시피 상세 조회
export const getRecipe = async (recipeId: number): Promise<ApiResponse<Recipe>> => {
    const response = await client.get<ApiResponse<Recipe>>(`/api/v1/recipes/${recipeId}/`);
    return response.data;
};

// 레시피 다중 삭제
export const bulkDeleteRecipes = async (recipeIds: number[]): Promise<ApiResponse<void>> => {
    // Axios DELETE accepts data in the config object
    const response = await client.delete<ApiResponse<void>>('/api/v1/recipes/bulk-delete/', {
        data: { recipe_ids: recipeIds }
    });
    return response.data;
};

// 레시피 생성 (FormData 멀티파트 지원)
export const createRecipe = async (formData: FormData): Promise<ApiResponse<Recipe>> => {
    const response = await client.post<ApiResponse<Recipe>>('/api/v1/recipes/', formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });
    return response.data;
};


// 스크랩 폴더 조회 (레시피 상세용)
export const getScrapFolders = async (): Promise<ApiResponse<ScrapFolder[]>> => {
    const response = await client.get<ApiResponse<ScrapFolder[]>>('/api/v1/community/scrap-folders/');
    return response.data;
};

// 스크랩 폴더 생성
export const createScrapFolder = async (name: string): Promise<ApiResponse<ScrapFolder>> => {
    const response = await client.post<ApiResponse<ScrapFolder>>('/api/v1/community/scrap-folders/', { name });
    return response.data;
};

// 스크랩 폴더 이름 수정
export const updateScrapFolder = async (folderId: number, name: string): Promise<ApiResponse<ScrapFolder>> => {
    const response = await client.patch<ApiResponse<ScrapFolder>>(`/api/v1/community/scrap-folders/${folderId}/`, { name });
    return response.data;
};

// 스크랩 폴더 삭제
export const deleteScrapFolder = async (folderId: number): Promise<ApiResponse<void>> => {
    const response = await client.delete<ApiResponse<void>>(`/api/v1/community/scrap-folders/${folderId}/`);
    return response.data;
};

// 스크랩 폴더 단건 조회
export const getScrapFolderDetail = async (folderId: number): Promise<ApiResponse<ScrapFolder>> => {
    const response = await client.get<ApiResponse<ScrapFolder>>(`/api/v1/community/scrap-folders/${folderId}/`);
    return response.data;
};

// 스크랩 폴더 내 레시피 목록 조회
export const getScrapFolderRecipes = async (folderId: number): Promise<ApiResponse<Recipe[]>> => {
    const response = await client.get<ApiResponse<Recipe[]>>(`/api/v1/community/scrap-folders/${folderId}/recipes/`);
    return response.data;
};

// 레시피 스크랩 추가 (토글 API 활용)
export const scrapRecipeToFolder = async (folderId: number, recipeId: number): Promise<ApiResponse<void>> => {
    const response = await client.post<ApiResponse<void>>(`/api/v1/community/recipe-scraps/toggle/`, { 
        recipe_id: recipeId,
        folder_id: folderId
    });
    return response.data;
};

export interface RecipeScrapStatus {
    scraped: boolean;
    folder_ids: number[];
}

// 레시피 스크랩 여부 조회
export const checkRecipeScrapStatus = async (recipeId: number): Promise<ApiResponse<RecipeScrapStatus>> => {
    const response = await client.get<ApiResponse<RecipeScrapStatus>>(`/api/v1/community/recipe-scraps/check/`, {
        params: { recipe_id: recipeId }
    });
    return response.data;
};
