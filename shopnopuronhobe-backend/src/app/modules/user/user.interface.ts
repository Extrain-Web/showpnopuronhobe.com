import { Document, Model, Types } from 'mongoose';

export interface IShippingAddress {
    label: string;
    fullName: string;
    phone: string;
    address: string;
    area: string;
    city: string;
    postalCode: string;
    isDefault: boolean;
}

export interface IUser extends Document {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone: string;
    avatar: string;
    role: 'admin' | 'user';
    status: 'active' | 'blocked' | 'pending';
    isEmailVerified: boolean;
    isDeleted: boolean;

    // Addresses
    shippingAddresses: IShippingAddress[];

    // Stats
    totalOrders: number;
    totalSpent: number;

    // Wishlist
    wishlist: string[];

    // Location
    division: string;
    district: string;
    village: string;

    // Membership / referral network
    username?: string;
    memberId?: number;
    referralCode?: string;
    referredBy?: Types.ObjectId | null;
    ancestors: Types.ObjectId[];
    points: number;
    memberStatus: 'none' | 'pending' | 'active' | 'rejected';
    memberRequestedAt?: Date | null;
    memberActivatedAt?: Date | null;
    memberRejectReason?: string;
    rank: number;
    rankAchievedAt?: Date | null;
    directActiveCount: number;
    teamActiveCount: number;
    referralBonusCount: number;
    walletBalance: number;
    totalEarned: number;

    // Password reset
    passwordResetToken?: string;
    passwordResetExpires?: Date;
    passwordChangedAt?: Date;

    // Methods
    comparePassword(candidatePassword: string): Promise<boolean>;
    isPasswordChangedAfterJwtIssued(jwtTimestamp: number): boolean;
}

export interface IUserMethods {
    comparePassword(candidatePassword: string): Promise<boolean>;
    isPasswordChangedAfterJwtIssued(jwtTimestamp: number): boolean;
}

export interface UserModel extends Model<IUser, object, IUserMethods> {
    findByEmail(email: string): Promise<IUser | null>;
    isUserExists(email: string): Promise<boolean>;
}
