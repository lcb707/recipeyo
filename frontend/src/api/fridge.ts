import { apiClient as client } from './client';
import { ApiResponse, Fridge, FridgeSummary, FridgeItem, StandardIngredient, Recipe } from '../types';

// 내 개인 냉장고 조회
export const getMyFridge = async (): Promise<ApiResponse<Fridge>> => {
    const response = await client.get<ApiResponse<Fridge>>('/api/v1/fridges/my-fridge/');
    return response.data;
};

// 공유 냉장고 목록 조회
export const getSharedFridges = async (): Promise<ApiResponse<Fridge[]>> => {
    const response = await client.get<ApiResponse<Fridge[]>>('/api/v1/fridges/shared/');
    return response.data;
};

// 전체 냉장고 목록 조회 (개인 + 공유)
export const getAllFridges = async (): Promise<ApiResponse<Fridge[]>> => {
    const response = await client.get<ApiResponse<Fridge[]>>('/api/v1/fridges/');
    return response.data;
};

// 냉장고 요약 정보 조회 (유통기한 임박/주의/신선 개수)
export const getFridgeSummary = async (fridgeId: number): Promise<ApiResponse<FridgeSummary>> => {
    const response = await client.get<ApiResponse<FridgeSummary>>(`/api/v1/fridges/${fridgeId}/summary/`);
    return response.data;
};

// 해당 냉장고의 식자재 목록 조회 (필터/검색 파라미터 지원)
export interface GetFridgeItemsParams {
    storage_type?: 'FRIDGE' | 'FREEZER' | 'ROOM_TEMP';
    search?: string;
}
export const getFridgeItems = async (fridgeId: number, params?: GetFridgeItemsParams): Promise<ApiResponse<FridgeItem[]>> => {
    const response = await client.get<ApiResponse<FridgeItem[]>>(`/api/v1/fridges/${fridgeId}/items/`, { params });
    return response.data;
};

// 식자재 추가
export interface AddFridgeItemRequest {
    name: string;
    quantity?: string;
    unit?: string | null;
    expiry_date?: string | null;
    memo?: string | null;
}
export const addFridgeItem = async (fridgeId: number, data: AddFridgeItemRequest): Promise<ApiResponse<FridgeItem>> => {
    const response = await client.post<ApiResponse<FridgeItem>>(`/api/v1/fridges/${fridgeId}/items/`, data);
    return response.data;
};

// 식자재 수정
export interface UpdateFridgeItemRequest {
    quantity?: string;
    expiry_date?: string | null;
    status?: 'ACTIVE' | 'CONSUMED' | 'EXPIRED' | 'DISCARDED';
    memo?: string | null;
}
export const updateFridgeItem = async (itemId: number, data: UpdateFridgeItemRequest): Promise<ApiResponse<FridgeItem>> => {
    const response = await client.patch<ApiResponse<FridgeItem>>(`/api/v1/fridges/items/${itemId}/`, data);
    return response.data;
};

// 식자재 삭제
export const deleteFridgeItem = async (itemId: number): Promise<ApiResponse<null>> => {
    const response = await client.delete<ApiResponse<null>>(`/api/v1/fridges/items/${itemId}/`);
    return response.data;
};

// 표준 식자재 검색
export const getStandardIngredients = async (params?: { search?: string; category?: string; limit?: string | number }): Promise<ApiResponse<StandardIngredient[]>> => {
    const response = await client.get<ApiResponse<StandardIngredient[]>>('/api/v1/fridges/standard-ingredients/', { params });
    return response.data;
};

// 추천 레시피 조회
export const recommendRecipes = async (
    fridgeId: number, 
    payload: {
        selected_standard_ingredient_ids?: number[];
        selected_ingredients?: string[];
    }
): Promise<ApiResponse<Recipe[]>> => {
    const response = await client.post<ApiResponse<Recipe[]>>(`/api/v1/fridges/${fridgeId}/recommend-recipes/`, payload);
    return response.data;
};
