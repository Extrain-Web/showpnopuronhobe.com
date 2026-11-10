import { Types } from 'mongoose';
import AppError from '../../utils/AppError';
import { User } from '../user/user.model';
import { Order } from '../order/order.model';
import { Product } from '../product/product.model';
import {
    MlmSettings, DEFAULT_RANKS, WalletTransaction, WithdrawRequest,
    ClubFund, ClubDistribution, CompanyEarning, Notification,
} from './mlm.model';

/* ════════════════════════════════════════════════════════════════
 *  Reward engine
 *
 *  Customer ──(buys, order delivered)──▶ points
 *  points ≥ membershipPoints ──▶ membership request ──(admin)──▶ Active member
 *  Active member with `requiredReferrals` active direct referrals
 *      ──▶ referral bonus (৳400) to him
 *      ──▶ generation commission (৳300) split over his upline by rank %
 *  Every delivered order ──▶ contribution to the Rank Club fund
 *  Rank Club fund ──(schedule / admin)──▶ split over all rank holders by rank %
 *
 *  An empty rank's share always goes to the company.
 * ════════════════════════════════════════════════════════════════ */

const EARNING_TYPES = ['referral_bonus', 'generation', 'club'];
const toId = (id: any) => new Types.ObjectId(String(id));
const floor2 = (n: number) => Math.floor(n * 100) / 100;
const fullName = (u: any) => [u?.firstName, u?.lastName].filter((p) => p && p !== '.').join(' ').trim();

type TSettings = any;

