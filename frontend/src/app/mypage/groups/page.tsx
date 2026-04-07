'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    Users, Crown, UserCheck, UserPlus, Plus, X, Loader2,
    Shield, ArrowRight, Search
} from 'lucide-react';
import { getMyGroups, deleteGroup, leaveGroup } from '@/api/community';
import { searchUsers } from '@/api/users';
import { apiClient as client } from '@/api/client';
import ConfirmModal from '@/components/ConfirmModal';
import type { Group, User, ApiResponse } from '@/types';

type GroupTab = 'all' | 'admin' | 'member';

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
    ACCEPTED: { label: '참여 중',  cls: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
    PENDING:  { label: '초대 대기', cls: 'bg-amber-50  text-amber-600  dark:bg-amber-900/30  dark:text-amber-400'  },
};

const ROLE_ICON: Record<string, React.ReactNode> = {
    admin:  <Crown  size={13} className="text-amber-500"  />,
    member: <Users  size={13} className="text-slate-400"  />,
};

/* ─── Group Card ─────────────────────────────────────────────── */
function GroupCard({ group, onClick, onDelete, onLeave }: { 
    group: Group; 
    onClick: () => void;
    onDelete: () => void;
    onLeave: () => void;
}) {
    const roleBadge = group.my_role === 'admin' ? '관리자' : '멤버';
    const statusInfo = STATUS_BADGE[group.my_status ?? 'ACCEPTED'];
    const memberCount = group.members?.length ?? 0;

    return (
        <div
            onClick={onClick}
            className="group relative flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/40"
        >
            <div className="flex items-start justify-between mb-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl transition-colors group-hover:bg-primary group-hover:text-white ${
                    group.my_role === 'admin' ? 'bg-amber-50 text-amber-500 dark:bg-amber-900/30' : 'bg-primary/10 text-primary'
                }`}>
                    {group.my_role === 'admin' ? <Shield size={24} /> : <Users size={24} />}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {statusInfo && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusInfo.cls}`}>
                            {statusInfo.label}
                        </span>
                    )}
                    <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        group.my_role === 'admin'
                            ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}>
                        {ROLE_ICON[group.my_role]}
                        {roleBadge}
                    </span>
                </div>
            </div>
            <div className="flex-1 mb-4">
                <h3 className="font-bold text-slate-900 dark:text-white text-base leading-snug line-clamp-1 group-hover:text-primary transition-colors">
                    {group.name}
                </h3>
                {memberCount > 0 && (
                    <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                        <UserCheck size={12} />
                        멤버 <span className="font-semibold">{memberCount}</span>명
                    </p>
                )}
            </div>
            <div className="flex items-center justify-between pt-3.5 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                        {new Date(group.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })} 생성
                    </span>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (group.my_role === 'admin') onDelete();
                            else onLeave();
                        }}
                        className="text-[11px] font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded-lg transition-colors"
                    >
                        {group.my_role === 'admin' ? '그룹 해체' : '그룹 탈퇴'}
                    </button>
                </div>
                <span className="flex items-center gap-1 text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    상세보기 <ArrowRight size={12} />
                </span>
            </div>
        </div>
    );
}

/* ─── Skeleton Card ──────────────────────────────────────────── */
function SkeletonCard() {
    return (
        <div className="animate-pulse rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex items-start justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-slate-100 dark:bg-slate-800" />
                <div className="h-5 w-20 rounded-full bg-slate-100 dark:bg-slate-800" />
            </div>
            <div className="space-y-2 mb-4">
                <div className="h-4 w-3/4 rounded bg-slate-100 dark:bg-slate-800" />
                <div className="h-3 w-1/3 rounded bg-slate-100 dark:bg-slate-800" />
            </div>
            <div className="pt-3.5 border-t border-slate-100 dark:border-slate-800">
                <div className="h-3 w-1/2 rounded bg-slate-100 dark:bg-slate-800" />
            </div>
        </div>
    );
}

