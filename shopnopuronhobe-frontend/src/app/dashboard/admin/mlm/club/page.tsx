"use client";

import React from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useGetClubQuery, useDistributeClubMutation, errMsg, taka } from '@/redux/api/mlmApi';
import { PageHead, Panel, Stat, btnPrimary } from '@/components/mlm/AdminUi';

const FREQ: Record<string, string> = { manual: 'Only when you press the button', daily: 'Every day', weekly: 'Every week', monthly: 'Every 30 days' };

export default function AdminClubPage() {
    const { data, isLoading } = useGetClubQuery();
    const [distribute, { isLoading: running }] = useDistributeClubMutation();
    const c = data?.data;

    const onDistribute = async () => {
        if (!c) return;
        const empty = c.preview.filter((p: any) => !p.members).reduce((a: number, p: any) => a + p.pool, 0);
        if (!confirm(`Distribute ${taka(c.fund.balance)} now?${empty ? `\n${taka(empty)} of empty ranks will go to the company.` : ''}`)) return;
        try { await distribute().unwrap(); toast.success('Rank Club distributed to member wallets'); }
        catch (e) { toast.error(errMsg(e)); }
    };

    if (isLoading || !c) return <div className="p-10 text-center text-gray-400 animate-pulse">Loading…</div>;

    return (
        <div className="space-y-5">
            <PageHead title="Rank Club" sub="Every delivered order adds to this fund. It is shared by rank % and split equally among members of the same rank."
                right={<button onClick={onDistribute} disabled={running || c.fund.balance <= 0} className={btnPrimary}>{running ? 'Distributing…' : 'Distribute now'}</button>} />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Stat label="Fund balance" value={taka(c.fund.balance)} tone="green" />
                <Stat label="Total collected" value={taka(c.fund.totalCollected)} tone="blue" />
                <Stat label="Total distributed" value={taka(c.fund.totalDistributed)} tone="purple" />
                <Stat label="Auto distribution" value={<span className="text-base">{FREQ[c.frequency]}</span>} tone="amber" />
            </div>
            <p className="text-xs text-gray-500">Change the contribution per order and the schedule in <Link href="/dashboard/admin/mlm/settings" className="text-[var(--color-primary)] font-bold">Membership Settings</Link>.</p>

            <Panel title="If you distribute now">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead><tr className="text-xs text-gray-500 border-b bg-gray-50"><th className="p-2 text-left">Rank</th><th className="p-2 text-center">Share</th><th className="p-2 text-right">Pool</th><th className="p-2 text-center">Members</th><th className="p-2 text-right">Each gets</th></tr></thead>
                        <tbody>
                            {c.preview.map((p: any) => (
                                <tr key={p.rank} className="border-b border-gray-50">
                                    <td className="p-2">Rank {p.rank} · {p.name}</td>
                                    <td className="p-2 text-center">{p.percent}%</td>
                                    <td className="p-2 text-right">{taka(p.pool)}</td>
                                    <td className="p-2 text-center">{p.members}</td>
                                    <td className="p-2 text-right font-bold">{p.members ? taka(p.perMember) : <span className="text-xs text-gray-400 font-normal">goes to company</span>}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Panel>

            <Panel title="Distribution history">
                {c.history.length === 0 ? <p className="text-sm text-gray-400">No distributions yet.</p> : (
                    <div className="space-y-3">
                        {c.history.map((h: any) => (
                            <details key={h._id} className="border border-gray-100 rounded-lg p-3">
                                <summary className="cursor-pointer text-sm flex flex-wrap gap-x-4">
                                    <b>{new Date(h.createdAt).toLocaleString()}</b>
                                    <span>{taka(h.amount)} shared</span>
                                    <span className="text-gray-500">{taka(h.toCompany)} to company</span>
                                    <span className="text-xs text-gray-400 capitalize">{h.triggeredBy}</span>
                                </summary>
                                <table className="w-full text-xs mt-2">
                                    <tbody>
                                        {h.breakdown.map((b: any) => (
                                            <tr key={b.rank} className="border-t border-gray-50">
                                                <td className="py-1">Rank {b.rank} · {b.name}</td><td>{b.percent}%</td><td>{taka(b.pool)}</td><td>{b.members} members</td><td className="text-right">{taka(b.perMember)} each</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </details>
                        ))}
                    </div>
                )}
            </Panel>
        </div>
    );
}
