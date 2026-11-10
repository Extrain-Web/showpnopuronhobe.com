"use client";

import React, { useState } from 'react';
import { useGetMlmTransactionsQuery, taka, TX_LABELS } from '@/redux/api/mlmApi';
import { PageHead, Pager, memberName, inputCls } from '@/components/mlm/AdminUi';

export default function AdminTransactionsPage() {
    const [page, setPage] = useState(1);
    const [type, setType] = useState('');
    const { data, isFetching } = useGetMlmTransactionsQuery({ page, type: type || undefined });
    const rows: any[] = data?.data || [];

    return (
        <div>
            <PageHead title="Wallet Transactions" sub="Every bonus, commission, club share, withdraw and adjustment."
                right={
                    <select value={type} onChange={e => { setType(e.target.value); setPage(1); }} className={`${inputCls} w-auto`}>
                        <option value="">All types</option>
                        {Object.entries(TX_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                } />
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 overflow-x-auto">
                <table className="w-full text-sm">
                    <thead><tr className="text-xs text-gray-500 border-b bg-gray-50"><th className="p-2 text-left">Date</th><th className="p-2 text-left">Member</th><th className="p-2 text-left">Type</th><th className="p-2 text-left">Details</th><th className="p-2 text-right">Amount</th></tr></thead>
                    <tbody>
                        {rows.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-400">{isFetching ? 'Loading…' : 'No transactions yet.'}</td></tr>}
                        {rows.map(t => (
                            <tr key={t._id} className="border-b border-gray-50">
                                <td className="p-2 whitespace-nowrap">{new Date(t.createdAt).toLocaleString()}</td>
                                <td className="p-2">{memberName(t.user)} <span className="text-xs text-gray-400">#{t.user?.memberId}</span></td>
                                <td className="p-2 whitespace-nowrap">{TX_LABELS[t.type] || t.type}</td>
                                <td className="p-2 text-gray-500">{t.note}</td>
                                <td className={`p-2 text-right font-bold whitespace-nowrap ${t.amount >= 0 ? 'text-green-700' : 'text-red-600'}`}>{t.amount >= 0 ? '+' : '−'}{taka(Math.abs(t.amount))}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <Pager meta={data?.meta} page={page} setPage={setPage} />
            </div>
        </div>
    );
}
