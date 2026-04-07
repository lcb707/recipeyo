'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { getMe } from '@/api/users';
import { User } from '@/types';

interface UserContextType {
    user: User | null;
    loading: boolean;
    refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
    user: null,
    loading: true,
    refreshUser: async () => {},
});

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const isRefreshing = useRef(false);

    const refreshUser = useCallback(async () => {
        if (isRefreshing.current) return;
        
        const token = typeof window !== 'undefined' ? localStorage.getItem('access') : null;
        if (!token) {
            setUser(null);
            setLoading(false);
            return;
        }

        try {
            isRefreshing.current = true;
            const res = await getMe();
            if (res.status === 'success') {
                setUser(res.data);
            } else {
                setUser(null);
            }
        } catch (err) {
            console.error('Failed to fetch user in Context', err);
            setUser(null);
        } finally {
            isRefreshing.current = false;
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshUser();
    }, [refreshUser]);

    return (
        <UserContext.Provider value={{ user, loading, refreshUser }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => useContext(UserContext);
