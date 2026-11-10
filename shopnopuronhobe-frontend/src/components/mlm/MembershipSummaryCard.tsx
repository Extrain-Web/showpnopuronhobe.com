"use client";

import React from 'react';
import Link from 'next/link';
import { FiArrowRight } from 'react-icons/fi';
import { useGetMySummaryQuery, taka } from '@/redux/api/mlmApi';

/** Compact membership status for the account home page. */
export default function MembershipSummaryCard() {
    const { data } = useGetMySummaryQuery();
    const s = data?.data;
    if (!s) return null;

    const status = s.memberStatus === 'active'
        ? (s.rank ? `Rank ${s.rank} · ${s.rankName}` : 'L-1 · New Member')
        : s.memberStatus === 'pending' ? 'Membership request pending' : 'Customer';
    const items = [
        { label: 'Points', value: `${s.points} / ${s.membershipPoints}` },
        { label: 'Active referrals', value: `${s.directActiveCount}` },
        { label: 'Team', value: `${s.teamActiveCount}` },
        { label: 'Wallet', value: taka(s.walletBalance) },
    ];

    return (
        <div className="rounded-2xl p-5 text-white bg-gradient-to-br from-[#0b2a5b] to-[#16438c]">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                    <p className="text-xs text-blue-100">Member ID #{s.memberId} · Code {s.referralCode}</p>
                    <p className="text-lg font-bold">{status}</p>
                </div>
                <Link href="/dashboard/user/membership" className="flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-lg bg-amber-400 text-[#0b2a5b]">
                    Membership <FiArrowRight />
                </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {items.map(i => (
                    <div key={i.label} className="bg-white/10 rounded-lg p-3">
                        <p className="text-[11px] text-blue-100">{i.label}</p>
                        <p className="text-lg font-extrabold">{i.value}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