/* ─── Main Page ──────────────────────────────────────────────── */
export default function GroupsPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<GroupTab>('all');
    const [groups, setGroups] = useState<Group[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Create group modal state
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    
    // Deletion/Leaving Modal state
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        groupId: number | null;
        groupName: string;
        type: 'delete' | 'leave';
    }>({
        isOpen: false,
        groupId: null,
        groupName: '',
        type: 'leave'
    });

    // Received invitations state
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [pendingInvites, setPendingInvites] = useState<any[]>([]);
    const [isInvitesLoading, setIsInvitesLoading] = useState(false);

    // Member invite state
    const [memberSearchQuery, setMemberSearchQuery] = useState('');
    const [memberSearchResults, setMemberSearchResults] = useState<User[]>([]);
    const [isMemberSearching, setIsMemberSearching] = useState(false);
    const [showDropdown, setShowDropdown]   = useState(false);
    const [inviteList, setInviteList] = useState<User[]>([]);

    const groupNameRef    = useRef<HTMLInputElement>(null);
    const memberSearchRef = useRef<HTMLInputElement>(null);
    const dropdownRef     = useRef<HTMLDivElement>(null);
    const searchDebounce  = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchGroups = async () => {
        try {
            setIsLoading(true);
            const res = await getMyGroups();
            if (res.status === 'success') setGroups(res.data.results || []);
        } catch (e) {
            console.error('Failed to fetch groups', e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchGroups(); }, []);

    const fetchInvites = async () => {
        try {
            setIsInvitesLoading(true);
            const res = await client.get('/api/v1/community/groups/invitations/');
            if (res.data.status === 'success') {
                setPendingInvites(res.data.data || []);
            }
        } catch (e) {
            console.error('Failed to fetch invites', e);
        } finally {
            setIsInvitesLoading(false);
        }
    };

    const handleInviteAction = async (inviteId: number, action: 'accept' | 'reject') => {
        try {
            const res = await client.post(`/api/v1/community/groups/${inviteId}/${action}/`);
            if (res.data.status === 'success') {
                fetchInvites();
                fetchGroups();
            }
        } catch (e: any) {
            alert(e.response?.data?.message || '처리에 실패했습니다.');
        }
    };

    useEffect(() => {
        if (isInviteModalOpen) fetchInvites();
    }, [isInviteModalOpen]);
    useEffect(() => {
        if (isCreateOpen) setTimeout(() => groupNameRef.current?.focus(), 100);
        else {
            // Reset modal state on close
            setNewGroupName('');
            setInviteList([]);
            setMemberSearchQuery('');
            setMemberSearchResults([]);
            setShowDropdown(false);
        }
    }, [isCreateOpen]);

    // Debounced member search
    const handleMemberSearchChange = (q: string) => {
        setMemberSearchQuery(q);
        if (searchDebounce.current) clearTimeout(searchDebounce.current);
        if (!q.trim()) { setMemberSearchResults([]); setShowDropdown(false); return; }
        searchDebounce.current = setTimeout(async () => {
            try {
                setIsMemberSearching(true);
                const res = await searchUsers(q);
                if (res.status === 'success') {
                    setMemberSearchResults(res.data);
                    setShowDropdown(res.data.length > 0);
                }
            } catch { setMemberSearchResults([]); }
            finally { setIsMemberSearching(false); }
        }, 350);
    };

    const addToInviteList = (user: User) => {
        if (inviteList.find(u => u.id === user.id)) return; // no duplicates
        setInviteList(prev => [...prev, user]);
        setMemberSearchQuery('');
        setMemberSearchResults([]);
        setShowDropdown(false);
    };

    const removeFromInviteList = (id: number) => {
        setInviteList(prev => prev.filter(u => u.id !== id));
    };

    const filteredGroups = groups.filter(g => {
        if (activeTab === 'admin')  return g.my_role === 'admin';
        if (activeTab === 'member') return g.my_role === 'member';
        return true;
    });

    const adminCount  = groups.filter(g => g.my_role === 'admin').length;
    const memberCount = groups.filter(g => g.my_role === 'member').length;

    const handleCreateGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newGroupName.trim()) return;
        try {
            setIsCreating(true);
            const res = await client.post<ApiResponse<Group>>('/api/v1/community/groups/', {
                name: newGroupName.trim(),
                invite_user_identifiers: inviteList.map(u => u.identifier), // Use 12-char identifier as per API spec
            });
            if (res.data.status === 'success') {
                setIsCreateOpen(false);
                fetchGroups();
            }
        } catch (e: any) {
            alert(e.response?.data?.message || '그룹 생성에 실패했습니다.');
        } finally {
            setIsCreating(false);
        }
    };

    const handleActionConfirm = async () => {
        if (!confirmModal.groupId) return;
        try {
            const res = confirmModal.type === 'delete' 
                ? await deleteGroup(confirmModal.groupId)
                : await leaveGroup(confirmModal.groupId);
            
            if (res.status === 'success') {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                fetchGroups();
            }
        } catch (err: any) {
            alert(err.response?.data?.message || '처리 중 오류가 발생했습니다.');
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 p-6 md:p-10 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex-1 relative">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Users className="text-primary" size={22} />
                        <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">내 그룹</h2>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        내가 운영하거나 참여 중인 그룹을 관리하세요.
                        {!isLoading && (
                            <span className="ml-2 font-semibold text-primary">{groups.length}개</span>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsInviteModalOpen(true)}
                        className="relative flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-100 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700"
                    >
                        <UserPlus size={18} />
                        받은 초대
                        {pendingInvites.length > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-bold ring-2 ring-white">
                                {pendingInvites.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setIsCreateOpen(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-bold shadow-md shadow-primary/20 hover:bg-primary/90 active:scale-95 transition-all"
                    >
                        <Plus size={18} />
                        새 그룹 만들기
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-6 w-fit">
                {([
                    { id: 'all',    label: `전체 ${groups.length}` },
                    { id: 'admin',  label: `운영 중 ${adminCount}` },
                    { id: 'member', label: `참여 중 ${memberCount}` },
                ] as { id: GroupTab; label: string }[]).map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                            activeTab === tab.id
                                ? 'bg-white dark:bg-slate-900 text-primary shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Group Grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
                </div>
            ) : filteredGroups.length === 0 ? (
                <div className="py-24 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-800/30">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 mb-4">
                        <Users className="text-slate-400" size={32} />
                    </div>
                    <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">
                        {activeTab === 'all' ? '가입한 그룹이 없습니다' : '해당하는 그룹이 없습니다'}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 mb-5">
                        {activeTab === 'all' ? '새로운 그룹을 만들어보세요!' : '다른 탭을 확인해보세요.'}
                    </p>
                    {activeTab === 'all' && (
                        <button
                            onClick={() => setIsCreateOpen(true)}
                            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-primary/20 hover:bg-primary/90 transition-all"
                        >
                            <Plus size={16} />
                            첫 그룹 만들기
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredGroups.map(group => (
                        <GroupCard
                            key={group.id}
                            group={group}
                            onClick={() => router.push(`/mypage/groups/${group.id}`)}
                            onDelete={() => setConfirmModal({
                                isOpen: true,
                                groupId: group.id,
                                groupName: group.name,
                                type: 'delete'
                            })}
                            onLeave={() => setConfirmModal({
                                isOpen: true,
                                groupId: group.id,
                                groupName: group.name,
                                type: 'leave'
                            })}
                        />
                    ))}
                </div>
            )}

            {/* Actions Confirmation Modal */}
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.type === 'delete' ? '그룹 해체' : '그룹 탈퇴'}
                message={confirmModal.type === 'delete' 
                    ? `'${confirmModal.groupName}' 그룹을 완전히 해체하시겠습니까? 이 작업은 되돌릴 수 없습니다.`
                    : `'${confirmModal.groupName}' 그룹에서 탈퇴하시겠습니까?`
                }
                confirmText={confirmModal.type === 'delete' ? '해체하기' : '탈퇴하기'}
                isDestructive={true}
                onConfirm={handleActionConfirm}
                onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            />

            {/* ─── Create Group Modal ─── */}
            {isCreateOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-visible border border-slate-200/50 dark:border-slate-800/50 flex flex-col">
                        {/* Header */}
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0">
                                <UserPlus className="text-primary" size={20} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">새 그룹 만들기</h3>
                                <p className="text-xs text-slate-500">함께 요리할 그룹을 만들어보세요</p>
                            </div>
                            <button
                                onClick={() => setIsCreateOpen(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateGroup}>
                            <div className="p-5 space-y-5">
                                {/* Group Name */}
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                        그룹명 <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        ref={groupNameRef}
                                        value={newGroupName}
                                        onChange={(e) => setNewGroupName(e.target.value)}
                                        className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none placeholder:text-slate-400 text-sm"
                                        placeholder="예: 요리 연구회"
                                        type="text"
                                        required
                                    />
                                </div>

                                {/* Member Search */}
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                        멤버 초대 <span className="text-slate-400 font-normal">(선택)</span>
                                    </label>
                                    <div className="relative" ref={dropdownRef}>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                                            <input
                                                ref={memberSearchRef}
                                                value={memberSearchQuery}
                                                onChange={(e) => handleMemberSearchChange(e.target.value)}
                                                onFocus={() => memberSearchResults.length > 0 && setShowDropdown(true)}
                                                className="w-full h-12 pl-9 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none placeholder:text-slate-400 text-sm"
                                                placeholder="닉네임 또는 이메일로 검색"
                                                type="text"
                                                autoComplete="off"
                                            />
                                            {isMemberSearching && (
                                                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" size={15} />
                                            )}
                                        </div>

                                        {/* Dropdown Results */}
                                        {showDropdown && (
                                            <div className="absolute top-full left-0 w-full mt-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl z-50 max-h-48 overflow-y-auto">
                                                {memberSearchResults.length === 0 ? (
                                                    <p className="text-xs text-slate-400 text-center py-4">검색 결과가 없습니다</p>
                                                ) : memberSearchResults.map(user => {
                                                    const alreadyAdded = inviteList.some(u => u.id === user.id);
                                                    return (
                                                        <button
                                                            key={user.id}
                                                            type="button"
                                                            onClick={() => addToInviteList(user)}
                                                            disabled={alreadyAdded}
                                                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left disabled:opacity-40"
                                                        >
                                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">
                                                                {user.nickname?.charAt(0)?.toUpperCase() ?? '?'}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user.nickname}</p>
                                                                <p className="text-xs text-slate-400 truncate">{user.email}</p>
                                                            </div>
                                                            {alreadyAdded && <span className="text-xs text-primary font-bold flex-shrink-0">추가됨</span>}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Invite Chips */}
                                    {inviteList.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-1">
                                            {inviteList.map(user => (
                                                <div key={user.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-semibold border border-primary/20">
                                                    <span className="w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center text-[9px] font-bold">
                                                        {user.nickname?.charAt(0)?.toUpperCase() ?? '?'}
                                                    </span>
                                                    {user.nickname}
                                                    <button type="button" onClick={() => removeFromInviteList(user.id)} className="ml-0.5 hover:text-red-500 transition-colors">
                                                        <X size={11} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex gap-3 bg-slate-50 dark:bg-slate-800/50 justify-end rounded-b-2xl">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateOpen(false)}
                                    className="py-2.5 px-6 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-white dark:hover:bg-slate-800 transition-colors text-sm"
                                >
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    disabled={!newGroupName.trim() || isCreating}
                                    className="flex items-center gap-2 py-2.5 px-8 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 shadow-lg shadow-primary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                >
                                    {isCreating ? <><Loader2 size={15} className="animate-spin" /> 생성 중...</> : (
                                        <>그룹 생성{inviteList.length > 0 && ` (+${inviteList.length}명 초대)`}</>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* ─── Received Invitations Modal ─── */}
            {isInviteModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 text-slate-900 dark:text-slate-100">
                    <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200/50 dark:border-slate-800/50 flex flex-col max-h-[80vh]">
                        {/* Header */}
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                                    <UserPlus className="text-primary" size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold">받은 초대</h3>
                                    <p className="text-xs text-slate-500">그룹 가입 요청을 확인하세요</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsInviteModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {isInvitesLoading ? (
                                <div className="flex justify-center py-10">
                                    <Loader2 className="animate-spin text-primary" size={24} />
                                </div>
                            ) : pendingInvites.length === 0 ? (
                                <div className="py-12 text-center">
                                    <Users className="mx-auto text-slate-200 dark:text-slate-800 mb-3" size={48} />
                                    <p className="text-sm text-slate-500">받은 초대가 없습니다.</p>
                                </div>
                            ) : (
                                pendingInvites.map((invite: any) => (
                                    <div key={invite.id} className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                {invite.group_name?.charAt(0)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold truncate">{invite.group_name}</p>
                                                <p className="text-xs text-slate-500">초대일: {new Date(invite.created_at).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleInviteAction(invite.id, 'reject')}
                                                className="flex-1 py-2 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-colors"
                                            >
                                                거절
                                            </button>
                                            <button
                                                onClick={() => handleInviteAction(invite.id, 'accept')}
                                                className="flex-1 py-2 rounded-lg text-xs font-bold text-white bg-primary hover:bg-primary/90 transition-colors shadow-sm"
                                            >
                                                수락
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
                            <button
                                onClick={() => setIsInviteModalOpen(false)}
                                className="px-5 py-2 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 transition-colors"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
