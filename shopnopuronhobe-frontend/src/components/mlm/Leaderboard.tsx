"use client";

import React from 'react';
import { FiAward } from 'react-icons/fi';
import { useGetLeaderboardQuery } from '@/redux/api/mlmApi';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function Leaderboard() {
    const { data, isLoading } = useGetLeaderboardQuery();
    const list: any[] = data?.data || [];

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-[#0b2a5b] to-[#16438c] text-white p-5">
                <h2 className="text-xl font-bold flex items-center gap-2"><FiAward className="text-amber-300" /> Leaderboard — Top 10</h2>
                <p className="text-sm text-blue-100">Best members by rank, then by active team size.</p>
            </div>
            {isLoading ? <p className="p-8 text-center text-gray-400 animate-pulse">Loading…</p> : list.length === 0 ? (
                <p className="p-8 text-center text-gray-400">No active members yet.</p>
            ) : (
                <ul className="divide-y divide-gray-100">
                    {list.map(m => (
                        <li key={m.memberId} className={`flex items-center gap-3 p-4 ${m.position <= 3 ? 'bg-amber-50/50' : ''}`}>
                            <span className="w-9 text-center text-xl font-extrabold text-gray-400">{MEDALS[m.position - 1] || m.position}</span>
                            {m.avatar
                                // eslint-disable-next-line @next/next/no-img-element
                                ? <img src={m.avatar} alt="" className="w-11 h-11 rounded-full object-cover border-2 border-amber-300" />
                                : <span className="w-11 h-11 rounded-full bg-[var(--color-primary)] text-[var(--color-primary-foreground)] flex items-center justify-center font-bold">{(m.name || '?').charAt(0).toUpperCase()}</span>}
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-gray-800 truncate">{m.name}</p>
                                <p className="text-xs text-gray-500">#{m.memberId}{m.location ? ` · ${m.location}` : ''}</p>
                            </div>
                            <div className="text-right">
                                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">{m.rank ? `Rank ${m.rank} · ${m.rankName}` : m.rankName}</span>
                                <p className="text-xs text-gray-500 mt-1">Team {m.teamSize.toLocaleString()}</p>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
