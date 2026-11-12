"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { FiCheck, FiX, FiSearch, FiShare2, FiDollarSign } from 'react-icons/fi';
import {
    useGetMlmMembersQuery, useApproveMemberMutation, useRejectMemberMutation, useAdjustWalletMutation,
    useGetMlmSettingsQuery, errMsg, taka,
} from '@/redux/api/mlmApi';
import { Pager, memberName, MEMBER_STATUS, inputCls } from './AdminUi';

export default function MembersTable({ pendingOnly = false }: { pendingOnly?: boolean }) {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [term, setTerm] = useState('');
    const [status, setStatus] = useState(pendingOnly ? 'pending' : '');
    const [rank, setRank] = useState('');
    const { data, isFetching } = useGetMlmMembersQuery({ page, limit: 20, search: term || undefined, memberStatus: status || undefined, rank: rank || undefined });
    // Admin settings (the public endpoint no longer carries the rank table).
    const { data: pub } = useGetMlmSettingsQuery();
    const [approve] = useApproveMemberMutation();
    const [reject] = useRejectMemberMutation();
    const [adjust] = useAdjustWalletMutation();
    const [busy, setBusy] = useState<string | null>(null);

    const rows: any[] = data?.data || [];
    const ranks: any[] = pub?.data?.ranks || [];
    const membershipPoints = pub?.data?.membershipPoints ?? 50;
    const rankName = (r: number) => (r ? `R${r} · ${ranks.find(x => x.level === r)?.name || ''}` : '—');

    const onApprove = async (u: any) => {
        if (u.points < membershipPoints && !confirm(`${memberName(u)} has only ${u.points} of ${membershipPoints} points. Approve anyway?`)) return;
        setBusy(u._id);
        try { await approve(u._id).unwrap(); toast.success(`${memberName(u)} is now an Active member`); }
        catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
    };
    const onReject = async (u: any) => {
        const reason = prompt(`Reason for rejecting ${memberName(u)} (optional):`);
        if (reason === null) return;
        setBusy(u._id);
        try { await reject({ id: u._id, reason }).unwrap(); toast.success('Request rejected'); }
        catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
    };
    const onAdjust = async (u: any) => {
        const a = prompt(`Add (+) or deduct (−) wallet money for ${memberName(u)}. Current balance ${taka(u.walletBalance)}.\nExample: 100 or -50`);
        if (!a) return;
        const note = prompt('Note for this adjustment:') || 'Admin adjustment';
        setBusy(u._id);
        try { await adjust({ id: u._id, amount: Number(a), note }).unwrap(); toast.success('Wallet updated'); }
        catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <form onSubmit={e => { e.preventDefault(); setTerm(search.trim()); setPage(1); }} className="flex flex-wrap gap-2 mb-4">
                <div className="relative flex-1 min-w-[220px]">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, phone, email or Member ID" className={`${inputCls} pl-9`} />
                </div>
                {!pendingOnly && (
                    <>
                        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className={`${inputCls} w-auto`}>
                            <option value="">All statuses</option>
                            {Object.entries(MEMBER_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                        <select value={rank} onChange={e => { setRank(e.target.value); setPage(1); }} className={`${inputCls} w-auto`}>
                            <option value="">All ranks</option>
                            <option value="0">No rank</option>
                            {ranks.map(r => <option key={r.level} value={r.level}>Rank {r.level} · {r.name}</option>)}
                        </select>
                    </>
                )}
                <button className="px-4 py-2 rounded-md text-sm font-bold bg-gray-800 text-white">Search</button>
            </form>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-xs text-gray-500 border-b bg-gray-50">
                            <th className="p-2 text-left">Member</th>
                            <th className="p-2 text-left">Sponsor</th>
                            <th className="p-2 text-center">Points</th>
                            <th className="p-2 text-center">Status</th>
                            <th className="p-2 text-center">Rank</th>
                            <th className="p-2 text-center">Direct / Team</th>
                            <th className="p-2 text-right">Wallet</th>
                            <th className="p-2 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 && (
                            <tr><td colSpan={8} className="p-8 text-center text-gray-400">{isFetching ? 'Loading…' : pendingOnly ? 'No pending membership requests.' : 'No members found.'}</td></tr>
                        )}
                        {rows.map(u => {
                            const st = MEMBER_STATUS[u.memberStatus] || MEMBER_STATUS.none;
                            return (
                                <tr key={u._id} className="border-b border-gray-50 hover:bg-gray-50/50">
                                    <td className="p-2">
                                        <p className="font-semibold text-gray-800">{memberName(u)}</p>
                                        <p className="text-xs text-gray-400">#{u.memberId} · {u.phone || u.email}</p>
                                        {pendingOnly && u.memberRequestedAt && <p className="text-[11px] text-amber-600">Requested {new Date(u.memberRequestedAt).toLocaleString()}</p>}
                                    </td>
                                    <td className="p-2 text-xs text-gray-500">{u.referredBy ? `${memberName(u.referredBy)} (#${u.referredBy.memberId})` : '—'}</td>
                                    <td className={`p-2 text-center font-bold ${u.points >= membershipPoints ? 'text-green-700' : 'text-gray-600'}`}>{u.points}</td>
                                    <td className="p-2 text-center"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span></td>
                                    <td className="p-2 text-center text-xs">{rankName(u.rank)}</td>
                                    <td className="p-2 text-center">{u.directActiveCount} / {u.teamActiveCount}</td>
                                    <td className="p-2 text-right font-semibold">{taka(u.walletBalance)}</td>
                                    <td className="p-2">
                                        <div className="flex justify-end gap-1">
                                            {(u.memberStatus === 'pending' || (!pendingOnly && u.memberStatus !== 'active')) && (
                                                <button disabled={busy === u._id} onClick={() => onApprove(u)} className="p-1.5 rounded bg-green-600 text-white disabled:opacity-40" title="Approve membership"><FiCheck /></button>
                                            )}
                                            {u.memberStatus === 'pending' && (
                                                <button disabled={busy === u._id} onClick={() => onReject(u)} className="p-1.5 rounded bg-red-500 text-white disabled:opacity-40" title="Reject"><FiX /></button>
                                            )}
                                            {!pendingOnly && (
                                                <>
                                                    <Link href={`/dashboard/admin/mlm/tree?node=${u._id}`} className="p-1.5 rounded bg-blue-50 text-blue-700" title="View G-Tree"><FiShare2 /></Link>
                                                    <button disabled={busy === u._id} onClick={() => onAdjust(u)} className="p-1.5 rounded bg-amber-50 text-amber-700" title="Adjust wallet"><FiDollarSign /></button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <Pager meta={data?.meta} page={page} setPage={setPage} />
        </div>
    );
}
