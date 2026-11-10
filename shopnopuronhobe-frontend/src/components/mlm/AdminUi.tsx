"use client";

import React from 'react';

export const PageHead = ({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) => (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
            <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
            {sub && <p className="text-sm text-gray-500 mt-0.5">{sub}</p>}
        </div>
        {right}
    </div>
);

export const Panel = ({ title, children, right, className = '' }: { title?: string; children: React.ReactNode; right?: React.ReactNode; className?: string }) => (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm p-5 ${className}`}>
        {(title || right) && (
            <div className="flex items-center justify-between mb-4">
                {title && <h3 className="font-bold text-gray-800">{title}</h3>}
                {right}
            </div>
        )}
        {children}
    </div>
);

export const Stat = ({ label, value, tone = 'gray' }: { label: string; value: React.ReactNode; tone?: 'gray' | 'green' | 'blue' | 'amber' | 'red' | 'purple' }) => {
    const tones: Record<string, string> = {
        gray: 'bg-gray-50 text-gray-800', green: 'bg-green-50 text-green-700', blue: 'bg-blue-50 text-blue-700',
        amber: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-red-700', purple: 'bg-purple-50 text-purple-700',
    };
    return (
        <div className={`rounded-xl p-4 ${tones[tone]}`}>
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-2xl font-extrabold mt-0.5">{value}</p>
        </div>
    );
};

export const Pager = ({ meta, page, setPage }: { meta?: any; page: number; setPage: (n: number) => void }) =>
    meta && meta.totalPages > 1 ? (
        <div className="flex justify-end items-center gap-2 mt-4">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 text-sm rounded border disabled:opacity-40">Prev</button>
            <span className="text-sm text-gray-500">{page} / {meta.totalPages} · {meta.total} total</span>
            <button disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1 text-sm rounded border disabled:opacity-40">Next</button>
        </div>
    ) : null;

export const memberName = (u: any) => [u?.firstName, u?.lastName].filter((p: string) => p && p !== '.').join(' ') || '—';

export const MEMBER_STATUS: Record<string, { label: string; cls: string }> = {
    none: { label: 'Customer', cls: 'bg-gray-100 text-gray-600' },
    pending: { label: 'Pending', cls: 'bg-amber-50 text-amber-700' },
    active: { label: 'Active', cls: 'bg-green-50 text-green-700' },
    rejected: { label: 'Rejected', cls: 'bg-red-50 text-red-700' },
};

export const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-md outline-none focus:border-[var(--color-primary)] text-sm';
export const btnPrimary = 'px-4 py-2 rounded-md text-sm font-bold bg-[var(--color-primary)] text-[var(--color-primary-foreground)] disabled:opacity-40';
