"use client";

import MembersTable from '@/components/mlm/MembersTable';
import { PageHead } from '@/components/mlm/AdminUi';

export default function MlmMembersPage() {
    return (
        <div>
            <PageHead title="Members" sub="Every customer and member with points, rank, team and wallet." />
            <MembersTable />
        </div>
    );
}
