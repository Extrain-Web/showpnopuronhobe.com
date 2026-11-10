"use client";

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { FiBell } from 'react-icons/fi';
import { useGetMyNotificationsQuery, useReadNotificationsMutation } from '@/redux/api/mlmApi';

const ICON: Record<string, string> = {
    points: '⭐', membership: '🎫', bonus: '🎁', generation: '👥', club: '🏦', rank: '🏆', withdraw: '💸', wallet: '👛',
};

const ago = (d: string) => {
    const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
    return new Date(d).toLocaleDateString();
};

export default function NotificationBell() {
    const { data } = useGetMyNotificationsQuery(undefined, { pollingInterval: 60000 });
    const [markRead] = useReadNotificationsMutation();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const list: any[] = data?.data || [];
    const unread: number = data?.meta?.unread || 0;

    useEffect(() => {
        const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const toggle = () => {
        const next = !open;
        setOpen(next);
        if (next && unread > 0) markRead();
    };

    return (
        <div className="relative" ref={ref}>
            <button onClick={toggle} className="relative w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600" aria-label={`Notifications${unread ? ` (${unread} new)` : ''}`}>
                <FiBell size={17} />
                {unread > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{unread > 9 ? '9+' : unread}</span>
                )}
            </button>
            {open && (
                <div className="absolute right-0 mt-2 w-[320px] max-w-[calc(100vw-24px)] bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 font-bold text-gray-800 text-sm">Notifications</div>
                    <div className="max-h-[380px] overflow-y-auto">
                        {list.length === 0 ? (
                            <p className="p-6 text-center text-sm text-gray-400">No notifications yet</p>
                        ) : list.map(n => (
                            <Link key={n._id} href={n.link || '#'} onClick={() => setOpen(false)}
                                className={`flex gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 ${n.read ? '' : 'bg-green-50/50'}`}>
                                <span className="text-lg leading-none mt-0.5">{ICON[n.type] || '🔔'}</span>
                                <span className="flex-1 min-w-0">
                                    <span className="block text-sm font-semibold text-gray-800">{n.title}</span>
                                    {n.message && <span className="block text-xs text-gray-500 mt-0.5">{n.message}</span>}
                                    <span className="block text-[11px] text-gray-400 mt-1">{ago(n.createdAt)}</span>
                                </span>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
