import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../../config';
import AppError from '../../utils/AppError';
import { User } from '../user/user.model';
import { IAuthResponse, IJwtPayload, ITokens } from './auth.interface';
import { TLoginInput, TRegisterInput } from './auth.validation';

const AuthService = {
    generateTokens(payload: IJwtPayload): ITokens {
        const accessToken = jwt.sign(payload, config.jwt.access_secret, {
            expiresIn: config.jwt.access_expires_in as SignOptions['expiresIn'],
        });
        const refreshToken = jwt.sign(payload, config.jwt.refresh_secret, {
            expiresIn: config.jwt.refresh_expires_in as SignOptions['expiresIn'],
        });
        return { accessToken, refreshToken };
    },

    async register(payload: any): Promise<IAuthResponse> {
        const { firstName, lastName, email, phone, password, location, referralCode, division, district, village } = payload;

        // Optional username — lowercase letters, numbers and _ only.
        const username = payload.username ? String(payload.username).trim().toLowerCase() : '';
        if (username) {
            if (!/^[a-z0-9_]{3,20}$/.test(username)) throw new AppError(400, 'Username must be 3–20 characters: letters, numbers or _');
            if (/^sph\d+$/.test(username)) throw new AppError(400, 'This username is reserved. Please choose another.');
            if (await User.exists({ username })) throw new AppError(400, 'This username is already taken. Please choose another.');
        }

        // Optional sponsor — the new account joins under him in the network.
        let sponsor: any = null;
        if (referralCode && String(referralCode).trim()) {
            const { MlmService } = await import('../mlm/mlm.service');
            sponsor = await MlmService.findReferrer(String(referralCode));
            if (!sponsor) throw new AppError(400, 'This referral code is not valid. Check it or leave it empty.');
        }

        // Auto-generate guest email if only phone provided
        const userEmail = email || `${phone?.replace(/\s+/g, '')}@guest.shopnopuronhobe.com`;

        const isExists = await User.isUserExists(userEmail);
        if (isExists) throw new AppError(400, 'Account already exists with this email. Please login.');

        // Also check if phone is already registered
        if (phone) {
            const phoneExists = await User.findOne({ phone: phone.trim() });
            if (phoneExists) throw new AppError(400, 'This phone number is already registered. Please login.');
        }

        const user = await User.create({
            firstName,
            lastName: lastName || '.',
            email: userEmail,
            phone: phone || '',
            password,
            location: location || '',
            ...(username ? { username } : {}),
            division: division || '',
            district: district || '',
            village: village || '',
            referredBy: sponsor ? sponsor._id : null,
            ancestors: sponsor ? [sponsor._id, ...(sponsor.ancestors || [])] : [],
            status: 'active',
            isEmailVerified: false,
        });

        const jwtPayload: IJwtPayload = { userId: user._id!.toString(), email: user.email, role: user.role };
        const tokens = this.generateTokens(jwtPayload);

        return {
            user: { _id: user._id!.toString(), email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, avatar: user.avatar },
            tokens,
        };
    },

    async login(payload: any): Promise<IAuthResponse> {
        const { email, phone, password } = payload;

        // Find user by email OR phone
        let user;
        if (email) {
            user = await User.findByEmail(email);
        } else if (phone) {
            user = await User.findOne({ phone: phone.trim() }).select('+password');
        } else if (payload.username) {
            user = await User.findOne({ username: String(payload.username).trim().toLowerCase() }).select('+password');
        }

        if (!user) throw new AppError(401, 'Invalid credentials. No account found.');
        if (user.isDeleted) throw new AppError(401, 'This account has been deleted');
        if (user.status === 'blocked') throw new AppError(403, 'Your account has been blocked. Contact support.');

        const isPasswordCorrect = await user.comparePassword(password);
        if (!isPasswordCorrect) throw new AppError(401, 'Incorrect password.');

        const jwtPayload: IJwtPayload = { userId: user._id!.toString(), email: user.email, role: user.role };
        const tokens = this.generateTokens(jwtPayload);

        return {
            user: { _id: user._id!.toString(), email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, avatar: user.avatar },
            tokens,
        };
    },

    async refreshToken(refreshToken: string): Promise<ITokens> {
        let decoded: JwtPayload;
        try {
            decoded = jwt.verify(refreshToken, config.jwt.refresh_secret) as JwtPayload;
        } catch {
            throw new AppError(401, 'Invalid or expired refresh token');
        }

        const user = await User.findById(decoded.userId);
        if (!user || user.isDeleted) throw new AppError(401, 'User not found');
        if (user.status === 'blocked') throw new AppError(403, 'Your account has been blocked');

        if (user.isPasswordChangedAfterJwtIssued(decoded.iat as number)) {
            throw new AppError(401, 'Password changed. Please login again.');
        }

        const jwtPayload: IJwtPayload = { userId: user._id!.toString(), email: user.email, role: user.role };
        return this.generateTokens(jwtPayload);
    },

    async forgotPassword(email: string): Promise<string> {
        const user = await User.findOne({ email, isDeleted: false });
        if (!user) throw new AppError(404, 'No user found with this email');

        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

        user.passwordResetToken = hashedToken;
        user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min
        await user.save({ validateBeforeSave: false });

        return resetToken;
    },

    async resetPassword(token: string, newPassword: string): Promise<void> {
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        const user = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() },
            isDeleted: false,
        });

        if (!user) throw new AppError(400, 'Invalid or expired reset token');
        user.password = newPassword;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        // An invited account is "pending" until it sets a password via this link —
        // activate it so the invitee can log in immediately.
        if (user.status === 'pending') user.status = 'active';
        await user.save();
    },

    async updatePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
        const user = await User.findById(userId).select('+password');
        if (!user || user.isDeleted) throw new AppError(404, 'User not found');

        const isPasswordCorrect = await user.comparePassword(currentPassword);
        if (!isPasswordCorrect) throw new AppError(401, 'Current password is incorrect');

        user.password = newPassword;
        await user.save();
    },

    async getMe(userId: string) {
        const user = await User.findById(userId);
        if (!user) throw new AppError(404, 'User not found');
        return user;
    },
};

export default AuthService;
