"use client";

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useGetMlmWithdrawsQuery, useProcessWithdrawMutation, errMsg, taka } from '@/redux/api/mlmApi';
import { PageHead, Pager, memberName, inputCls } from '@/components/mlm/AdminUi';

const STATUS_CLS: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700', approved: 'bg-green-50 text-green-700', rejected: 'bg-red-50 text-red-700',
};

export default function AdminWithdrawsPage() {
    const [page, setPage] = useState(1);
    const [status, setStatus] = useState('pending');
    const { data, isFetching } = useGetMlmWithdrawsQuery({ page, status: status || undefined });
    const [processWithdraw] = useProcessWithdrawMutation();
    const [busy, setBusy] = useState<string | null>(null);
    const rows: any[] = data?.data || [];

    const approve = async (w: any) => {
        const transactionId = prompt(`Send ${taka(w.payable)} to ${w.method} ${w.accountNumber}, then enter the transaction ID:`);
        if (transactionId === null) return;
        setBusy(w._id);
        try { await processWithdraw({ id: w._id, status: 'approved', transactionId }).unwrap(); toast.success('Withdraw approved'); }
        catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
    };
    const reject = async (w: any) => {
        const adminNote = prompt('Reason for rejecting (the money goes back to the wallet):');
        if (adminNote === null) return;
        setBusy(w._id);
        try { await processWithdraw({ id: w._id, status: 'rejected', adminNote }).unwrap(); toast.success('Rejected — money returned to wallet'); }
        catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
    };

    return (
        <div>
            <PageHead title="Withdraw Requests" sub="Send the payable amount by bKash/Nagad, then approve. Rejecting returns the money to the member's wallet."
                right={
                    <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className={`${inputCls} w-auto`}>
                        <option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="">All</option>
                    </select>
                } />
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-xs text-gray-500 border-b bg-gray-50">
                            <th className="p-2 text-left">Date</th><th className="p-2 text-left">Member</th><th className="p-2 text-left">Send to</th>
                            <th className="p-2 text-right">Amount</th><th className="p-2 text-right">Charge</th><th className="p-2 text-right">Payable</th>
                            <th className="p-2 text-center">Status</th><th className="p-2 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-gray-400">{isFetching ? 'Loading…' : 'No withdraw requests.'}</td></tr>}
                        {rows.map(w => (
                            <tr key={w._id} className="border-b border-gray-50">
                                <td className="p-2 whitespace-nowrap">{new Date(w.createdAt).toLocaleString()}</td>
                                <td className="p-2"><p className="font-semibold">{memberName(w.user)}</p><p className="text-xs text-gray-400">#{w.user?.memberId} · {w.user?.phone}</p></td>
                                <td className="p-2"><span className="capitalize font-semibold">{w.method}</span> <span className="text-gray-500">{w.accountNumber}</span></td>
                                <td className="p-2 text-right">{taka(w.amount)}</td>
                                <td className="p-2 text-right text-red-600">{taka(w.charge)} <span className="text-xs text-gray-400">({w.chargePercent}%)</span></td>
                                <td className="p-2 text-right font-bold">{taka(w.payable)}</td>
                                <td className="p-2 text-center">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${STATUS_CLS[w.status]}`}>{w.status}</span>
                                    {(w.transactionId || w.adminNote) && <p className="text-[10px] text-gray-400">{w.transactionId || w.adminNote}</p>}
                                </td>
                                <td className="p-2 text-right whitespace-nowrap">
                                    {w.status === 'pending' && (
                                        <>
                                            <button disabled={busy === w._id} onClick={() => approve(w)} className="px-3 py-1 rounded bg-green-600 text-white text-xs font-bold mr-1 disabled:opacity-40">Approve</button>
                                            <button disabled={busy === w._id} onClick={() => reject(w)} className="px-3 py-1 rounded bg-red-500 text-white text-xs font-bold disabled:opacity-40">Reject</button>
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <Pager meta={data?.meta} page={page} setPage={setPage} />
            </div>
        </div>
    );
}
