"use client";

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import GTree from '@/components/mlm/GTree';
import { PageHead } from '@/components/mlm/AdminUi';

function AdminTreeInner() {
    const node = useSearchParams().get('node') || undefined;
    return (
        <div>
            <PageHead title="G-Tree" sub={node ? 'Team of the selected member.' : 'Search any member by name or Member ID, or open a tree from the Members page.'} />
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <GTree startNode={node} />
            </div>
        </div>
    );
}

export default function AdminTreePage() {
    return <Suspense fallback={null}><AdminTreeInner /></Suspense>;
}
