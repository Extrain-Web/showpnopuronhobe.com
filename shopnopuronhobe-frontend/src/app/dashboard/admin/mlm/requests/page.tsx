"use client";

import MembersTable from '@/components/mlm/MembersTable';
import { PageHead } from '@/components/mlm/AdminUi';

export default function MembershipRequestsPage() {
    return (
        <div>
            <PageHead title="Membership Requests" sub="Customers who reached the membership points and asked to become Active members." />
            <MembersTable pendingOnly />
        </div>
    );
}
