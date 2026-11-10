"use client";

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { FiCreditCard, FiSend, FiList } from 'react-icons/fi';
import {
    useGetMySummaryQuery, useGetMyTransactionsQuery, useGetMyWithdrawsQuery, useCreateWithdrawMutation,
    errMsg, taka, TX_LABELS,
} from '@/redux/api/mlmApi';

const STATUS_CLS: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700',
    approved: 'bg-green-50 text-green-700',
    rejected: 'bg-red-50 text-red-700',
};

export default function WalletPage() {
    const { data: sum } = useGetMySummaryQuery();
    const [page, setPage] = useState(1);
    const [type, setType] = useState('');
    const { data: txData, isFetching } = useGetMyTransactionsQuery({ page, type: type || undefined });
    const { data: wData } = useGetMyWithdrawsQuery();
    const [createWithdraw, { isLoading }] = useCreateWithdrawMutation();
    const [form, setForm] = useState({ amount: '', method: 'bkash', accountNumber: '' });

    const s = sum?.data;
    const tx: any[] = txData?.data || [];
    const meta = txData?.meta;
    const withdraws: any[] = wData?.data || [];
    const chargePct = s?.withdraw?.chargePercent ?? 0;
    const amountNum = Number(form.amount) || 0;
    const charge = Math.floor(amountNum * chargePct) / 100;

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createWithdraw({ amount: amountNum, method: form.method, accountNumber: form.accountNumber.trim() }).unwrap();
            toast.success('Withdraw request sent. Admin will send the money soon.');
            setForm({ amount: '', method: form.method, accountNumber: form.accountNumber });
        } catch (err) { toast.error(errMsg(err)); }
    };

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Balance', value: s?.walletBalance, cls: 'text-green-700 bg-green-50' },
                    { label: 'Total earned', value: s?.totalEarned, cls: 'text-blue-700 bg-blue-50' },
                    { label: 'Pending withdraw', value: s?.pendingWithdraw, cls: 'text-amber-700 bg-amber-50' },
                    { label: 'Withdraw charge', value: null, text: `${chargePct}%`, cls: 'text-gray-700 bg-gray-50' },
                ].map(c => (
                    <div key={c.label} className={`rounded-xl p-4 ${c.cls}`}>
                        <p className="text-xs text-gray-500">{c.label}</p>
                        <p className="text-2xl font-extrabold">{c.text ?? taka(c.value as number)}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                {/* Withdraw form */}
                <form onSubmit={submit} className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2"><FiSend className="text-[var(--color-primary)]" /> Withdraw</h3>
                    {s?.memberStatus !== 'active' && <p className="text-xs text-amber-700 bg-amber-50 rounded-md p-2">Only Active members can withdraw.</p>}
                    <div>
                        <label className="text-xs font-semibold text-gray-600">Amount (min {taka(s?.withdraw?.minAmount)})</label>
                        <input type="number" min={0} step="0.01" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                            className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-md outline-none focus:border-[var(--color-primary)] font-bold" placeholder="0" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {['bkash', 'nagad'].map(m => (
                            <button type="button" key={m} onClick={() => setForm({ ...form, method: m })}
                                className={`py-2 rounded-md border text-sm font-bold ${form.method === m ? 'border-[var(--color-primary)] bg-green-50 text-[var(--color-primary)]' : 'border-gray-200 text-gray-500'}`}>
                                {m === 'bkash' ? 'bKash' : 'Nagad'}
                            </button>
                        ))}
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-gray-600">{form.method === 'bkash' ? 'bKash' : 'Nagad'} number</label>
                        <input required value={form.accountNumber} onChange={e => setForm({ ...form, accountNumber: e.target.value })} placeholder="01XXXXXXXXX"
                            className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-md outline-none focus:border-[var(--color-primary)]" />
                    </div>
                    {amountNum > 0 && (
                        <div className="text-xs bg-gray-50 rounded-md p-3 space-y-1">
                            <div className="flex justify-between"><span>Amount</span><span>{taka(amountNum)}</span></div>
                            <div className="flex justify-between text-red-600"><span>Company charge ({chargePct}%)</span><span>− {taka(charge)}</span></div>
                            <div className="flex justify-between font-bold text-gray-800 border-t pt-1"><span>You receive</span><span>{taka(amountNum - charge)}</span></div>
                        </div>
                    )}
                    <button disabled={isLoading || s?.memberStatus !== 'active'} className="w-full py-2.5 rounded-lg font-bold text-sm bg-[var(--color-primary)] text-[var(--color-primary-foreground)] disabled:opacity-40">
                        {isLoading ? 'Sending…' : 'Send withdraw request'}
                    </button>
                </form>

                {/* Withdraw history */}
                <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-3"><FiCreditCard className="text-[var(--color-primary)]" /> Withdraw requests</h3>
                    {withdraws.length === 0 ? <p className="text-sm text-gray-400">No withdraw requests yet.</p> : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead><tr className="text-xs text-gray-500 border-b"><th className="py-2 text-left">Date</th><th className="text-left">Method</th><th className="text-right">Amount</th><th className="text-right">You get</th><th className="text-center">Status</th></tr></thead>
                                <tbody>
                                    {withdraws.map(w => (
                                        <tr key={w._id} className="border-b border-gray-50">
                                            <td className="py-2">{new Date(w.createdAt).toLocaleDateString()}</td>
                                            <td className="capitalize">{w.method} <span className="text-gray-400 text-xs">{w.accountNumber}</span></td>
                                            <td className="text-right">{taka(w.amount)}</td>
                                            <td className="text-right font-semibold">{taka(w.payable)}</td>
                                            <td className="text-center"><span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${STATUS_CLS[w.status]}`}>{w.status}</span>
                                                {w.adminNote && <p className="text-[10px] text-gray-400">{w.adminNote}</p>}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Transactions */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2"><FiList className="text-[var(--color-primary)]" /> Earning & wallet history</h3>
                    <select value={type} onChange={e => { setType(e.target.value); setPage(1); }} className="text-sm border border-gray-200 rounded-md px-2 py-1.5">
                        <option value="">All</option>
                        {Object.entries(TX_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                </div>
                {tx.length === 0 ? <p className="text-sm text-gray-400">{isFetching ? 'Loading…' : 'Nothing here yet.'}</p> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="text-xs text-gray-500 border-b"><th className="py-2 text-left">Date</th><th className="text-left">Type</th><th className="text-left">Details</th><th className="text-right">Amount</th></tr></thead>
                            <tbody>
                                {tx.map(t => (
                                    <tr key={t._id} className="border-b border-gray-50">
                                        <td className="py-2 whitespace-nowrap">{new Date(t.createdAt).toLocaleString()}</td>
                                        <td className="whitespace-nowrap">{TX_LABELS[t.type] || t.type}</td>
                                        <td className="text-gray-500">{t.note}</td>
                                        <td className={`text-right font-bold whitespace-nowrap ${t.amount >= 0 ? 'text-green-700' : 'text-red-600'}`}>{t.amount >= 0 ? '+' : '−'}{taka(Math.abs(t.amount))}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {meta && meta.totalPages > 1 && (
                    <div className="flex justify-end gap-2 mt-3">
                        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 text-sm rounded border disabled:opacity-40">Prev</button>
                        <span className="text-sm text-gray-500 py-1">{page} / {meta.totalPages}</span>
                        <button disabled={page >= meta.totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 text-sm rounded border disabled:opacity-40">Next</button>
                    </div>
                )}
            </div>
        </div>
    );
}
