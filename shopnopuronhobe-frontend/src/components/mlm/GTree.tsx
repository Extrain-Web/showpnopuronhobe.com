"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FiArrowLeft, FiSearch, FiZoomIn, FiZoomOut, FiUsers, FiX, FiHome } from 'react-icons/fi';
import { useGetTreeQuery, useLazySearchTreeQuery } from '@/redux/api/mlmApi';

export const LINK_COLORS = ['#dc2626', '#2563eb', '#16a34a', '#9333ea']; // Link 1..4

// Active members, pending requests and plain customers get different card colors.
const statusChip = (s: string) => {
    if (s === 'active') return { label: 'Active', cls: 'bg-green-50 text-green-700 border-green-200', card: 'bg-white' };
    if (s === 'pending') return { label: 'Pending', cls: 'bg-amber-50 text-amber-700 border-amber-200', card: 'bg-amber-50' };
    return { label: 'Customer', cls: 'bg-white text-gray-500 border-gray-200', card: 'bg-gray-100' };
};

function NodeCard({ n, linkIndex, onOpen, highlight }: { n: any; linkIndex?: number; onOpen?: () => void; highlight?: boolean }) {
    const chip = statusChip(n.memberStatus);
    const border = linkIndex !== undefined ? LINK_COLORS[linkIndex] : 'var(--color-primary)';
    return (
        <div
            data-node-id={String(n._id)}
            className={`relative ${chip.card} rounded-xl border-2 shadow-sm w-[190px] p-3 text-center transition ${highlight ? 'ring-4 ring-amber-300' : ''}`}
            style={{ borderColor: border, borderStyle: n.memberStatus === 'active' ? 'solid' : 'dashed' }}
        >
            {linkIndex !== undefined && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white px-2 py-0.5 rounded-full" style={{ background: border }}>
                    Link {linkIndex + 1}
                </span>
            )}
            <p className="font-bold text-gray-800 text-sm truncate mt-1" title={n.name}>{n.name || 'Member'}</p>
            <p className="text-xs text-gray-400 font-medium">#{n.memberId}</p>
            <div className="flex flex-wrap justify-center gap-1 mt-2">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${chip.cls}`}>{chip.label}</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200">{n.rankName}</span>
            </div>
            <div className="grid grid-cols-4 gap-1 mt-2">
                {(n.links || [false, false, false, false]).map((filled: boolean, i: number) => (
                    <span key={i} className={`text-[9px] font-bold py-0.5 rounded ${filled ? 'text-white' : 'bg-gray-100 text-gray-400'}`}
                        style={filled ? { background: LINK_COLORS[i] } : undefined}
                        title={`Link ${i + 1}: ${filled ? `Filled (${n.legs?.[i] || 0})` : 'Open'}`}>
                        L{i + 1} {filled ? '✓' : '○'}
                    </span>
                ))}
            </div>
            <p className="text-[11px] text-gray-500 mt-2"><FiUsers className="inline -mt-0.5" size={11} /> Team {n.teamActiveCount} · Direct {n.childCount}</p>
            {onOpen && n.childCount > 0 && (
                <button onClick={onOpen} className="mt-2 w-full text-xs font-bold py-1.5 rounded-md bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:opacity-90">
                    View team ({n.childCount})
                </button>
            )}
        </div>
    );
}

export default function GTree({ startNode }: { startNode?: string }) {
    const [stack, setStack] = useState<string[]>(startNode ? [startNode] : []);
    const current = stack[stack.length - 1];
    const { data, isFetching, isError, error } = useGetTreeQuery(current);
    const [zoom, setZoom] = useState(1);
    const [q, setQ] = useState('');
    const [runSearch, { data: searchRes, isFetching: searching }] = useLazySearchTreeQuery();
    const [hit, setHit] = useState(0);
    const [highlightId, setHighlightId] = useState<string | null>(null);

    useEffect(() => { setStack(startNode ? [startNode] : []); }, [startNode]);

    const tree = data?.data;
    const results: any[] = searchRes?.data || [];

    // Children ordered by team size: the 3 biggest are Link 1–3, the rest together are Link 4.
    const children = useMemo(() => {
        const list = [...(tree?.children || [])];
        list.sort((a, b) => ((b.memberStatus === 'active' ? 1 : 0) + b.teamActiveCount) - ((a.memberStatus === 'active' ? 1 : 0) + a.teamActiveCount));
        return list.map((c, i) => ({ ...c, linkIndex: Math.min(i, 3) }));
    }, [tree]);

    // ── Pan (drag with the mouse) and pinch-zoom (two fingers) on the canvas ──
    const canvasRef = useRef<HTMLDivElement>(null);
    const pointers = useRef(new Map<number, { x: number; y: number }>());
    const dragStart = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
    const pinchStart = useRef<{ dist: number; zoom: number } | null>(null);
    const [dragging, setDragging] = useState(false);
    const clampZoom = (z: number) => Math.min(1.6, Math.max(0.5, +z.toFixed(2)));
    const pinchDist = () => {
        const [a, b] = [...pointers.current.values()];
        return Math.hypot(a.x - b.x, a.y - b.y);
    };

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('button, a, input')) return; // keep card buttons clickable
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size === 2) {
            pinchStart.current = { dist: pinchDist(), zoom };
            dragStart.current = null;
        } else if (e.pointerType === 'mouse' && e.button === 0 && canvasRef.current) {
            dragStart.current = { x: e.clientX, y: e.clientY, left: canvasRef.current.scrollLeft, top: canvasRef.current.scrollTop };
            setDragging(true);
            e.currentTarget.setPointerCapture(e.pointerId);
        }
    };
    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!pointers.current.has(e.pointerId)) return;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pinchStart.current && pointers.current.size === 2) {
            setZoom(clampZoom(pinchStart.current.zoom * (pinchDist() / pinchStart.current.dist)));
        } else if (dragStart.current && canvasRef.current) {
            canvasRef.current.scrollLeft = dragStart.current.left - (e.clientX - dragStart.current.x);
            canvasRef.current.scrollTop = dragStart.current.top - (e.clientY - dragStart.current.y);
        }
    };
    const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        pointers.current.delete(e.pointerId);
        if (pointers.current.size < 2) pinchStart.current = null;
        if (pointers.current.size === 0) { dragStart.current = null; setDragging(false); }
    };
    // Ctrl + mouse wheel zooms, like a map. Needs a non-passive listener to stop the page zooming.
    const hasTree = !!tree;
    useEffect(() => {
        const el = canvasRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            if (!e.ctrlKey) return;
            e.preventDefault();
            setZoom(z => clampZoom(z + (e.deltaY < 0 ? 0.1 : -0.1)));
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [hasTree]);

    // Bring a found member's card into view once its level has loaded.
    useEffect(() => {
        if (!highlightId || isFetching) return;
        const el = canvasRef.current?.querySelector(`[data-node-id="${highlightId}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }, [highlightId, isFetching, tree]);

    const goTo = (id: string) => setStack(s => [...s, id]);
    const back = () => setStack(s => s.slice(0, -1));

    const showResult = (i: number) => {
        const r = results[i];
        if (!r) return;
        setHit(i);
        setHighlightId(String(r._id));
        // Open the found member's parent so the card is visible among its siblings.
        if (r.parentId) goTo(String(r.parentId)); else goTo(String(r._id));
    };

    const doSearch = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!q.trim()) return;
        const res = await runSearch(q.trim()).unwrap().catch(() => null);
        const list = res?.data || [];
        setHit(0);
        if (list.length) {
            setHighlightId(String(list[0]._id));
            if (list[0].parentId) goTo(String(list[0].parentId)); else goTo(String(list[0]._id));
        }
    };

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
                <button onClick={back} disabled={stack.length === 0 || (!!startNode && stack.length === 1)}
                    className="w-10 h-10 rounded-full bg-green-50 text-[var(--color-primary)] flex items-center justify-center disabled:opacity-40" title="Back">
                    <FiArrowLeft size={18} />
                </button>
                <button onClick={() => { setStack(startNode ? [startNode] : []); setHighlightId(null); }}
                    className="w-10 h-10 rounded-full bg-green-50 text-[var(--color-primary)] flex items-center justify-center" title="Back to the top">
                    <FiHome size={17} />
                </button>
                <form onSubmit={doSearch} className="flex-1 min-w-[220px] flex items-center gap-2 bg-green-50 rounded-full px-4 h-10">
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name or Member ID…"
                        className="flex-1 bg-transparent outline-none text-sm" />
                    {q && <button type="button" onClick={() => { setQ(''); setHighlightId(null); }} className="text-gray-400"><FiX /></button>}
                    <button type="submit" className="text-[var(--color-primary)]" title="Search"><FiSearch size={17} /></button>
                </form>
                <span className="text-sm text-gray-500 min-w-[48px] text-center">
                    {searching ? '…' : `${results.length ? hit + 1 : 0}/${results.length}`}
                </span>
                {results.length > 1 && (
                    <button onClick={() => showResult((hit + 1) % results.length)} className="text-xs font-bold px-3 h-10 rounded-full bg-gray-100">Next</button>
                )}
                <div className="flex items-center gap-1">
                    <button onClick={() => setZoom(z => Math.max(0.5, +(z - 0.1).toFixed(2)))} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center" title="Zoom out"><FiZoomOut /></button>
                    <span className="text-xs w-10 text-center text-gray-500">{Math.round(zoom * 100)}%</span>
                    <button onClick={() => setZoom(z => Math.min(1.6, +(z + 0.1).toFixed(2)))} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center" title="Zoom in"><FiZoomIn /></button>
                </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                <span className="w-full text-gray-400">Drag the tree to move it · pinch or Ctrl + scroll to zoom · tap “View team” to open a member&apos;s team</span>
                <span className="flex items-center gap-1.5"><span className="w-4 h-3 rounded border-2 border-gray-500 bg-white" /> Active member</span>
                <span className="flex items-center gap-1.5"><span className="w-4 h-3 rounded border-2 border-dashed border-amber-500 bg-amber-50" /> Pending</span>
                <span className="flex items-center gap-1.5"><span className="w-4 h-3 rounded border-2 border-dashed border-gray-400 bg-gray-100" /> Customer</span>
                {LINK_COLORS.map((c, i) => (
                    <span key={i} className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ background: c }} /> Link {i + 1}{i === 3 ? ' (all other legs)' : ''}</span>
                ))}
            </div>

            {/* Canvas — drag (or scroll) to pan, pinch / Ctrl+wheel to zoom */}
            <div
                ref={canvasRef}
                onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
                className={`bg-[#f6fffa] border border-green-100 rounded-xl overflow-auto min-h-[420px] max-h-[75vh] select-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                style={{ touchAction: 'pan-x pan-y' }}
            >
                {isError ? (
                    <p className="p-10 text-center text-red-500 text-sm">{(error as any)?.data?.message || 'Could not load the tree'}</p>
                ) : !tree ? (
                    <p className="p-10 text-center text-gray-400 text-sm animate-pulse">Loading tree…</p>
                ) : (
                    <div className={`inline-block min-w-full p-8 origin-top-left transition-opacity ${isFetching ? 'opacity-60' : ''}`} style={{ transform: `scale(${zoom})` }}>
                        <div className="flex flex-col items-center">
                            <NodeCard n={tree.node} highlight={highlightId === String(tree.node._id)} />
                            {children.length > 0 && (
                                <>
                                    <div className="w-0.5 h-8 bg-gray-300" />
                                    <div className="relative flex gap-6 pt-6">
                                        {/* horizontal connector */}
                                        {children.length > 1 && <div className="absolute top-0 left-[95px] right-[95px] h-0.5 bg-gray-300" />}
                                        {children.map((c: any) => (
                                            <div key={c._id} className="relative flex flex-col items-center">
                                                <div className="absolute -top-6 w-0.5 h-6" style={{ background: LINK_COLORS[c.linkIndex] }} />
                                                <NodeCard n={c} linkIndex={c.linkIndex} onOpen={() => goTo(String(c._id))} highlight={highlightId === String(c._id)} />
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                            {children.length === 0 && <p className="mt-6 text-sm text-gray-400">No team members under this member yet.</p>}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
