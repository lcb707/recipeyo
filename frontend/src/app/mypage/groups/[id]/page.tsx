'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
    Users, ChevronLeft, Refrigerator, FolderHeart, Crown, Shield,
    UserMinus, Search, Loader2, UserCheck
} from 'lucide-react';
import { getGroupDetail, updateMemberRole } from '@/api/community';
import { getMe, searchUsers } from '@/api/users';
import { apiClient as client } from '@/api/client';
import { UserPlus, X } from 'lucide-react';
import type { Group, GroupMember, User, ApiResponse } from '@/types';

export default function GroupDetailPage() {
    const router = useRouter();
    const params = useParams();
    const groupId = params.id as string;

    const [group, setGroup] = useState<Group | null>(null);
    const [members, setMembers] = useState<GroupMember[]>([]);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Member modal
    const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
    const [memberSearch, setMemberSearch] = useState('');
    const [kickingId, setKickingId] = useState<number | null>(null);
    const [roleLoadingId, setRoleLoadingId] = useState<number | null>(null);

    // New Invitation Modal State
    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [inviteSearch, setInviteSearch] = useState('');
    const [inviteResults, setInviteResults] = useState<User[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isInviting, setIsInviting] = useState(false);

    const fetchGroupDetail = async () => {
        try {
            setIsLoading(true);
            const [groupRes, meRes] = await Promise.all([
                getGroupDetail(Number(groupId)),
                getMe(),
            ]);
            if (groupRes.status === 'success') {
                setGroup(groupRes.data);
                setMembers(groupRes.data.members || []);
            }
            if (meRes.status === 'success') {
                setCurrentUser(meRes.data);
            }
        } catch (error) {
            console.error('Failed to fetch group detail', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (groupId) fetchGroupDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupId]);

    const handleKick = async (member: GroupMember) => {
        if (!confirm(`'${member.nickname}' 님을 그룹에서 강퇴하시겠습니까?`)) return;
        try {
            setKickingId(member.id);
            await client.post(`/api/v1/community/groups/${groupId}/kick/`, {
                user_identifier: member.email,
            });
            await fetchGroupDetail();
        } catch (e: any) {
            alert(e.response?.data?.message || '강퇴에 실패했습니다.');
        } finally {
            setKickingId(null);
        }
    };

    const handleUpdateRole = async (member: GroupMember) => {
        const newRole = member.role === 'admin' ? 'member' : 'admin';
        if (!confirm(`'${member.nickname}' 님의 권한을 '${newRole === 'admin' ? '관리자' : '멤버'}'(으)로 변경하시겠습니까?`)) return;
        
        try {
            setRoleLoadingId(member.id);
            const res = await updateMemberRole(Number(groupId), member.id, newRole);
            if (res.status === 'success') {
                await fetchGroupDetail();
            }
        } catch (e: any) {
            alert(e.response?.data?.message || '권한 변경에 실패했습니다.');
        } finally {
            setRoleLoadingId(null);
        }
    };

    const handleInviteSearch = async (query: string) => {
        setInviteSearch(query);
        if (!query.trim()) { setInviteResults([]); return; }
        try {
            setIsSearching(true);
            const res = await searchUsers(query);
            if (res.status === 'success') {
                setInviteResults(res.data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSearching(false);
        }
    };

    const handleInvite = async (user: any) => {
        try {
            setIsInviting(true);
            const res = await client.post(`/api/v1/community/groups/${groupId}/invite/`, {
                user_identifier: user.identifier
            });
            if (res.data.status === 'success') {
                alert('초대를 보냈습니다.');
                setIsInviteOpen(false);
                setInviteSearch('');
                setInviteResults([]);
            }
        } catch (e: any) {
            alert(e.response?.data?.message || '초대에 실패했습니다.');
        } finally {
            setIsInviting(false);
        }
    };

    const isSelf = (member: GroupMember) =>
        currentUser?.email === member.email || currentUser?.id === member.id;

    const filteredMembers = members.filter(m =>
        !memberSearch.trim() ||
        m.nickname.toLowerCase().includes(memberSearch.toLowerCase()) ||
        m.email.toLowerCase().includes(memberSearch.toLowerCase())
    );

    if (isLoading) {
        return (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col flex-1 items-center justify-center gap-3">
                <Loader2 className="text-primary animate-spin" size={36} />
                <p className="text-sm text-slate-500">그룹 정보를 불러오는 중...</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col flex-1 overflow-hidden">
            {/* Sub Header */}
            <div className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-4 px-6 shrink-0">
                <button
                    onClick={() => router.push('/mypage/groups')}
                    className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary transition-colors font-semibold"
                >
                    <ChevronLeft size={16} />
                    그룹 목록
                </button>
                {group && (
                    <>
                        <span className="text-slate-300">/</span>
                        <h2 className="font-bold text-slate-900 dark:text-white text-sm truncate">{group.name}</h2>
                        {group.my_role === 'admin' && (
                            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                                <Crown size={10} /> 관리자
                            </span>
                        )}
                    </>
                )}
            </div>

            <main className="flex-1 overflow-y-auto w-full p-6 lg:p-10">
                <div className="max-w-4xl mx-auto pb-10 space-y-8">

                    {/* ─── Quick Navigation Cards ─── */}
                    <section>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">그룹 서비스 바로가기</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Shared Scraps */}
                             {(() => {
                                const getFolderId = (val: any) => {
                                    if (!val) return null;
                                    return typeof val === 'object' ? val.id : val;
                                };
                                const folderId = getFolderId(group?.group_scrap_folder) || getFolderId(group?.scrap_folder_id);
                                return (
                                    <Link
                                        href={folderId ? `/mypage/scraps/${folderId}` : `/mypage/scraps?groupId=${groupId}`}
                                        className="group flex items-center gap-4 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-primary/50 hover:shadow-lg hover:-translate-y-0.5 transition-all"
                                    >
                                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-all flex-shrink-0">
                                            <FolderHeart size={24} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">공유 스크랩 폴더</p>
                                            <p className="text-xs text-slate-500 mt-0.5">그룹이 함께 저장한 레시피 모음</p>
                                        </div>
                                        <ChevronLeft className="rotate-180 ml-auto text-slate-300 group-hover:text-primary transition-colors" size={18} />
                                    </Link>
                                );
                            })()}

                            {/* Shared Fridge */}
                             <Link
                                href={`/fridge?groupId=${groupId}`}
                                className="group flex items-center gap-4 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-primary/50 hover:shadow-lg hover:-translate-y-0.5 transition-all"
                            >
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-sky-500 dark:bg-sky-900/30 group-hover:bg-sky-500 group-hover:text-white transition-all flex-shrink-0">
                                    <Refrigerator size={24} />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900 dark:text-white group-hover:text-sky-500 transition-colors">공유 냉장고</p>
                                    <p className="text-xs text-slate-500 mt-0.5">그룹이 함께 관리하는 냉장고</p>
                                </div>
                                <ChevronLeft className="rotate-180 ml-auto text-slate-300 group-hover:text-sky-500 transition-colors" size={18} />
                            </Link>
                        </div>
                    </section>

                    {/* ─── Member List ─── */}
                    <section>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                멤버 <span className="text-primary">{members.length}</span>명
                            </h3>
                             {group?.my_role === 'admin' && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setIsInviteOpen(true)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors shadow-sm"
                                    >
                                        <UserPlus size={13} /> 멤버 초대
                                    </button>
                                    <button
                                        onClick={() => setIsMemberModalOpen(true)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary hover:text-primary transition-colors"
                                    >
                                        <Shield size={13} /> 멤버 관리
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 dark:bg-slate-800/50">
                                    <tr>
                                        <th className="px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">닉네임</th>
                                        <th className="px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 hidden sm:table-cell">이메일</th>
                                        <th className="px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">권한</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {members.map(member => (
                                        <tr key={member.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                                            <td className="px-5 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">
                                                        {member.nickname?.charAt(0)?.toUpperCase() ?? '?'}
                                                    </div>
                                                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                                        {member.nickname}
                                                        {isSelf(member) && (
                                                            <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold">나</span>
                                                        )}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3 text-sm text-slate-500 dark:text-slate-400 hidden sm:table-cell">{member.email}</td>
                                            <td className="px-5 py-3">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                                                    member.role === 'owner'
                                                        ? 'bg-primary text-white shadow-sm shadow-primary/20'
                                                        : member.role === 'admin'
                                                            ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                                                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                                }`}>
                                                    {member.role === 'owner' ? <><Crown size={10} />소유자</> : member.role === 'admin' ? <><Shield size={10} />관리자</> : <><UserCheck size={10} />멤버</>}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            </main>

            {/* ─── Member Management Modal ─── */}
            {isMemberModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-white/10">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                                <Shield className="text-primary" size={20} />
                                멤버 관리
                            </h2>
                            <button
                                onClick={() => { setIsMemberModalOpen(false); setMemberSearch(''); }}
                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                                <span className="material-symbols-outlined text-xl leading-none">close</span>
                            </button>
                        </div>

                        {/* Search */}
                        <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                                <input
                                    value={memberSearch}
                                    onChange={(e) => setMemberSearch(e.target.value)}
                                    placeholder="닉네임 또는 이메일로 검색"
                                    className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all dark:text-white"
                                />
                            </div>
                        </div>

                        {/* Member List */}
                        <div className="overflow-y-auto flex-1 p-4 space-y-2">
                            {filteredMembers.length === 0 ? (
                                <p className="text-center text-sm text-slate-400 py-10">검색 결과가 없습니다</p>
                            ) : filteredMembers.map(member => {
                                const self = isSelf(member);
                                return (
                                    <div
                                        key={member.id}
                                        className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                    >
                                        {/* Avatar */}
                                        <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                                            {member.nickname?.charAt(0)?.toUpperCase() ?? '?'}
                                        </div>
                                        {/* Info */}
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                                {member.nickname}
                                                {self && (
                                                    <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold align-middle">나</span>
                                                )}
                                            </p>
                                            <p className="text-xs text-slate-400 truncate">{member.email}</p>
                                        </div>
                                        {/* Role Badge / Change Button */}
                                        {group?.my_role === 'owner' || (group?.my_role === 'admin' && member.role === 'member') ? (
                                            <button
                                                onClick={() => !self && handleUpdateRole(member)}
                                                disabled={self || roleLoadingId === member.id || member.role === 'owner'}
                                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 transition-all ${
                                                    member.role === 'owner'
                                                        ? 'bg-primary text-white cursor-default'
                                                        : member.role === 'admin'
                                                            ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                                                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                } ${self ? 'cursor-default opacity-80' : 'cursor-pointer'}`}
                                            >
                                                {roleLoadingId === member.id ? <Loader2 size={8} className="animate-spin" /> : member.role === 'owner' ? '소유자' : member.role === 'admin' ? '관리자' : '멤버'}
                                            </button>
                                        ) : (
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                                                member.role === 'owner'
                                                    ? 'bg-primary text-white'
                                                    : member.role === 'admin'
                                                        ? 'bg-amber-50 text-amber-600'
                                                        : 'bg-slate-100 text-slate-500'
                                            }`}>
                                                {member.role === 'owner' ? '소유자' : member.role === 'admin' ? '관리자' : '멤버'}
                                            </span>
                                        )}
                                        {/* Kick Button */}
                                        {self ? (
                                            <div title="본인은 강퇴할 수 없습니다" className="cursor-not-allowed">
                                                <button
                                                    type="button"
                                                    disabled
                                                    className="text-xs font-bold text-slate-300 dark:text-slate-600 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800 cursor-not-allowed"
                                                >
                                                    강퇴
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => handleKick(member)}
                                                disabled={kickingId === member.id}
                                                className="flex items-center gap-1 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-500/30 disabled:opacity-50"
                                            >
                                                {kickingId === member.id ? (
                                                    <Loader2 size={12} className="animate-spin" />
                                                ) : (
                                                    <UserMinus size={12} />
                                                )}
                                                강퇴
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-slate-50 dark:bg-slate-900">
                            <button
                                onClick={() => { setIsMemberModalOpen(false); setMemberSearch(''); }}
                                className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* ─── Member Invitation Modal ─── */}
            {isInviteOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 text-slate-900 dark:text-slate-100">
                    <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col">
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <UserPlus size={20} className="text-primary" />
                                멤버 초대
                            </h3>
                            <button onClick={() => setIsInviteOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                                <input
                                    value={inviteSearch}
                                    onChange={(e) => handleInviteSearch(e.target.value)}
                                    placeholder="닉네임 또는 이메일 검색"
                                    className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:border-primary outline-none text-slate-900 dark:text-slate-100"
                                />
                                {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" size={15} />}
                            </div>
                            
                            <div className="max-h-60 overflow-y-auto space-y-2">
                                {inviteResults.length === 0 && inviteSearch.trim() && !isSearching ? (
                                    <p className="text-center py-4 text-sm text-slate-400">검색 결과가 없습니다</p>
                                ) : (
                                    inviteResults.map((user: any) => {
                                        const isAlreadyMember = members.some(m => m.email === user.email);
                                        return (
                                            <div key={user.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800">
                                                <div className="min-w-0 pr-2">
                                                    <p className="text-sm font-bold truncate">{user.nickname}</p>
                                                    <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                                                </div>
                                                <button
                                                    onClick={() => handleInvite(user)}
                                                    disabled={isAlreadyMember || isInviting}
                                                    className="flex-shrink-0 px-3 py-1.5 bg-primary text-white text-[11px] font-bold rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all"
                                                >
                                                    {isAlreadyMember ? '멤버임' : '초대'}
                                                </button>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                            <button onClick={() => setIsInviteOpen(false)} className="px-5 py-2 text-sm font-bold text-slate-500">닫기</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