const MlmService = {
    /* ── Settings ─────────────────────────────────────────────── */
    async getSettings(): Promise<TSettings> {
        let s: any = await MlmSettings.findOne({ key: 'default' });
        if (!s) s = await MlmSettings.create({ key: 'default', ranks: DEFAULT_RANKS });
        if (!s.ranks || s.ranks.length === 0) {
            s.ranks = DEFAULT_RANKS as any;
            await s.save();
        }
        return s;
    },

    async updateSettings(payload: any) {
        const s: any = await this.getSettings();
        const num = (v: any, min = 0) => {
            const n = Number(v);
            if (!Number.isFinite(n) || n < min) throw new AppError(400, 'Settings values must be numbers of 0 or more');
            return n;
        };

        if (payload.pointValue !== undefined) s.pointValue = num(payload.pointValue);
        if (payload.membershipPoints !== undefined) s.membershipPoints = num(payload.membershipPoints, 1);
        if (payload.referralBonus) {
            const r = payload.referralBonus;
            if (r.amount !== undefined) s.referralBonus.amount = num(r.amount);
            if (r.requiredReferrals !== undefined) s.referralBonus.requiredReferrals = num(r.requiredReferrals, 1);
            if (r.repeat !== undefined) s.referralBonus.repeat = !!r.repeat;
        }
        if (payload.generationCommission) {
            const g = payload.generationCommission;
            if (g.amount !== undefined) s.generationCommission.amount = num(g.amount);
            if (g.depth !== undefined) s.generationCommission.depth = num(g.depth);
        }
        if (payload.club) {
            const c = payload.club;
            if (c.contributionType !== undefined) {
                if (!['fixed', 'percent', 'perPoint'].includes(c.contributionType)) throw new AppError(400, 'Invalid club contribution type');
                s.club.contributionType = c.contributionType;
            }
            if (c.contributionValue !== undefined) s.club.contributionValue = num(c.contributionValue);
            if (c.frequency !== undefined) {
                if (!['manual', 'daily', 'weekly', 'monthly'].includes(c.frequency)) throw new AppError(400, 'Invalid club frequency');
                s.club.frequency = c.frequency;
            }
        }
        if (payload.withdraw) {
            const w = payload.withdraw;
            if (w.minAmount !== undefined) s.withdraw.minAmount = num(w.minAmount);
            if (w.chargePercent !== undefined) {
                const p = num(w.chargePercent);
                if (p > 100) throw new AppError(400, 'Withdraw charge cannot be more than 100%');
                s.withdraw.chargePercent = p;
            }
        }
        if (Array.isArray(payload.ranks)) {
            if (payload.ranks.length !== 7) throw new AppError(400, 'There must be exactly 7 ranks');
            const ranks = payload.ranks.map((r: any, i: number) => ({
                level: i + 1,
                name: String(r.name || DEFAULT_RANKS[i].name).trim(),
                directTarget: i === 0 ? num(r.directTarget, 1) : 0,
                links: i === 0 ? [0, 0, 0, 0] : [0, 1, 2, 3].map((k) => num(r.links?.[k] ?? 0)),
                sharePercent: num(r.sharePercent),
                reward: String(r.reward || ''),
            }));
            const total = ranks.reduce((a: number, r: any) => a + r.sharePercent, 0);
            if (total > 100) throw new AppError(400, `Rank shares add up to ${total}% — they cannot be more than 100%`);
            s.ranks = ranks;
        }
        await s.save();
        return s;
    },

    async getPublicSettings() {
        const s: any = await this.getSettings();
        return {
            pointValue: s.pointValue,
            membershipPoints: s.membershipPoints,
            referralBonus: s.referralBonus,
            generationCommission: { amount: s.generationCommission.amount },
            withdraw: s.withdraw,
            ranks: s.ranks,
        };
    },

    /* ── Notifications ────────────────────────────────────────── */
    async notify(userId: any, type: string, title: string, message = '', link = '') {
        try { await Notification.create({ user: userId, type, title, message, link }); }
        catch (e: any) { console.error('Notification failed:', e.message); }
    },

    async getMyNotifications(userId: string) {
        const [data, unread] = await Promise.all([
            Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(30),
            Notification.countDocuments({ user: userId, read: false }),
        ]);
        return { data, unread };
    },

    async markNotificationsRead(userId: string) {
        await Notification.updateMany({ user: userId, read: false }, { $set: { read: true } });
    },

    /* ── Wallet ───────────────────────────────────────────────── */
    async credit(userId: any, amount: number, type: string, note = '', fromUser: any = null, ref = '') {
        if (!amount) return null;
        const inc: any = { walletBalance: amount };
        if (EARNING_TYPES.includes(type) && amount > 0) inc.totalEarned = amount;
        const u: any = await User.findByIdAndUpdate(userId, { $inc: inc }, { new: true }).select('walletBalance');
        if (!u) return null;
        return WalletTransaction.create({
            user: userId, type, amount, balanceAfter: floor2(u.walletBalance), note, fromUser, ref,
        });
    },

    async addCompanyEarning(source: string, amount: number, note = '', relatedUser: any = null) {
        if (amount <= 0) return;
        await CompanyEarning.create({ source, amount: floor2(amount), note, relatedUser });
    },

    /* ── Orders → points + club fund ─────────────────────────── */
    async onOrderDelivered(orderId: string) {
        // Claim the order atomically so points are never added twice.
        const order: any = await Order.findOneAndUpdate(
            { _id: orderId, rewardsProcessed: { $ne: true } },
            { $set: { rewardsProcessed: true } },
            { new: true },
        );
        if (!order) return;

        const s: any = await this.getSettings();
        const productIds = order.items.map((i: any) => i.product);
        const products: any[] = await Product.find({ _id: { $in: productIds } }).select('points');
        const pointsOf = new Map(products.map((p) => [String(p._id), Number(p.points) || 0]));
        const points = order.items.reduce((sum: number, i: any) => sum + (pointsOf.get(String(i.product)) || 0) * i.quantity, 0);

        if (points > 0) {
            const buyer: any = await User.findByIdAndUpdate(order.user, { $inc: { points } }, { new: true }).select('points memberStatus');
            await Order.updateOne({ _id: order._id }, { $set: { pointsAwarded: points } });
            const canRequest = buyer && ['none', 'rejected'].includes(buyer.memberStatus) && buyer.points >= s.membershipPoints;
            await this.notify(order.user, 'points', `+${points} points added`,
                `Order ${order.orderId} was delivered. You now have ${buyer?.points ?? points} points.${canRequest ? ' You can now send a membership request!' : ''}`,
                '/dashboard/user/membership');
        }

        const { contributionType, contributionValue } = s.club;
        let contribution = 0;
        if (contributionType === 'fixed') contribution = contributionValue;
        else if (contributionType === 'percent') contribution = (order.total * contributionValue) / 100;
        else if (contributionType === 'perPoint') contribution = points * contributionValue;
        contribution = floor2(contribution);
        if (contribution > 0) {
            await ClubFund.updateOne(
                { key: 'default' },
                { $inc: { balance: contribution, totalCollected: contribution } },
                { upsert: true },
            );
        }
    },

    /* ── Membership ──────────────────────────────────────────── */
    async requestMembership(userId: string) {
        const s: any = await this.getSettings();
        const u: any = await User.findById(userId);
        if (!u) throw new AppError(404, 'User not found');
        if (u.memberStatus === 'active') throw new AppError(400, 'You are already an active member');
        if (u.memberStatus === 'pending') throw new AppError(400, 'Your membership request is already waiting for admin approval');
        if (u.points < s.membershipPoints) {
            throw new AppError(400, `You need ${s.membershipPoints} points to request membership. You have ${u.points}.`);
        }
        u.memberStatus = 'pending';
        u.memberRequestedAt = new Date();
        u.memberRejectReason = '';
        await u.save();
        return u;
    },

    async approveMembership(userId: string) {
        const u: any = await User.findOneAndUpdate(
            { _id: userId, memberStatus: { $in: ['pending', 'none', 'rejected'] } },
            { $set: { memberStatus: 'active', memberActivatedAt: new Date(), memberRejectReason: '' } },
            { new: true },
        );
        if (!u) throw new AppError(400, 'This user is already active or does not exist');
        await this.notify(u._id, 'membership', 'Membership approved 🎉', 'You are now an Active member (L-1: New Member). Share your referral link to grow your team.', '/dashboard/user/membership');
        await this.onMemberActivated(u);
        return User.findById(userId);
    },

    async rejectMembership(userId: string, reason = '') {
        const u: any = await User.findOneAndUpdate(
            { _id: userId, memberStatus: 'pending' },
            { $set: { memberStatus: 'rejected', memberRejectReason: reason } },
            { new: true },
        );
        if (!u) throw new AppError(400, 'Only pending requests can be rejected');
        await this.notify(u._id, 'membership', 'Membership request rejected', reason ? `Reason: ${reason}. You can request again.` : 'You can request again.', '/dashboard/user/membership');
        return u;
    },

    async onMemberActivated(u: any) {
        const ancestors: any[] = u.ancestors || [];
        if (ancestors.length) {
            await User.updateMany({ _id: { $in: ancestors } }, { $inc: { teamActiveCount: 1 } });
            await User.updateOne({ _id: ancestors[0] }, { $inc: { directActiveCount: 1 } });
            await this.checkReferralBonus(ancestors[0]);
        }
        // He may already have active referrals from before he was approved.
        await this.checkReferralBonus(u._id);

        for (const id of [u._id, ...ancestors]) await this.recomputeRank(id);
    },

    /* ── Referral bonus + generation commission ──────────────── */
    async checkReferralBonus(userId: any) {
        const s: any = await this.getSettings();
        const N = Math.max(1, s.referralBonus.requiredReferrals);
        const amount = s.referralBonus.amount;

        for (let guard = 0; guard < 100; guard++) {
            const u: any = await User.findById(userId).select('memberStatus directActiveCount referralBonusCount ancestors firstName lastName');
            if (!u || u.memberStatus !== 'active') return;
            const due = s.referralBonus.repeat ? Math.floor(u.directActiveCount / N) : (u.directActiveCount >= N ? 1 : 0);
            if (u.referralBonusCount >= due) return;

            // Claim one payout atomically.
            const claimed = await User.updateOne(
                { _id: u._id, referralBonusCount: u.referralBonusCount },
                { $inc: { referralBonusCount: 1 } },
            );
            if (!claimed.modifiedCount) continue;

            await this.credit(u._id, amount, 'referral_bonus', `Referral bonus for ${N} active referrals`);
            await this.notify(u._id, 'bonus', `৳${amount} referral bonus received`, `${N} people you referred are now Active members. The money is in your wallet.`, '/dashboard/user/wallet');
            await this.distributeGeneration(u);
        }
    },

    async distributeGeneration(earner: any) {
        const s: any = await this.getSettings();
        const amount = s.generationCommission.amount;
        if (!amount) return;
        const depth = s.generationCommission.depth;
        const upline: any[] = depth > 0 ? (earner.ancestors || []).slice(0, depth) : (earner.ancestors || []);

        const members: any[] = upline.length
            ? await User.find({ _id: { $in: upline }, memberStatus: 'active', rank: { $gte: 1 } }).select('rank')
            : [];

        let toCompany = amount;
        const name = fullName(earner);
        for (const r of s.ranks) {
            const pool = (amount * r.sharePercent) / 100;
            const group = members.filter((m) => m.rank === r.level);
            if (!group.length) continue;
            const per = floor2(pool / group.length);
            for (const m of group) {
                await this.credit(m._id, per, 'generation', `Generation commission (${r.name}) from ${name}`, earner._id);
                await this.notify(m._id, 'generation', `৳${per} generation commission`, `${name} in your team received the referral bonus.`, '/dashboard/user/wallet');
                toCompany -= per;
            }
        }
        await this.addCompanyEarning('generation_unclaimed', toCompany, `Unclaimed generation share from ${name}`, earner._id);
    },

    /* ── Ranks ───────────────────────────────────────────────── */
    // Team sizes of the 4 links: the 3 biggest direct legs, and every other leg added together.
    async getLegs(userId: any): Promise<number[]> {
        const children: any[] = await User.find({
            referredBy: userId,
            $or: [{ memberStatus: 'active' }, { teamActiveCount: { $gt: 0 } }],
        }).select('memberStatus teamActiveCount');
        const sizes = children
            .map((c) => (c.memberStatus === 'active' ? 1 : 0) + (c.teamActiveCount || 0))
            .sort((a, b) => b - a);
        const rest = sizes.slice(3).reduce((a, b) => a + b, 0);
        return [sizes[0] || 0, sizes[1] || 0, sizes[2] || 0, rest];
    },

    // Cumulative link targets for a rank (rank 2 = its own links, rank 3 = rank 2 + rank 3 …)
    cumulativeLinks(s: any, level: number): number[] {
        const cum = [0, 0, 0, 0];
        for (const r of s.ranks) {
            if (r.level < 2 || r.level > level) continue;
            r.links.forEach((v: number, i: number) => { cum[i] += v; });
        }
        return cum;
    },

    rankFor(s: any, u: any, legs: number[]): number {
        if (u.memberStatus !== 'active') return 0;
        const r1 = s.ranks.find((r: any) => r.level === 1);
        if (!r1 || u.directActiveCount < r1.directTarget) return 0;
        let rank = 1;
        for (let level = 2; level <= 7; level++) {
            const need = this.cumulativeLinks(s, level);
            if (need.every((n, i) => legs[i] >= n)) rank = level;
            else break;
        }
        return rank;
    },

    async recomputeRank(userId: any) {
        const s: any = await this.getSettings();
        const u: any = await User.findById(userId).select('memberStatus directActiveCount rank');
        if (!u) return;
        const legs = await this.getLegs(userId);
        const rank = this.rankFor(s, u, legs);
        if (rank > u.rank) {
            await User.updateOne({ _id: userId }, { $set: { rank, rankAchievedAt: new Date() } });
            const r = s.ranks.find((x: any) => x.level === rank);
            await this.notify(userId, 'rank', `🏆 You reached Rank ${rank} · ${r?.name || ''}`,
                r?.reward ? `Your reward: ${r.reward}. The company will contact you.` : 'Congratulations! You now get this rank\'s share of the Rank Club and generation commission.',
                '/dashboard/user/membership');
        }
    },

    /* ── Rank Club ───────────────────────────────────────────── */
    async getClubFund() {
        let f: any = await ClubFund.findOne({ key: 'default' });
        if (!f) f = await ClubFund.create({ key: 'default' });
        return f;
    },

    async distributeClub(triggeredBy: 'manual' | 'schedule' = 'manual') {
        const s: any = await this.getSettings();
        const fund: any = await this.getClubFund();
        const amount = floor2(fund.balance);
        if (amount <= 0) throw new AppError(400, 'The Rank Club fund is empty');

        // Take the money out of the fund atomically.
        const taken = await ClubFund.updateOne(
            { key: 'default', balance: fund.balance },
            { $inc: { balance: -fund.balance, totalDistributed: amount }, $set: { lastDistributedAt: new Date() } },
        );
        if (!taken.modifiedCount) throw new AppError(409, 'The fund changed while distributing. Please try again.');

        let toCompany = amount;
        const breakdown: any[] = [];
        const dist = await ClubDistribution.create({ amount, triggeredBy, breakdown: [] });

        for (const r of s.ranks) {
            const pool = (amount * r.sharePercent) / 100;
            const members: any[] = await User.find({ memberStatus: 'active', rank: r.level }).select('_id');
            const per = members.length ? floor2(pool / members.length) : 0;
            if (per > 0) {
                const ids = members.map((m) => m._id);
                await User.updateMany({ _id: { $in: ids } }, { $inc: { walletBalance: per, totalEarned: per } });
                await WalletTransaction.insertMany(ids.map((id) => ({
                    user: id, type: 'club', amount: per, note: `Rank Club (${r.name})`, ref: String(dist._id),
                })));
                await Notification.insertMany(ids.map((id) => ({
                    user: id, type: 'club', title: `৳${per} Rank Club share`, message: `Your ${r.name} share of the Rank Club is in your wallet.`, link: '/dashboard/user/wallet',
                })));
                toCompany -= per * members.length;
            }
            breakdown.push({ rank: r.level, name: r.name, percent: r.sharePercent, pool: floor2(pool), members: members.length, perMember: per });
        }

        toCompany = floor2(toCompany);
        await this.addCompanyEarning('club_unclaimed', toCompany, 'Unclaimed Rank Club share');
        dist.set({ breakdown, toCompany });
        await dist.save();
        return dist;
    },

    async runScheduledClub() {
        const s: any = await this.getSettings();
        const freq = s.club.frequency;
        if (freq === 'manual') return;
        const fund: any = await this.getClubFund();
        if (fund.balance <= 0) return;
        const period = { daily: 1, weekly: 7, monthly: 30 }[freq as 'daily' | 'weekly' | 'monthly'] * 24 * 60 * 60 * 1000;
        const last = fund.lastDistributedAt || fund.createdAt;
        if (Date.now() - new Date(last).getTime() < period) return;
        await this.distributeClub('schedule');
    },

    /* ── Withdraw ────────────────────────────────────────────── */
    async requestWithdraw(userId: string, payload: any) {
        const s: any = await this.getSettings();
        const amount = floor2(Number(payload.amount));
        const method = String(payload.method || '').toLowerCase();
        const accountNumber = String(payload.accountNumber || '').trim();

        if (!Number.isFinite(amount) || amount <= 0) throw new AppError(400, 'Enter a valid amount');
        if (amount < s.withdraw.minAmount) throw new AppError(400, `Minimum withdraw is ৳${s.withdraw.minAmount}`);
        if (!['bkash', 'nagad'].includes(method)) throw new AppError(400, 'Choose bKash or Nagad');
        if (!/^01\d{9}$/.test(accountNumber)) throw new AppError(400, 'Enter a valid 11-digit mobile number');

        const u: any = await User.findOneAndUpdate(
            { _id: userId, memberStatus: 'active', walletBalance: { $gte: amount } },
            { $inc: { walletBalance: -amount } },
            { new: true },
        );
        if (!u) throw new AppError(400, 'Not enough balance in your wallet (or you are not an active member)');

        const charge = floor2((amount * s.withdraw.chargePercent) / 100);
        const w = await WithdrawRequest.create({
            user: userId, amount, chargePercent: s.withdraw.chargePercent, charge,
            payable: floor2(amount - charge), method, accountNumber,
        });
        await WalletTransaction.create({
            user: userId, type: 'withdraw', amount: -amount, balanceAfter: floor2(u.walletBalance),
            note: `Withdraw request to ${method} ${accountNumber}`, ref: String(w._id),
        });
        return w;
    },

    async processWithdraw(id: string, payload: any) {
        const status = payload.status;
        if (!['approved', 'rejected'].includes(status)) throw new AppError(400, 'Status must be approved or rejected');
        const w: any = await WithdrawRequest.findOneAndUpdate(
            { _id: id, status: 'pending' },
            { $set: { status, adminNote: payload.adminNote || '', transactionId: payload.transactionId || '', processedAt: new Date() } },
            { new: true },
        );
        if (!w) throw new AppError(400, 'This request was already processed');

        if (status === 'approved') {
            await this.addCompanyEarning('withdraw_charge', w.charge, `Withdraw charge (${w.chargePercent}%)`, w.user);
            await this.notify(w.user, 'withdraw', `Withdraw approved — ৳${w.payable} sent`, `Sent to ${w.method} ${w.accountNumber}${w.transactionId ? ` (TrxID ${w.transactionId})` : ''}.`, '/dashboard/user/wallet');
        } else {
            await this.credit(w.user, w.amount, 'withdraw_refund', `Withdraw rejected${payload.adminNote ? `: ${payload.adminNote}` : ''}`, null, String(w._id));
            await this.notify(w.user, 'withdraw', 'Withdraw rejected', `৳${w.amount} is back in your wallet.${payload.adminNote ? ` Reason: ${payload.adminNote}` : ''}`, '/dashboard/user/wallet');
        }
        return w;
    },

    /* ── Member summary (dashboard) ──────────────────────────── */
    async getMySummary(userId: string) {
        const s: any = await this.getSettings();
        const u: any = await User.findById(userId).populate('referredBy', 'firstName lastName memberId');
        if (!u) throw new AppError(404, 'User not found');
        if (!u.memberId) await u.save(); // backfills Member ID + referral code for old accounts

        const legs = await this.getLegs(u._id);
        const nextLevel = u.rank < 7 ? u.rank + 1 : null;
        const nextRank = nextLevel ? s.ranks.find((r: any) => r.level === nextLevel) : null;
        const nextTarget = nextRank
            ? (nextLevel === 1 ? { direct: nextRank.directTarget } : { links: this.cumulativeLinks(s, nextLevel!) })
            : null;
        const pendingWithdraw = await WithdrawRequest.aggregate([
            { $match: { user: toId(u._id), status: 'pending' } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);

        return {
            memberId: u.memberId,
            referralCode: u.referralCode,
            username: u.username || '',
            name: fullName(u),
            sponsor: u.referredBy ? { name: fullName(u.referredBy), memberId: u.referredBy.memberId } : null,
            points: u.points,
            pointValue: s.pointValue,
            membershipPoints: s.membershipPoints,
            memberStatus: u.memberStatus,
            memberRejectReason: u.memberRejectReason,
            memberActivatedAt: u.memberActivatedAt,
            rank: u.rank,
            rankName: u.rank ? s.ranks.find((r: any) => r.level === u.rank)?.name : 'New Member',
            nextRank: nextRank ? { level: nextLevel, name: nextRank.name, reward: nextRank.reward, target: nextTarget } : null,
            legs,
            directActiveCount: u.directActiveCount,
            teamActiveCount: u.teamActiveCount,
            referralBonus: {
                amount: s.referralBonus.amount,
                required: s.referralBonus.requiredReferrals,
                repeat: s.referralBonus.repeat,
                paidCount: u.referralBonusCount,
            },
            walletBalance: floor2(u.walletBalance),
            totalEarned: floor2(u.totalEarned),
            pendingWithdraw: pendingWithdraw[0]?.total || 0,
            withdraw: s.withdraw,
        };
    },

    async getMyTransactions(userId: string, query: any) {
        const page = Math.max(1, Number(query.page) || 1);
        const limit = Math.min(100, Number(query.limit) || 20);
        const filter: any = { user: toId(userId) };
        if (query.type) filter.type = query.type;
        const [data, total] = await Promise.all([
            WalletTransaction.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
                .populate('fromUser', 'firstName lastName memberId'),
            WalletTransaction.countDocuments(filter),
        ]);
        return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    },

    async getMyWithdraws(userId: string) {
        return WithdrawRequest.find({ user: userId }).sort({ createdAt: -1 }).limit(100);
    },

    /* ── G-Tree ──────────────────────────────────────────────── */
    async nodeSummary(s: any, u: any, withLegs = true) {
        const [childCount, legs] = await Promise.all([
            User.countDocuments({ referredBy: u._id }),
            withLegs ? this.getLegs(u._id) : Promise.resolve([0, 0, 0, 0]),
        ]);
        return {
            _id: u._id,
            name: fullName(u),
            avatar: u.avatar || '',
            memberId: u.memberId,
            memberStatus: u.memberStatus,
            rank: u.rank,
            rankName: u.rank ? s.ranks.find((r: any) => r.level === u.rank)?.name : (u.memberStatus === 'active' ? 'New Member' : 'Customer'),
            points: u.points,
            directActiveCount: u.directActiveCount,
            teamActiveCount: u.teamActiveCount,
            childCount,
            links: legs.map((n) => n > 0), // Filled / Open
            legs,
        };
    },

    async assertInDownline(viewerId: string, isAdmin: boolean, targetId: string) {
        if (isAdmin || String(viewerId) === String(targetId)) return;
        const ok = await User.exists({ _id: targetId, ancestors: toId(viewerId) });
        if (!ok) throw new AppError(403, 'You can only view members in your own team');
    },

    async getTree(viewerId: string, isAdmin: boolean, nodeId?: string) {
        const s: any = await this.getSettings();
        const rootId = nodeId || viewerId;
        await this.assertInDownline(viewerId, isAdmin, rootId);
        const root: any = await User.findById(rootId);
        if (!root) throw new AppError(404, 'Member not found');
        const children: any[] = await User.find({ referredBy: root._id })
            .sort({ memberStatus: 1, teamActiveCount: -1, createdAt: 1 }).limit(200);
        return {
            node: await this.nodeSummary(s, root),
            parentId: root.referredBy && String(root._id) !== String(viewerId) ? root.referredBy : null,
            children: await Promise.all(children.map((c) => this.nodeSummary(s, c))),
        };
    },

    async searchTree(viewerId: string, isAdmin: boolean, q: string) {
        const text = String(q || '').trim();
        if (!text) return [];
        const or: any[] = [
            { firstName: { $regex: text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
            { lastName: { $regex: text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
        ];
        const asNum = Number(text.replace(/^#/, ''));
        if (Number.isFinite(asNum) && asNum > 0) or.push({ memberId: asNum });
        const filter: any = { $or: or };
        if (!isAdmin) filter.ancestors = toId(viewerId);
        const found: any[] = await User.find(filter).limit(20).select('firstName lastName memberId rank memberStatus referredBy');
        return found.map((u) => ({
            _id: u._id, name: fullName(u), memberId: u.memberId, rank: u.rank,
            memberStatus: u.memberStatus, parentId: u.referredBy,
        }));
    },

    /* ── Leaderboard ─────────────────────────────────────────── */
    async getLeaderboard(limit = 10) {
        const s: any = await this.getSettings();
        const top: any[] = await User.find({ memberStatus: 'active', role: 'user' })
            .sort({ rank: -1, teamActiveCount: -1, directActiveCount: -1, totalEarned: -1, memberActivatedAt: 1 })
            .limit(limit)
            .select('firstName lastName avatar memberId rank teamActiveCount directActiveCount village district');
        return top.map((u, i) => ({
            position: i + 1,
            name: fullName(u),
            avatar: u.avatar || '',
            memberId: u.memberId,
            rank: u.rank,
            rankName: u.rank ? s.ranks.find((r: any) => r.level === u.rank)?.name : 'New Member',
            teamSize: u.teamActiveCount,
            directCount: u.directActiveCount,
            location: [u.village, u.district].filter(Boolean).join(', '),
        }));
    },

    async findReferrer(code: string) {
        const c = String(code || '').trim().toUpperCase();
        if (!c) return null;
        const asNum = Number(c.replace(/^SPH/, ''));
        const u: any = await User.findOne({
            $or: [
                { referralCode: c },
                { username: c.toLowerCase() },
                ...(Number.isFinite(asNum) && asNum > 0 ? [{ memberId: asNum }] : []),
            ],
            status: { $ne: 'blocked' },
        }).select('firstName lastName memberId referralCode ancestors');
        return u;
    },

    /* ── Admin ───────────────────────────────────────────────── */
    async adminListMembers(query: any) {
        const page = Math.max(1, Number(query.page) || 1);
        const limit = Math.min(100, Number(query.limit) || 20);
        const filter: any = { role: 'user' };
        if (query.memberStatus) filter.memberStatus = query.memberStatus;
        if (query.rank !== undefined && query.rank !== '') filter.rank = Number(query.rank);
        if (query.search) {
            const t = String(query.search).trim();
            const rx = { $regex: t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
            const or: any[] = [{ firstName: rx }, { lastName: rx }, { phone: rx }, { email: rx }, { username: rx }];
            const n = Number(t.replace(/^#/, ''));
            if (Number.isFinite(n) && n > 0) or.push({ memberId: n });
            filter.$or = or;
        }
        const sort: any = query.memberStatus === 'pending' ? { memberRequestedAt: 1 } : { createdAt: -1 };
        const [data, total] = await Promise.all([
            User.find(filter).sort(sort).skip((page - 1) * limit).limit(limit)
                .select('firstName lastName email phone avatar username memberId referralCode points memberStatus memberRequestedAt memberActivatedAt rank directActiveCount teamActiveCount walletBalance totalEarned referredBy createdAt')
                .populate('referredBy', 'firstName lastName memberId'),
            User.countDocuments(filter),
        ]);
        return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    },

    async adminAdjustWallet(userId: string, amount: number, note: string) {
        const a = floor2(Number(amount));
        if (!Number.isFinite(a) || a === 0) throw new AppError(400, 'Enter a non-zero amount');
        if (a < 0) {
            const ok = await User.exists({ _id: userId, walletBalance: { $gte: -a } });
            if (!ok) throw new AppError(400, 'Wallet balance is lower than this deduction');
        }
        const tx = await this.credit(userId, a, 'adjustment', note || 'Admin adjustment');
        await this.notify(userId, 'wallet', a > 0 ? `৳${a} added to your wallet` : `৳${-a} deducted from your wallet`, note || 'Admin adjustment', '/dashboard/user/wallet');
        return tx;
    },

    async adminListWithdraws(query: any) {
        const page = Math.max(1, Number(query.page) || 1);
        const limit = Math.min(100, Number(query.limit) || 20);
        const filter: any = {};
        if (query.status) filter.status = query.status;
        const [data, total] = await Promise.all([
            WithdrawRequest.find(filter).sort({ status: 1, createdAt: -1 }).skip((page - 1) * limit).limit(limit)
                .populate('user', 'firstName lastName memberId phone walletBalance'),
            WithdrawRequest.countDocuments(filter),
        ]);
        return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    },

    async adminListTransactions(query: any) {
        const page = Math.max(1, Number(query.page) || 1);
        const limit = Math.min(100, Number(query.limit) || 30);
        const filter: any = {};
        if (query.type) filter.type = query.type;
        if (query.user) filter.user = toId(query.user);
        const [data, total] = await Promise.all([
            WalletTransaction.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
                .populate('user', 'firstName lastName memberId')
                .populate('fromUser', 'firstName lastName memberId'),
            WalletTransaction.countDocuments(filter),
        ]);
        return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    },

    async adminGetClub() {
        const [fund, history, settings] = await Promise.all([
            this.getClubFund(),
            ClubDistribution.find().sort({ createdAt: -1 }).limit(30),
            this.getSettings(),
        ]);
        const counts = await User.aggregate([
            { $match: { memberStatus: 'active', rank: { $gte: 1 } } },
            { $group: { _id: '$rank', count: { $sum: 1 } } },
        ]);
        const byRank = new Map(counts.map((c: any) => [c._id, c.count]));
        const preview = (settings as any).ranks.map((r: any) => {
            const pool = (fund.balance * r.sharePercent) / 100;
            const members = byRank.get(r.level) || 0;
            return { rank: r.level, name: r.name, percent: r.sharePercent, pool: floor2(pool), members, perMember: members ? floor2(pool / members) : 0 };
        });
        return { fund, history, preview, frequency: (settings as any).club.frequency };
    },

    async adminReports() {
        const [txByType, companyBySource, memberCounts, rankCounts, pendingW, fund] = await Promise.all([
            WalletTransaction.aggregate([{ $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
            CompanyEarning.aggregate([{ $group: { _id: '$source', total: { $sum: '$amount' } } }]),
            User.aggregate([{ $match: { role: 'user' } }, { $group: { _id: '$memberStatus', count: { $sum: 1 } } }]),
            User.aggregate([{ $match: { memberStatus: 'active' } }, { $group: { _id: '$rank', count: { $sum: 1 } } }]),
            WithdrawRequest.aggregate([{ $match: { status: 'pending' } }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
            this.getClubFund(),
        ]);
        const walletTotal = await User.aggregate([{ $group: { _id: null, total: { $sum: '$walletBalance' } } }]);
        const obj = (arr: any[], key = 'total') => Object.fromEntries(arr.map((a) => [a._id ?? 'none', floor2(a[key])]));
        return {
            paid: obj(txByType),
            company: obj(companyBySource),
            members: Object.fromEntries(memberCounts.map((m: any) => [m._id || 'none', m.count])),
            ranks: Object.fromEntries(rankCounts.map((r: any) => [r._id, r.count])),
            pendingWithdraw: { total: floor2(pendingW[0]?.total || 0), count: pendingW[0]?.count || 0 },
            club: { balance: floor2(fund.balance), totalCollected: floor2(fund.totalCollected), totalDistributed: floor2(fund.totalDistributed) },
            walletsTotal: floor2(walletTotal[0]?.total || 0),
        };
    },

    /* ── Startup ─────────────────────────────────────────────── */
    async backfillMemberIds() {
        const missing = await User.find({ memberId: { $exists: false } }).limit(5000);
        for (const u of missing) {
            try { await u.save({ validateBeforeSave: false }); } catch (e: any) { console.error('Member ID backfill failed for', String(u._id), e.message); }
        }
        if (missing.length) console.log(`🪪 Assigned Member IDs to ${missing.length} existing account(s)`);
    },

    startScheduler() {
        const tick = () => this.runScheduledClub().catch((e) => console.error('Rank Club schedule failed:', e.message));
        setInterval(tick, 30 * 60 * 1000);
        setTimeout(tick, 60 * 1000);
    },
};

export { MlmService };
export default MlmService;
