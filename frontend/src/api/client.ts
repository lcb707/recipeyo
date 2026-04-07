import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:31000';

export const apiClient = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request Interceptor
apiClient.interceptors.request.use(
    (config) => {
        if (typeof window !== 'undefined') {
            const token = localStorage.getItem('access');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const subscribeTokenRefresh = (cb: (token: string) => void) => {
    refreshSubscribers.push(cb);
};

const onRefreshed = (token: string) => {
    refreshSubscribers.map(cb => cb(token));
    refreshSubscribers = [];
};

// Response Interceptor
apiClient.interceptors.response.use(
    (response) => {
        // 백엔드가 { status, data, message } 형태로 응답한다고 가정
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        // 401 Unauthorized (Access Token 만료 등)
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            if (!isRefreshing) {
                isRefreshing = true;
                try {
                    const refreshToken = localStorage.getItem('refresh');
                    if (!refreshToken) throw new Error('No refresh token available');

                    const res = await axios.post(`${BASE_URL}/api/v1/users/token/refresh/`, {
                        refresh: refreshToken,
                    });
                    
                    const newAccess = res.data?.data?.access_token || res.data?.access;
                    // refresh_token이 새롭게 반환되면(토큰 회전) 갱신, 없으면 기존 것 유지
                    const newRefresh = res.data?.data?.refresh_token; 
                    
                    if (!newAccess) throw new Error('Refresh failed');

                    localStorage.setItem('access', newAccess);
                    if (newRefresh) {
                        localStorage.setItem('refresh', newRefresh);
                    }
                    
                    if (typeof window !== 'undefined') {
                        document.cookie = `access=${newAccess}; path=/; max-age=86400; SameSite=Lax;`;
                    }
                    
                    onRefreshed(newAccess);
                    originalRequest.headers.Authorization = `Bearer ${newAccess}`;
                    return apiClient(originalRequest);
                } catch (refreshError) {
                    onRefreshed(''); // 빈 토큰 전달 시 실패로 치부하고 구독자들 취소
                    if (typeof window !== 'undefined') {
                        localStorage.removeItem('access');
                        localStorage.removeItem('refresh');
                        document.cookie = 'access=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                        window.location.href = '/login';
                    }
                    return Promise.reject(refreshError);
                } finally {
                    isRefreshing = false;
                }
            } else {
                // 이미 갱신 중이라면 프로미스를 반환하여 대기 큐에 등록
                return new Promise((resolve, reject) => {
                    subscribeTokenRefresh((newToken: string) => {
                        if (newToken) {
                            originalRequest.headers.Authorization = `Bearer ${newToken}`;
                            resolve(apiClient(originalRequest));
                        } else {
                            reject(new Error('Refresh failed during waiting'));
                        }
                    });
                });
            }
        }

        // 429 Too Many Requests 처리
        if (error.response?.status === 429 && !originalRequest._retryCount) {
            originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
            
            // 최대 2번까지 재시도
            if (originalRequest._retryCount <= 2) {
                const retryAfter = parseInt(error.response.headers['retry-after'] || '1', 10);
                console.warn(`Rate limited. Retrying after ${retryAfter}s... (Attempt ${originalRequest._retryCount})`);
                
                await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                return apiClient(originalRequest);
            }
        }

        return Promise.reject(error);
    }
);
