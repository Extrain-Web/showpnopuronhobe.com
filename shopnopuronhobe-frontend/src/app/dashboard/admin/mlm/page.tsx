"use client";

import React from 'react';
import Link from 'next/link';
import { useGetMlmReportsQuery, useGetMlmSettingsQuery, taka } from '@/redux/api/mlmApi';
import { PageHead, Panel, Stat } from '@/components/mlm/AdminUi';

export default function MlmOverviewPage() {
    const { data, isLoading } = useGetMlmReportsQuery();
    const { data: pub } = useGetMlmSettingsQuery();
    const r = data?.data;
    const ranks: any[] = pub?.data?.ranks || [];

    if (isLoading || !r) return <div className="p-10 text-center text-gray-400 animate-pulse">Loading…</div>;

    const companyTotal = Object.values(r.company || {}).reduce((a: number, b: any) => a + Number(b), 0);

    return (
        <div className="space-y-5">
            <PageHead title="Membership Overview" sub="Members, money paid out, Rank Club and company income." />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Stat label="Active members" value={r.members.active || 0} tone="green" />
                <Link href="/dashboard/admin/mlm/requests"><Stat label="Pending requests →" value={r.members.pending || 0} tone="amber" /></Link>
                <Stat label="Customers (not members)" value={(r.members.none || 0) + (r.members.rejected || 0)} />
                <Link href="/dashboard/admin/mlm/withdraws"><Stat label={`Pending withdraws (${r.pendingWithdraw.count}) →`} value={taka(r.pendingWithdraw.total)} tone="red" /></Link>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Stat label="Referral bonus paid" value={taka(r.paid.referral_bonus)} tone="blue" />
                <Stat label="Generation commission paid" value={taka(r.paid.generation)} tone="blue" />
                <Stat label="Rank Club paid" value={taka(r.paid.club)} tone="purple" />
                <Stat label="Money in member wallets" value={taka(r.walletsTotal)} tone="green" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Panel title="Members by rank">
                    <table className="w-full text-sm">
                        <tbody>
                            <tr className="border-b border-gray-50"><td className="py-2">New Member (no rank)</td><td className="text-right font-bold">{r.ranks['0'] || 0}</td></tr>
                            {ranks.map(rk => (
                                <tr key={rk.level} className="border-b border-gray-50"><td className="py-2">Rank {rk.level} · {rk.name}</td><td className="text-right font-bold">{r.ranks[rk.level] || 0}</td></tr>
                            ))}
                        </tbody>
                    </table>
                </Panel>
                <div className="space-y-5">
                    <Panel title="Rank Club fund" right={<Link href="/dashboard/admin/mlm/club" className="text-xs font-bold text-[var(--color-primary)]">Open →</Link>}>
                        <div className="grid grid-cols-3 gap-3">
                            <Stat label="Balance" value={taka(r.club.balance)} tone="green" />
                            <Stat label="Collected" value={taka(r.club.totalCollected)} />
                            <Stat label="Distributed" value={taka(r.club.totalDistributed)} />
                        </div>
                    </Panel>
                    <Panel title={`Company income · ${taka(companyTotal)}`}>
                        <table className="w-full text-sm">
                            <tbody>
                                <tr className="border-b border-gray-50"><td className="py-2">Withdraw charges</td><td className="text-right font-bold">{taka(r.company.withdraw_charge)}</td></tr>
                                <tr className="border-b border-gray-50"><td className="py-2">Unclaimed generation shares (empty ranks)</td><td className="text-right font-bold">{taka(r.company.generation_unclaimed)}</td></tr>
                                <tr><td className="py-2">Unclaimed Rank Club shares (empty ranks)</td><td className="text-right font-bold">{taka(r.company.club_unclaimed)}</td></tr>
                            </tbody>
                        </table>
                    </Panel>
                </div>
            </div>
        </div>
    );
}
