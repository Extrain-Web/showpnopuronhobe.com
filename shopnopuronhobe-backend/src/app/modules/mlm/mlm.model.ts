import { Schema, model, Types } from 'mongoose';

/* ════════════════════════════════════════════════════════════════
 *  MLM / Membership models
 *  Every number used by the reward engine lives in MlmSettings so the
 *  admin can change it from the panel — nothing is hard-coded.
 * ════════════════════════════════════════════════════════════════ */

// ── Settings (singleton, key = 'default') ─────────────────────────
const rankSchema = new Schema({
    level: { type: Number, required: true },          // 1..7
    name: { type: String, required: true },
    // Rank 1 is reached with direct referrals only.
    directTarget: { type: Number, default: 0 },
    // Rank 2+ : NEW members needed in each of the 4 links (on top of the previous rank).
    links: { type: [Number], default: [0, 0, 0, 0] },
    // Share (%) of the generation commission and the Rank Club fund for this rank.
    sharePercent: { type: Number, default: 0 },
    reward: { type: String, default: '' },
}, { _id: false });

const mlmSettingsSchema = new Schema({
    key: { type: String, default: 'default', unique: true },

    pointValue: { type: Number, default: 30 },           // 1 point = ৳30
    membershipPoints: { type: Number, default: 50 },     // points needed to request membership

    referralBonus: {
        amount: { type: Number, default: 400 },
        requiredReferrals: { type: Number, default: 15 },
        // false → paid once in a lifetime. true → paid again for every further block.
        repeat: { type: Boolean, default: false },
    },

    generationCommission: {
        amount: { type: Number, default: 300 },
        depth: { type: Number, default: 0 },             // how many upline levels; 0 = all
    },

    club: {
        contributionType: { type: String, enum: ['fixed', 'percent', 'perPoint'], default: 'fixed' },
        contributionValue: { type: Number, default: 0 },
        frequency: { type: String, enum: ['manual', 'daily', 'weekly', 'monthly'], default: 'monthly' },
    },

    withdraw: {
        minAmount: { type: Number, default: 100 },
        chargePercent: { type: Number, default: 10 },
    },

    ranks: { type: [rankSchema], default: [] },
}, { timestamps: true });

export const DEFAULT_RANKS = [
    { level: 1, name: 'Dream Associate', directTarget: 15, links: [0, 0, 0, 0], sharePercent: 30, reward: '' },
    { level: 2, name: 'Dream Achiever', directTarget: 0, links: [30, 30, 30, 45], sharePercent: 20, reward: "Cox's Bazar Tour" },
    { level: 3, name: 'Dream Champion', directTarget: 0, links: [200, 200, 200, 250], sharePercent: 15, reward: '' },
    { level: 4, name: 'Dream Leader', directTarget: 0, links: [600, 600, 600, 1200], sharePercent: 12, reward: '' },
    { level: 5, name: 'Dream Director', directTarget: 0, links: [800, 800, 800, 1600], sharePercent: 10, reward: '' },
    { level: 6, name: 'Dream Ambassador', directTarget: 0, links: [1800, 1800, 1800, 2600], sharePercent: 8, reward: '' },
    { level: 7, name: 'Dream Legend', directTarget: 0, links: [3500, 3500, 3500, 5500], sharePercent: 5, reward: '' },
];

export const MlmSettings = model('MlmSettings', mlmSettingsSchema);

// ── Wallet transactions (one row per money movement) ──────────────
export const TX_TYPES = [
    'referral_bonus',     // ৳400 for completing the referral target
    'generation',         // share of an upline's generation commission
    'club',               // Rank Club distribution
    'withdraw',           // money moved out of the wallet for a withdraw request
    'withdraw_refund',    // rejected withdraw returned to the wallet
    'adjustment',         // manual admin correction
] as const;

const walletTxSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: TX_TYPES, required: true },
    amount: { type: Number, required: true },            // + credit, − debit
    balanceAfter: { type: Number, default: 0 },
    note: { type: String, default: '' },
    fromUser: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    ref: { type: String, default: '' },                  // e.g. distribution id / withdraw id
}, { timestamps: true });
walletTxSchema.index({ user: 1, createdAt: -1 });
walletTxSchema.index({ type: 1, createdAt: -1 });

export const WalletTransaction = model('WalletTransaction', walletTxSchema);

// ── Withdraw requests ─────────────────────────────────────────────
const withdrawSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true },            // taken from the wallet
    chargePercent: { type: Number, default: 0 },
    charge: { type: Number, default: 0 },
    payable: { type: Number, required: true },           // amount − charge, sent to the member
    method: { type: String, enum: ['bkash', 'nagad'], required: true },
    accountNumber: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    adminNote: { type: String, default: '' },
    transactionId: { type: String, default: '' },
    processedAt: { type: Date, default: null },
}, { timestamps: true });

export const WithdrawRequest = model('WithdrawRequest', withdrawSchema);

// ── Rank Club fund (singleton) + distribution log ─────────────────
const clubFundSchema = new Schema({
    key: { type: String, default: 'default', unique: true },
    balance: { type: Number, default: 0 },
    totalCollected: { type: Number, default: 0 },
    totalDistributed: { type: Number, default: 0 },
    lastDistributedAt: { type: Date, default: null },
}, { timestamps: true });

export const ClubFund = model('ClubFund', clubFundSchema);

const clubDistributionSchema = new Schema({
    amount: { type: Number, required: true },
    toCompany: { type: Number, default: 0 },
    breakdown: [{
        rank: Number,
        name: String,
        percent: Number,
        pool: Number,
        members: Number,
        perMember: Number,
        _id: false,
    }],
    triggeredBy: { type: String, enum: ['manual', 'schedule'], default: 'manual' },
}, { timestamps: true });

export const ClubDistribution = model('ClubDistribution', clubDistributionSchema);

// ── Company earnings (unclaimed rank shares, withdraw charges) ─────
const companyEarningSchema = new Schema({
    source: { type: String, enum: ['generation_unclaimed', 'club_unclaimed', 'withdraw_charge'], required: true },
    amount: { type: Number, required: true },
    note: { type: String, default: '' },
    relatedUser: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

export const CompanyEarning = model('CompanyEarning', companyEarningSchema);

// ── Member notifications ──────────────────────────────────────────
const notificationSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, default: 'info' },             // membership, bonus, generation, club, rank, withdraw, points
    title: { type: String, required: true },
    message: { type: String, default: '' },
    link: { type: String, default: '' },
    read: { type: Boolean, default: false },
}, { timestamps: true });
notificationSchema.index({ user: 1, createdAt: -1 });

export const Notification = model('Notification', notificationSchema);

// ── Sequential member IDs (#100001, #100002 …) ────────────────────
const counterSchema = new Schema({ _id: String, seq: { type: Number } });
export const Counter = model('Counter', counterSchema);

const MEMBER_ID_BASE = 100000;

export async function nextMemberId(): Promise<number> {
    const c = await Counter.findOneAndUpdate(
        { _id: 'memberId' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true },
    );
    return MEMBER_ID_BASE + (c!.seq || 1);
}

export type ObjectIdLike = Types.ObjectId | string;

// ── Villages (registration picks one, or adds a new one) ──────────
const villageSchema = new Schema({
    division: { type: String, required: true, trim: true },
    district: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    nameKey: { type: String, required: true }, // lower-case, single-spaced — blocks duplicates
    memberCount: { type: Number, default: 0 },
}, { timestamps: true });
villageSchema.index({ district: 1, nameKey: 1 }, { unique: true });

export const Village = model('Village', villageSchema);
export const villageKey = (name: string) => String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
