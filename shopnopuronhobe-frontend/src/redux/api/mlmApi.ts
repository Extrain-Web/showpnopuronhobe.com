import { baseApi } from './baseApi';

// Membership network: points, referral bonus, generation commission, ranks, Rank Club, wallet.
export const mlmApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        // ── Public ──────────────────────────────────
        getMlmPublicSettings: builder.query<any, void>({ query: () => '/mlm/settings/public', providesTags: ['Mlm'] }),
        getLeaderboard: builder.query<any, void>({ query: () => '/mlm/leaderboard', providesTags: ['Mlm'] }),

        // ── Member ──────────────────────────────────
        getMySummary: builder.query<any, void>({ query: () => '/mlm/me', providesTags: ['Mlm'] }),
        requestMembership: builder.mutation<any, void>({
            query: () => ({ url: '/mlm/me/membership-request', method: 'POST' }),
            invalidatesTags: ['Mlm'],
        }),
        getMyTransactions: builder.query<any, { page?: number; type?: string }>({
            query: (params) => ({ url: '/mlm/me/transactions', params }),
            providesTags: ['Mlm'],
        }),
        getMyWithdraws: builder.query<any, void>({ query: () => '/mlm/me/withdraws', providesTags: ['Mlm'] }),
        getMyNotifications: builder.query<any, void>({ query: () => '/mlm/me/notifications', providesTags: ['Mlm'] }),
        readNotifications: builder.mutation<any, void>({
            query: () => ({ url: '/mlm/me/notifications/read', method: 'PATCH' }),
            invalidatesTags: ['Mlm'],
        }),
        createWithdraw: builder.mutation<any, { amount: number; method: string; accountNumber: string }>({
            query: (body) => ({ url: '/mlm/me/withdraws', method: 'POST', body }),
            invalidatesTags: ['Mlm', 'MlmAdmin'],
        }),
        getTree: builder.query<any, string | undefined>({
            query: (node) => ({ url: '/mlm/tree', params: node ? { node } : {} }),
            providesTags: ['Mlm'],
        }),
        searchTree: builder.query<any, string>({ query: (q) => ({ url: '/mlm/tree/search', params: { q } }) }),

        // ── Admin ───────────────────────────────────
        getMlmSettings: builder.query<any, void>({ query: () => '/mlm/admin/settings', providesTags: ['MlmAdmin'] }),
        updateMlmSettings: builder.mutation<any, any>({
            query: (body) => ({ url: '/mlm/admin/settings', method: 'PUT', body }),
            invalidatesTags: ['MlmAdmin', 'Mlm'],
        }),
        getMlmMembers: builder.query<any, Record<string, any>>({
            query: (params) => ({ url: '/mlm/admin/members', params }),
            providesTags: ['MlmAdmin'],
        }),
        approveMember: builder.mutation<any, string>({
            query: (id) => ({ url: `/mlm/admin/members/${id}/approve`, method: 'PATCH' }),
            invalidatesTags: ['MlmAdmin', 'Mlm'],
        }),
        rejectMember: builder.mutation<any, { id: string; reason?: string }>({
            query: ({ id, reason }) => ({ url: `/mlm/admin/members/${id}/reject`, method: 'PATCH', body: { reason } }),
            invalidatesTags: ['MlmAdmin'],
        }),
        adjustWallet: builder.mutation<any, { id: string; amount: number; note: string }>({
            query: ({ id, ...body }) => ({ url: `/mlm/admin/members/${id}/adjust-wallet`, method: 'POST', body }),
            invalidatesTags: ['MlmAdmin'],
        }),
        getMlmWithdraws: builder.query<any, Record<string, any>>({
            query: (params) => ({ url: '/mlm/admin/withdraws', params }),
            providesTags: ['MlmAdmin'],
        }),
        processWithdraw: builder.mutation<any, { id: string; status: 'approved' | 'rejected'; adminNote?: string; transactionId?: string }>({
            query: ({ id, ...body }) => ({ url: `/mlm/admin/withdraws/${id}`, method: 'PATCH', body }),
            invalidatesTags: ['MlmAdmin'],
        }),
        getMlmTransactions: builder.query<any, Record<string, any>>({
            query: (params) => ({ url: '/mlm/admin/transactions', params }),
            providesTags: ['MlmAdmin'],
        }),
        getClub: builder.query<any, void>({ query: () => '/mlm/admin/club', providesTags: ['MlmAdmin'] }),
        distributeClub: builder.mutation<any, void>({
            query: () => ({ url: '/mlm/admin/club/distribute', method: 'POST' }),
            invalidatesTags: ['MlmAdmin', 'Mlm'],
        }),
        getMlmReports: builder.query<any, void>({ query: () => '/mlm/admin/reports', providesTags: ['MlmAdmin'] }),
        getMyPoints: builder.query<any, void>({ query: () => '/mlm/me/points', providesTags: ['Mlm'] }),
        // Villages of one district (public — used on the registration form).
        getVillages: builder.query<any, string>({ query: (district) => ({ url: '/mlm/villages', params: { district } }), providesTags: ['MlmAdmin'] }),
        getAdminVillages: builder.query<any, { page?: number; division?: string; district?: string; search?: string }>({
            query: (params) => ({ url: '/mlm/admin/villages', params }),
            providesTags: ['MlmAdmin'],
        }),
        addVillage: builder.mutation<any, { division: string; district: string; name: string }>({
            query: (body) => ({ url: '/mlm/admin/villages', method: 'POST', body }),
            invalidatesTags: ['MlmAdmin'],
        }),
        updateVillage: builder.mutation<any, { id: string; name: string }>({
            query: ({ id, name }) => ({ url: `/mlm/admin/villages/${id}`, method: 'PATCH', body: { name } }),
            invalidatesTags: ['MlmAdmin'],
        }),
        deleteVillage: builder.mutation<any, string>({
            query: (id) => ({ url: `/mlm/admin/villages/${id}`, method: 'DELETE' }),
            invalidatesTags: ['MlmAdmin'],
        }),
    }),
});

