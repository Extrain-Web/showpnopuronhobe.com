import express from 'express';
import MlmController from './mlm.controller';
import { authMiddleware, authorizeRoles } from '../../middlewares/auth';

const router = express.Router();
const admin = [authMiddleware, authorizeRoles('admin')];

// ── Public ───────────────────────────────────────────
router.get('/settings/public', MlmController.publicSettings);
router.get('/leaderboard', MlmController.leaderboard);
router.get('/referrer/:code', MlmController.referrer);

// ── Member ───────────────────────────────────────────
router.get('/me', authMiddleware, MlmController.mySummary);
router.post('/me/membership-request', authMiddleware, MlmController.requestMembership);
router.get('/me/transactions', authMiddleware, MlmController.myTransactions);
router.get('/me/withdraws', authMiddleware, MlmController.myWithdraws);
router.get('/me/notifications', authMiddleware, MlmController.myNotifications);
router.patch('/me/notifications/read', authMiddleware, MlmController.readNotifications);
router.post('/me/withdraws', authMiddleware, MlmController.createWithdraw);
router.get('/tree', authMiddleware, MlmController.tree);
router.get('/tree/search', authMiddleware, MlmController.treeSearch);

// ── Admin ────────────────────────────────────────────
router.get('/admin/settings', ...admin, MlmController.getSettings);
router.put('/admin/settings', ...admin, MlmController.updateSettings);
router.get('/admin/members', ...admin, MlmController.members);
router.patch('/admin/members/:id/approve', ...admin, MlmController.approve);
router.patch('/admin/members/:id/reject', ...admin, MlmController.reject);
router.post('/admin/members/:id/adjust-wallet', ...admin, MlmController.adjustWallet);
router.get('/admin/withdraws', ...admin, MlmController.withdraws);
router.patch('/admin/withdraws/:id', ...admin, MlmController.processWithdraw);
router.get('/admin/transactions', ...admin, MlmController.transactions);
router.get('/admin/club', ...admin, MlmController.club);
router.post('/admin/club/distribute', ...admin, MlmController.distributeClub);
router.get('/admin/reports', ...admin, MlmController.reports);

export const MlmRoutes = router;
