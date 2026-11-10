"use client";

import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useGetMlmSettingsQuery, useUpdateMlmSettingsMutation, errMsg, taka } from '@/redux/api/mlmApi';
import { PageHead, Panel, inputCls, btnPrimary } from '@/components/mlm/AdminUi';
import { LINK_COLORS } from '@/components/mlm/GTree';

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
    <label className="block">
        <span className="text-xs font-semibold text-gray-600">{label}</span>
        <div className="mt-1">{children}</div>
        {hint && <span className="text-[11px] text-gray-400">{hint}</span>}
    </label>
);

export default function MlmSettingsPage() {
    const { data, isLoading } = useGetMlmSettingsQuery();
    const [save, { isLoading: saving }] = useUpdateMlmSettingsMutation();
    const [f, setF] = useState<any>(null);

    useEffect(() => {
        if (data?.data) setF(JSON.parse(JSON.stringify(data.data)));
    }, [data]);

    if (isLoading || !f) return <div className="p-10 text-center text-gray-400 animate-pulse">Loading…</div>;

    const set = (path: string, value: any) => setF((prev: any) => {
        const next = JSON.parse(JSON.stringify(prev));
        const keys = path.split('.');
        let o = next;
        keys.slice(0, -1).forEach(k => { o = o[k]; });
        o[keys[keys.length - 1]] = value;
        return next;
    });
    const num = (e: React.ChangeEvent<HTMLInputElement>) => (e.target.value === '' ? '' : Number(e.target.value));
    const setRank = (i: number, key: string, value: any) => setF((prev: any) => {
        const next = JSON.parse(JSON.stringify(prev));
        next.ranks[i][key] = value;
        return next;
    });
    const setLink = (i: number, k: number, value: any) => setF((prev: any) => {
        const next = JSON.parse(JSON.stringify(prev));
        next.ranks[i].links[k] = value;
        return next;
    });

    const shareTotal = f.ranks.reduce((a: number, r: any) => a + (Number(r.sharePercent) || 0), 0);
    const totalTeam = (level: number) => {
        let t = f.ranks[0]?.directTarget || 0;
        for (let i = 1; i < level; i++) t += f.ranks[i].links.reduce((a: number, b: any) => a + (Number(b) || 0), 0);
        return t;
    };

    const onSave = async () => {
        if (shareTotal > 100) { toast.error(`Rank shares add up to ${shareTotal}% — keep it 100% or less`); return; }
        try {
            await save({
                pointValue: f.pointValue,
                membershipPoints: f.membershipPoints,
                referralBonus: f.referralBonus,
                generationCommission: f.generationCommission,
                club: f.club,
                withdraw: f.withdraw,
                ranks: f.ranks,
            }).unwrap();
            toast.success('Membership settings saved');
        } catch (e) { toast.error(errMsg(e)); }
    };

    return (
        <div className="space-y-5 pb-20">
            <PageHead title="Membership Settings" sub="Every number of the reward system. Changes apply to new events from now on."
                right={<button onClick={onSave} disabled={saving} className={btnPrimary}>{saving ? 'Saving…' : 'Save settings'}</button>} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Panel title="Points & Membership">
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="1 point = (৳)"><input type="number" min={0} className={inputCls} value={f.pointValue} onChange={e => set('pointValue', num(e))} /></Field>
                        <Field label="Points needed for membership" hint={`= ${taka((Number(f.membershipPoints) || 0) * (Number(f.pointValue) || 0))} of shopping`}>
                            <input type="number" min={1} className={inputCls} value={f.membershipPoints} onChange={e => set('membershipPoints', num(e))} />
                        </Field>
                    </div>
                    <p className="text-xs text-gray-400 mt-3">Points per product are set on each product&apos;s edit page.</p>
                </Panel>

                <Panel title="Referral Bonus">
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Bonus amount (৳)"><input type="number" min={0} className={inputCls} value={f.referralBonus.amount} onChange={e => set('referralBonus.amount', num(e))} /></Field>
                        <Field label="Active referrals needed"><input type="number" min={1} className={inputCls} value={f.referralBonus.requiredReferrals} onChange={e => set('referralBonus.requiredReferrals', num(e))} /></Field>
                    </div>
                    <label className="flex items-center gap-2 mt-3 text-sm">
                        <input type="checkbox" checked={!!f.referralBonus.repeat} onChange={e => set('referralBonus.repeat', e.target.checked)} />
                        Pay again for every next {f.referralBonus.requiredReferrals || 'N'} referrals <span className="text-xs text-gray-400">(off = paid once in a lifetime)</span>
                    </label>
                </Panel>

                <Panel title="Generation Commission">
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Amount shared with upline (৳)" hint="Shared every time someone gets the referral bonus">
                            <input type="number" min={0} className={inputCls} value={f.generationCommission.amount} onChange={e => set('generationCommission.amount', num(e))} />
                        </Field>
                        <Field label="Upline levels counted" hint="0 = every level above">
                            <input type="number" min={0} className={inputCls} value={f.generationCommission.depth} onChange={e => set('generationCommission.depth', num(e))} />
                        </Field>
                    </div>
                </Panel>

                <Panel title="Rank Club">
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Each delivered order adds">
                            <select className={inputCls} value={f.club.contributionType} onChange={e => set('club.contributionType', e.target.value)}>
                                <option value="fixed">A fixed amount (৳)</option>
                                <option value="percent">% of the order total</option>
                                <option value="perPoint">৳ per point earned</option>
                            </select>
                        </Field>
                        <Field label={f.club.contributionType === 'percent' ? 'Percent (%)' : 'Amount (৳)'}>
                            <input type="number" min={0} step="0.01" className={inputCls} value={f.club.contributionValue} onChange={e => set('club.contributionValue', num(e))} />
                        </Field>
                        <Field label="Distribute automatically">
                            <select className={inputCls} value={f.club.frequency} onChange={e => set('club.frequency', e.target.value)}>
                                <option value="manual">No — only by the button</option>
                                <option value="daily">Every day</option>
                                <option value="weekly">Every week</option>
                                <option value="monthly">Every 30 days</option>
                            </select>
                        </Field>
                    </div>
                </Panel>

                <Panel title="Withdraw">
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Minimum withdraw (৳)"><input type="number" min={0} className={inputCls} value={f.withdraw.minAmount} onChange={e => set('withdraw.minAmount', num(e))} /></Field>
                        <Field label="Company charge (%)"><input type="number" min={0} max={100} className={inputCls} value={f.withdraw.chargePercent} onChange={e => set('withdraw.chargePercent', num(e))} /></Field>
                    </div>
                </Panel>
            </div>

            <Panel title="Ranks, targets, shares & rewards"
                right={<span className={`text-xs font-bold px-2 py-1 rounded ${shareTotal > 100 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>Shares total {shareTotal}%{shareTotal < 100 ? ` · ${100 - shareTotal}% to company` : ''}</span>}>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[900px]">
                        <thead>
                            <tr className="text-xs text-gray-500 border-b bg-gray-50">
                                <th className="p-2 text-left w-12">Rank</th><th className="p-2 text-left">Name</th>
                                {[0, 1, 2, 3].map(i => <th key={i} className="p-2" style={{ color: LINK_COLORS[i] }}>Link {i + 1}</th>)}
                                <th className="p-2">Total team</th><th className="p-2">Share %</th><th className="p-2 text-left">Reward</th>
                            </tr>
                        </thead>
                        <tbody>
                            {f.ranks.map((r: any, i: number) => (
                                <tr key={r.level} className="border-b border-gray-50">
                                    <td className="p-2 font-bold">{r.level}</td>
                                    <td className="p-2"><input className={inputCls} value={r.name} onChange={e => setRank(i, 'name', e.target.value)} /></td>
                                    {i === 0 ? (
                                        <td colSpan={4} className="p-2">
                                            <div className="flex items-center gap-2"><input type="number" min={1} className={`${inputCls} w-24`} value={r.directTarget} onChange={e => setRank(i, 'directTarget', num(e))} /><span className="text-xs text-gray-500">direct active referrals</span></div>
                                        </td>
                                    ) : [0, 1, 2, 3].map(k => (
                                        <td key={k} className="p-2"><input type="number" min={0} className={`${inputCls} w-24`} value={r.links[k]} onChange={e => setLink(i, k, num(e))} /></td>
                                    ))}
                                    <td className="p-2 text-center text-gray-600 font-semibold">{totalTeam(r.level).toLocaleString()}</td>
                                    <td className="p-2"><input type="number" min={0} max={100} className={`${inputCls} w-20`} value={r.sharePercent} onChange={e => setRank(i, 'sharePercent', num(e))} /></td>
                                    <td className="p-2"><input className={inputCls} value={r.reward} placeholder="e.g. Cox's Bazar Tour" onChange={e => setRank(i, 'reward', e.target.value)} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className="text-xs text-gray-400 mt-3">Link numbers are NEW active members needed for that rank, on top of the previous rank. Link 1–3 are the member&apos;s three biggest teams, Link 4 is all his other teams together. The share % is used for both the generation commission and the Rank Club.</p>
            </Panel>

            <div className="flex justify-end">
                <button onClick={onSave} disabled={saving} className={btnPrimary}>{saving ? 'Saving…' : 'Save settings'}</button>
            </div>
        </div>
    );
}