export const {
    useGetMlmPublicSettingsQuery,
    useGetLeaderboardQuery,
    useGetMySummaryQuery,
    useRequestMembershipMutation,
    useGetMyTransactionsQuery,
    useGetMyWithdrawsQuery,
    useGetMyNotificationsQuery,
    useReadNotificationsMutation,
    useCreateWithdrawMutation,
    useGetTreeQuery,
    useLazySearchTreeQuery,
    useGetMlmSettingsQuery,
    useUpdateMlmSettingsMutation,
    useGetMlmMembersQuery,
    useApproveMemberMutation,
    useRejectMemberMutation,
    useAdjustWalletMutation,
    useGetMlmWithdrawsQuery,
    useProcessWithdrawMutation,
    useGetMlmTransactionsQuery,
    useGetClubQuery,
    useDistributeClubMutation,
    useGetMlmReportsQuery,
    useGetMyPointsQuery,
    useGetVillagesQuery,
    useGetAdminVillagesQuery,
    useAddVillageMutation,
    useUpdateVillageMutation,
    useDeleteVillageMutation,
} = mlmApi;

export const errMsg = (e: any, fallback = 'Something went wrong') => e?.data?.message || e?.message || fallback;
export const taka = (n: number | undefined) => `৳${Number(n || 0).toLocaleString('en-BD', { maximumFractionDigits: 2 })}`;
export const TX_LABELS: Record<string, string> = {
    referral_bonus: 'Referral Bonus',
    generation: 'Generation Commission',
    club: 'Rank Club',
    withdraw: 'Withdraw',
    withdraw_refund: 'Withdraw Refund',
    adjustment: 'Admin Adjustment',
};
