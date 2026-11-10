import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import AppError from '../../utils/AppError';
import MlmService from './mlm.service';

const ok = (res: Response, message: string, data?: any, meta?: any) =>
    sendResponse(res, { statusCode: 200, success: true, message, data, meta });

const isAdmin = (req: Request) => req.user?.role === 'admin';

const MlmController = {
    // ── Public ────────────────────────────────────────
    publicSettings: catchAsync(async (_req, res) => ok(res, 'Settings fetched', await MlmService.getPublicSettings())),
    leaderboard: catchAsync(async (_req, res) => ok(res, 'Leaderboard fetched', await MlmService.getLeaderboard(10))),
    referrer: catchAsync(async (req, res) => {
        const u: any = await MlmService.findReferrer(req.params.code);
        if (!u) throw new AppError(404, 'Referral code not found');
        ok(res, 'Referrer found', { name: [u.firstName, u.lastName].filter((p: string) => p && p !== '.').join(' '), memberId: u.memberId, referralCode: u.referralCode });
    }),

    // ── Member ────────────────────────────────────────
    mySummary: catchAsync(async (req, res) => ok(res, 'Summary fetched', await MlmService.getMySummary(req.user!.userId))),
    requestMembership: catchAsync(async (req, res) => {
        await MlmService.requestMembership(req.user!.userId);
        ok(res, 'Membership request sent to admin');
    }),
    myTransactions: catchAsync(async (req, res) => {
        const r = await MlmService.getMyTransactions(req.user!.userId, req.query);
        ok(res, 'Transactions fetched', r.data, r.meta);
    }),
    myNotifications: catchAsync(async (req, res) => {
        const r = await MlmService.getMyNotifications(req.user!.userId);
        ok(res, 'Notifications fetched', r.data, { unread: r.unread } as any);
    }),
    readNotifications: catchAsync(async (req, res) => {
        await MlmService.markNotificationsRead(req.user!.userId);
        ok(res, 'Notifications marked as read');
    }),
    myWithdraws: catchAsync(async (req, res) => ok(res, 'Withdraw requests fetched', await MlmService.getMyWithdraws(req.user!.userId))),
    createWithdraw: catchAsync(async (req, res) => {
        const w = await MlmService.requestWithdraw(req.user!.userId, req.body);
        sendResponse(res, { statusCode: 201, success: true, message: 'Withdraw request sent', data: w });
    }),
    tree: catchAsync(async (req, res) => ok(res, 'Tree fetched', await MlmService.getTree(req.user!.userId, isAdmin(req), req.query.node as string | undefined))),
    treeSearch: catchAsync(async (req, res) => ok(res, 'Search results', await MlmService.searchTree(req.user!.userId, isAdmin(req), req.query.q as string))),

    // ── Admin ─────────────────────────────────────────
    getSettings: catchAsync(async (_req, res) => ok(res, 'Settings fetched', await MlmService.getSettings())),
    updateSettings: catchAsync(async (req, res) => ok(res, 'Settings saved', await MlmService.updateSettings(req.body))),
    members: catchAsync(async (req, res) => {
        const r = await MlmService.adminListMembers(req.query);
        ok(res, 'Members fetched', r.data, r.meta);
    }),
    approve: catchAsync(async (req, res) => ok(res, 'Membership approved', await MlmService.approveMembership(req.params.id))),
    reject: catchAsync(async (req, res) => ok(res, 'Membership rejected', await MlmService.rejectMembership(req.params.id, req.body?.reason))),
    adjustWallet: catchAsync(async (req, res) => ok(res, 'Wallet adjusted', await MlmService.adminAdjustWallet(req.params.id, req.body?.amount, req.body?.note))),
    withdraws: catchAsync(async (req, res) => {
        const r = await MlmService.adminListWithdraws(req.query);
        ok(res, 'Withdraw requests fetched', r.data, r.meta);
    }),
    processWithdraw: catchAsync(async (req, res) => ok(res, 'Withdraw request updated', await MlmService.processWithdraw(req.params.id, req.body))),
    transactions: catchAsync(async (req, res) => {
        const r = await MlmService.adminListTransactions(req.query);
        ok(res, 'Transactions fetched', r.data, r.meta);
    }),
    club: catchAsync(async (_req, res) => ok(res, 'Rank Club fetched', await MlmService.adminGetClub())),
    distributeClub: catchAsync(async (_req, res) => ok(res, 'Rank Club distributed', await MlmService.distributeClub('manual'))),
    reports: catchAsync(async (_req, res) => ok(res, 'Reports fetched', await MlmService.adminReports())),
};

export default MlmController;
