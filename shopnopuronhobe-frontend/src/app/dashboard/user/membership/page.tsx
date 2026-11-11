"use client";

import React from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { FiAward, FiCopy, FiShare2, FiStar, FiUsers, FiCreditCard, FiCheckCircle, FiClock, FiGift, FiTrendingUp, FiList } from 'react-icons/fi';
import { useGetMySummaryQuery, useGetMlmPublicSettingsQuery, useRequestMembershipMutation, useGetMyPointsQuery, errMsg, taka } from '@/redux/api/mlmApi';
import { LINK_COLORS } from '@/components/mlm/GTree';

const Bar = ({ value, max, color = 'var(--color-primary)' }: { value: number; max: number; color?: string }) => {
    const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
    return (
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
        </div>
    );
};

const Card = ({ title, icon, children, right }: { title: string; icon: React.ReactNode; children: React.ReactNode; right?: React.ReactNode }) => (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">{icon}{title}</h3>
            {right}
        </div>
        {children}
    </div>
);

export default function MembershipPage() {
    const { data, isLoading, isError } = useGetMySummaryQuery();
    const { data: pub } = useGetMlmPublicSettingsQuery();
    const [requestMembership, { isLoading: requesting }] = useRequestMembershipMutation();

    if (isLoading) return <div className="p-10 text-center text-gray-400 animate-pulse">Loading…</div>;
    if (isError || !data?.data) return <div className="p-10 text-center text-red-500">Could not load your membership details.</div>;

    const s = data.data;
    const ranks: any[] = pub?.data?.ranks || [];
    // ?ref=username reads better when shared; the code is the fallback for accounts without one.
    const link = typeof window !== 'undefined' ? `${window.location.origin}/register?ref=${encodeURIComponent(s.username || s.referralCode)}` : '';
    const canRequest = (s.memberStatus === 'none' || s.memberStatus === 'rejected') && s.points >= s.membershipPoints;

    const copy = async () => {
        try { await navigator.clipboard.writeText(link); toast.success('Referral link copied'); } catch { toast.error('Could not copy — select the link and copy it'); }
    };
    const share = async () => {
        if (navigator.share) { try { await navigator.share({ title: 'Swapno Puron Hobe', text: 'Join my team on Swapno Puron Hobe', url: link }); } catch { /* cancelled */ } }
        else copy();
    };
    const onRequest = async () => {
        try { await requestMembership().unwrap(); toast.success('Request sent. Admin will review it.'); }
        catch (e) { toast.error(errMsg(e)); }
    };

    const bonusDone = s.referralBonus.paidCount > 0 && !s.referralBonus.repeat;
    const directInBlock = s.referralBonus.repeat ? s.directActiveCount % s.referralBonus.required : Math.min(s.directActiveCount, s.referralBonus.required);

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="rounded-xl p-5 text-white bg-gradient-to-br from-[#0b2a5b] to-[#16438c] flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1">
                    <p className="text-sm text-blue-100">Member ID #{s.memberId}</p>
                    <h2 className="text-2xl font-bold">{s.name}</h2>
                    <div className="flex flex-wrap gap-2 mt-2">
                        <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-400 text-[#0b2a5b]">{s.rank ? `Rank ${s.rank} · ${s.rankName}` : s.memberStatus === 'active' ? 'L-1 · New Member' : 'Customer'}</span>
                        {s.sponsor && <span className="text-xs px-3 py-1 rounded-full bg-white/15">Sponsor: {s.sponsor.name} (#{s.sponsor.memberId})</span>}
                    </div>
                </div>
                <div className="md:w-[420px] bg-white/10 rounded-lg p-3">
                    <p className="text-xs text-blue-100 mb-1">Your referral link · code <b>{s.referralCode}</b></p>
                    <div className="flex gap-2">
                        <input readOnly value={link} className="flex-1 min-w-0 bg-white/90 text-gray-800 text-xs rounded-md px-3 py-2" onFocus={e => e.target.select()} />
                        <button onClick={copy} className="px-3 rounded-md bg-amber-400 text-[#0b2a5b] font-bold" title="Copy"><FiCopy /></button>
                        <button onClick={share} className="px-3 rounded-md bg-amber-400 text-[#0b2a5b] font-bold" title="Share"><FiShare2 /></button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Points & membership */}
                <Card title="Points & Membership" icon={<FiStar className="text-amber-500" />}>
                    <div className="flex items-end justify-between mb-2">
                        <p className="text-3xl font-extrabold text-gray-800">{s.points}<span className="text-base text-gray-400 font-semibold"> / {s.membershipPoints} points</span></p>
                        <p className="text-sm text-gray-500">≈ {taka(s.points * s.pointValue)}</p>
                    </div>
                    <Bar value={s.points} max={s.membershipPoints} color="#f59e0b" />
                    <p className="text-xs text-gray-500 mt-2">1 point = {taka(s.pointValue)}. Points are added when your order is delivered.</p>

                    <div className="mt-4">
                        {s.memberStatus === 'active' && <p className="flex items-center gap-2 text-green-700 font-semibold text-sm"><FiCheckCircle /> You are an Active member</p>}
                        {s.memberStatus === 'pending' && <p className="flex items-center gap-2 text-amber-700 font-semibold text-sm"><FiClock /> Your membership request is waiting for admin approval</p>}
                        {(s.memberStatus === 'none' || s.memberStatus === 'rejected') && (
                            <>
                                {s.memberStatus === 'rejected' && <p className="text-xs text-red-600 mb-2">Your last request was rejected{s.memberRejectReason ? `: ${s.memberRejectReason}` : ''}. You can request again.</p>}
                                <button onClick={onRequest} disabled={!canRequest || requesting}
                                    className="w-full py-2.5 rounded-lg font-bold text-sm bg-[var(--color-primary)] text-[var(--color-primary-foreground)] disabled:opacity-40">
                                    {requesting ? 'Sending…' : 'Membership Request'}
                                </button>
                                {!canRequest && <p className="text-xs text-gray-500 mt-2 text-center">Earn {s.membershipPoints - s.points} more points to request membership.</p>}
                            </>
                        )}
                    </div>
                </Card>

                {/* Referral bonus */}
                <Card title="Referral Bonus" icon={<FiGift className="text-rose-500" />}>
                    <div className="flex items-end justify-between mb-2">
                        <p className="text-3xl font-extrabold text-gray-800">{directInBlock}<span className="text-base text-gray-400 font-semibold"> / {s.referralBonus.required} active referrals</span></p>
                        <p className="text-sm font-bold text-rose-600">{taka(s.referralBonus.amount)}</p>
                    </div>
                    <Bar value={bonusDone ? s.referralBonus.required : directInBlock} max={s.referralBonus.required} color="#e11d48" />
                    <p className="text-xs text-gray-500 mt-2">
                        {bonusDone
                            ? `✓ You received the ${taka(s.referralBonus.amount)} bonus.`
                            : `When ${s.referralBonus.required} people you referred become Active members, you get ${taka(s.referralBonus.amount)} ${s.referralBonus.repeat ? 'for every' : 'once for'} ${s.referralBonus.required} referrals.`}
                        {s.memberStatus !== 'active' && ' You must be an Active member to receive it.'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Total active referrals: {s.directActiveCount} · Active team: {s.teamActiveCount}</p>
                </Card>

                {/* Rank progress */}
                <Card title="Rank Progress" icon={<FiAward className="text-blue-600" />} right={<Link href="/dashboard/user/leaderboard" className="text-xs font-bold text-[var(--color-primary)]">Leaderboard →</Link>}>
                    {!s.nextRank ? (
                        <p className="text-green-700 font-semibold">🏆 You reached the highest rank — {s.rankName}!</p>
                    ) : (
                        <>
                            <p className="text-sm text-gray-600 mb-3">Next: <b>Rank {s.nextRank.level} · {s.nextRank.name}</b>{s.nextRank.reward ? <> — reward: <b className="text-amber-600">{s.nextRank.reward}</b></> : null}</p>
                            {s.nextRank.target?.direct !== undefined ? (
                                <>
                                    <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Direct active referrals</span><span>{s.directActiveCount} / {s.nextRank.target.direct}</span></div>
                                    <Bar value={s.directActiveCount} max={s.nextRank.target.direct} />
                                    {s.memberStatus !== 'active' && <p className="text-xs text-gray-500 mt-2">Become an Active member first.</p>}
                                </>
                            ) : (
                                <div className="space-y-3">
                                    {s.nextRank.target.links.map((need: number, i: number) => (
                                        <div key={i}>
                                            <div className="flex justify-between text-xs text-gray-500 mb-1">
                                                <span className="font-semibold" style={{ color: LINK_COLORS[i] }}>Link {i + 1}{i === 3 ? ' (other legs)' : ''}</span>
                                                <span>{s.legs[i]} / {need}</span>
                                            </div>
                                            <Bar value={s.legs[i]} max={need} color={LINK_COLORS[i]} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </Card>

                {/* Wallet */}
                <Card title="Wallet" icon={<FiCreditCard className="text-green-600" />} right={<Link href="/dashboard/user/wallet" className="text-xs font-bold text-[var(--color-primary)]">Open wallet →</Link>}>
                    <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-green-50 rounded-lg p-3"><p className="text-xs text-gray-500">Balance</p><p className="text-lg font-extrabold text-green-700">{taka(s.walletBalance)}</p></div>
                        <div className="bg-blue-50 rounded-lg p-3"><p className="text-xs text-gray-500">Total earned</p><p className="text-lg font-extrabold text-blue-700">{taka(s.totalEarned)}</p></div>
                        <div className="bg-amber-50 rounded-lg p-3"><p className="text-xs text-gray-500">Pending withdraw</p><p className="text-lg font-extrabold text-amber-700">{taka(s.pendingWithdraw)}</p></div>
                    </div>
                    <div className="flex gap-2 mt-4">
                        <Link href="/dashboard/user/g-tree" className="flex-1 text-center text-sm font-bold py-2 rounded-lg border border-gray-200 hover:bg-gray-50"><FiUsers className="inline -mt-0.5 mr-1" />My G-Tree</Link>
                        <Link href="/dashboard/user/wallet" className="flex-1 text-center text-sm font-bold py-2 rounded-lg bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">Withdraw</Link>
                    </div>
                </Card>
            </div>

            {/* Rank structure */}
            {ranks.length > 0 && (
                <Card title="Dream Fulfillment & Rank Structure" icon={<FiTrendingUp className="text-purple-600" />}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[#0b2a5b] text-white text-xs">
                                    <th className="p-2 text-left">Rank</th><th className="p-2 text-left">Name</th>
                                    <th className="p-2">Link 1</th><th className="p-2">Link 2</th><th className="p-2">Link 3</th><th className="p-2">Link 4</th>
                                    <th className="p-2">Share</th><th className="p-2 text-left">Reward</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ranks.map((r: any) => (
                                    <tr key={r.level} className={`border-b border-gray-100 ${s.rank === r.level ? 'bg-amber-50 font-semibold' : ''}`}>
                                        <td className="p-2">{r.level}</td>
                                        <td className="p-2">{r.name}</td>
                                        {r.level === 1
                                            ? <td className="p-2 text-center" colSpan={4}>{r.directTarget} direct active referrals</td>
                                            : r.links.map((v: number, i: number) => <td key={i} className="p-2 text-center">{v.toLocaleString()}</td>)}
                                        <td className="p-2 text-center">{r.sharePercent}%</td>
                                        <td className="p-2 text-amber-700">{r.reward || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Link numbers are new active members needed on top of the previous rank. Link 1–3 are your three biggest teams; Link 4 is all your other teams together.</p>
                </Card>
            )}

            <PointHistory />
        </div>
    );
}

/** Every delivered order that earned points. */
function PointHistory() {
    const { data, isLoading } = useGetMyPointsQuery();
    const p = data?.data;
    const rows: any[] = p?.history || [];

    return (
        <Card title="Point History" icon={<FiList className="text-amber-500" />}
            right={p ? <span className="text-xs font-bold text-gray-500">Total {p.total} points</span> : null}>
            {isLoading ? (
                <p className="text-sm text-gray-400 animate-pulse">Loading…</p>
            ) : rows.length === 0 && !p?.other ? (
                <div className="text-center py-6">
                    <p className="text-sm text-gray-500">No points yet. Points are added when an order is delivered.</p>
                    <Link href="/products" className="inline-block mt-3 text-sm font-bold px-4 py-2 rounded-lg bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">Shop now</Link>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-xs text-gray-500 border-b bg-gray-50">
                                <th className="p-2 text-left">Date</th><th className="p-2 text-left">Order</th>
                                <th className="p-2 text-left">Products</th><th className="p-2 text-right">Points</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(r => (
                                <tr key={r._id} className="border-b border-gray-50">
                                    <td className="p-2 whitespace-nowrap">{new Date(r.date).toLocaleDateString()}</td>
                                    <td className="p-2 whitespace-nowrap font-semibold">{r.orderId}</td>
                                    <td className="p-2 text-gray-500 max-w-[320px] truncate" title={r.items}>{r.items}</td>
                                    <td className="p-2 text-right font-bold text-green-700">+{r.points}</td>
                                </tr>
                            ))}
                            {p?.other > 0 && (
                                <tr className="border-b border-gray-50">
                                    <td className="p-2 text-gray-400">—</td>
                                    <td className="p-2 text-gray-500" colSpan={2}>Points added by the company</td>
                                    <td className="p-2 text-right font-bold text-green-700">+{p.other}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </Card>
    );
}
