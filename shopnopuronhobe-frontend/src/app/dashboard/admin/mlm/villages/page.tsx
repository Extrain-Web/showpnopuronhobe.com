"use client";

import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { FiEdit2, FiTrash2, FiCheck, FiX, FiPlus } from 'react-icons/fi';
import { BD_DIVISIONS, BD_LOCATIONS } from '@/data/bdLocations';
import {
    useGetAdminVillagesQuery, useAddVillageMutation, useUpdateVillageMutation, useDeleteVillageMutation, errMsg,
} from '@/redux/api/mlmApi';
import { PageHead, Panel, Pager, inputCls, btnPrimary } from '@/components/mlm/AdminUi';

export default function AdminVillagesPage() {
    const [page, setPage] = useState(1);
    const [division, setDivision] = useState('');
    const [district, setDistrict] = useState('');
    const [search, setSearch] = useState('');
    const { data, isFetching } = useGetAdminVillagesQuery({
        page, division: division || undefined, district: district || undefined, search: search.trim() || undefined,
    });
    const rows: any[] = data?.data || [];

    // New village form
    const [form, setForm] = useState({ division: '', district: '', name: '' });
    const [addVillage, { isLoading: adding }] = useAddVillageMutation();
    const [updateVillage] = useUpdateVillageMutation();
    const [deleteVillage] = useDeleteVillageMutation();
    const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

    const add = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await addVillage(form).unwrap();
            toast.success(`${form.name} added to ${form.district}`);
            setForm(f => ({ ...f, name: '' }));
        } catch (err) { toast.error(errMsg(err)); }
    };

    const saveEdit = async () => {
        if (!editing) return;
        try {
            await updateVillage(editing).unwrap();
            toast.success('Village renamed');
            setEditing(null);
        } catch (err) { toast.error(errMsg(err)); }
    };

    const remove = async (v: any) => {
        if (!window.confirm(`Remove "${v.name}" from the list? Members who already chose it keep their address.`)) return;
        try {
            await deleteVillage(v._id).unwrap();
            toast.success('Village removed');
        } catch (err) { toast.error(errMsg(err)); }
    };

    return (
        <div>
            <PageHead title="Villages" sub="The village list on the registration form. Members can add a new village; you can add, rename or remove them here." />

            <Panel title="Add a village" className="mb-5">
                <form onSubmit={add} className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <select required value={form.division} onChange={e => setForm({ division: e.target.value, district: '', name: form.name })} className={inputCls}>
                        <option value="">Division</option>
                        {BD_DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <select required value={form.district} disabled={!form.division} onChange={e => setForm(f => ({ ...f, district: e.target.value }))} className={inputCls}>
                        <option value="">District</option>
                        {(BD_LOCATIONS[form.division] || []).map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <input required minLength={2} maxLength={60} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Village name" className={inputCls} />
                    <button disabled={adding} className={`${btnPrimary} flex items-center justify-center gap-1.5`}><FiPlus /> {adding ? 'Adding…' : 'Add village'}</button>
                </form>
            </Panel>

            <Panel title="All villages" right={<span className="text-xs text-gray-400">{data?.meta?.total ?? 0} total</span>}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                    <select value={division} onChange={e => { setDivision(e.target.value); setDistrict(''); setPage(1); }} className={inputCls}>
                        <option value="">All divisions</option>
                        {BD_DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <select value={district} disabled={!division} onChange={e => { setDistrict(e.target.value); setPage(1); }} className={inputCls}>
                        <option value="">All districts</option>
                        {(BD_LOCATIONS[division] || []).map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search village…" className={inputCls} />
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-xs text-gray-500 border-b bg-gray-50">
                                <th className="p-2 text-left">Village</th><th className="p-2 text-left">District</th><th className="p-2 text-left">Division</th>
                                <th className="p-2 text-right">Members</th><th className="p-2 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-400">{isFetching ? 'Loading…' : 'No villages yet.'}</td></tr>}
                            {rows.map(v => (
                                <tr key={v._id} className="border-b border-gray-50">
                                    <td className="p-2 font-semibold">
                                        {editing?.id === v._id ? (
                                            <input autoFocus value={editing?.name ?? ''} onChange={e => setEditing({ id: v._id, name: e.target.value })}
                                                onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(null); }}
                                                className={`${inputCls} max-w-[240px]`} />
                                        ) : v.name}
                                    </td>
                                    <td className="p-2">{v.district}</td>
                                    <td className="p-2 text-gray-500">{v.division}</td>
                                    <td className="p-2 text-right">{v.memberCount || 0}</td>
                                    <td className="p-2">
                                        <div className="flex justify-end gap-1.5">
                                            {editing?.id === v._id ? (
                                                <>
                                                    <button onClick={saveEdit} title="Save" className="w-8 h-8 rounded-md bg-green-50 text-green-700 flex items-center justify-center"><FiCheck /></button>
                                                    <button onClick={() => setEditing(null)} title="Cancel" className="w-8 h-8 rounded-md bg-gray-100 text-gray-600 flex items-center justify-center"><FiX /></button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => setEditing({ id: v._id, name: v.name })} title="Rename" className="w-8 h-8 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center"><FiEdit2 /></button>
                                                    <button onClick={() => remove(v)} title="Remove" className="w-8 h-8 rounded-md bg-red-50 text-red-600 flex items-center justify-center"><FiTrash2 /></button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <Pager meta={data?.meta} page={page} setPage={setPage} />
            </Panel>
        </div>
    );
}
