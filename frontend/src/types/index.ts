// 공통 API 응답 타입
export interface ApiResponse<T> {
    status: 'success' | 'error';
    data: T;
    message: string;
}

// 페이지네이션 래퍼 타입
export interface PaginatedResult<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}

// ========================
// 1. Users
// ========================
export interface User {
    id: number;
    identifier: string;
    email: string;
    nickname: string;
    profile_image: string | null;
    role: string;
    is_active: boolean;
}

export interface LoginResponse {
    access_token: string;
    refresh_token: string;
}

export interface GoogleLoginResponse {
    access: string;
    refresh: string;
}

// ========================
// 2. Fridges (냉장고)
// ========================
export interface Fridge {
    id: number;
    name: string;
    fridge_type: 'personal' | 'shared';
    owner_identifier: string | null;
    group: number | null;
    item_count: number;
    created_at: string;
    updated_at: string;
}

export interface FridgeItem {
    id: number;
    fridge: number;
    name: string;
    quantity: string;
    unit: string;
    expiry_date: string;
    status: 'ACTIVE' | 'CONSUMED' | 'EXPIRED' | 'DISCARDED';
    storage_type?: 'FRIDGE' | 'FREEZER' | 'ROOM_TEMP';
    category?: string;
    standard_ingredient_id?: number | null;
    memo: string | null;
    created_at: string;
    updated_at: string;
}

export interface FridgeSummary {
    imminent: number; // 3일 이내 임박
    warning: number;  // 7일 이내 주의
    fresh: number;    // 신선
    total: number;
}

export interface StandardIngredient {
    id: number;
    name: string;
    category: string;
    default_storage: 'FRIDGE' | 'FREEZER' | 'ROOM_TEMP';
    default_expiry_days: number;
    search_keywords: string;
    default_unit: string;
    icon_url: string;
    icon_image: string | null;
}

// ========================
// 3. Community (커뮤니티 / 그룹)
// ========================
export interface GroupMember {
    id: number;
    email: string;
    nickname: string;
    role: 'owner' | 'admin' | 'member';
    status: 'ACCEPTED' | 'PENDING';
}

export interface Group {
    id: number;
    name: string;
    description?: string;
    scrap_folder_id?: number; // Added for shared scrap folder link
    my_role: 'admin' | 'member' | 'owner';
    my_status: 'ACCEPTED' | 'PENDING';
    group_scrap_folder?: number;
    created_at: string;
    members?: GroupMember[];
}

export interface CookingJournal {
    id: number;
    user_identifier: string;
    recipe_id: number;
    recipe_title: string;
    group_id: number | null;
    title: string;
    content: string;
    cooked_at: string;
    image: string | null;
    tags?: string[];
    visibility?: 'public' | 'private' | 'all_groups' | 'specific_groups';
    target_group_ids?: number[];
    created_at: string;
    updated_at: string;
}

export interface ScrapFolder {
    id: number;
    name: string;
    order: number;
    user: number | null;
    group: number | null;
    created_at: string;
    updated_at: string;
    scrap_count: number;
}

export interface Comment {
    id: number;
    journal: number;
    user_identifier: string;
    user_nickname: string;
    content: string;
    created_at: string;
    updated_at: string;
}

// ========================
// 4. Recipes (레시피)
// ========================
export interface Recipe {
    id: number;
    title: string;
    description?: string;
    thumbnail_image: string | null;
    cooking_time: number;
    difficulty: 'easy' | 'medium' | 'hard';
    author?: User;
    author_identifier: string;
    created_at: string;
    updated_at?: string;
    ingredients?: RecipeIngredient[];
    steps?: RecipeStep[];
}

export interface RecipeIngredient {
    id?: number;
    name: string;
    amount: string;
    unit: string | null;
}

export interface RecipeStep {
    id?: number;
    step_number: number;
    description: string;
    image?: string | null;
}
