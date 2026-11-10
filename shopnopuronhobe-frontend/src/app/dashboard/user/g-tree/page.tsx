"use client";

import GTree from '@/components/mlm/GTree';

export default function UserGTreePage() {
    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-xl font-bold text-gray-800 mb-1">G-Tree</h2>
            <p className="text-sm text-gray-500 mb-4">Your team. Tap “View team” on a card to open the members under them.</p>
            <GTree />
        </div>
    );
}
