import bcrypt from 'bcryptjs';
import { HttpError } from '../middleware/errorHandler.js';

export function toPublicUser(user) {
  if (!user) return null;
  const { passwordHash, ...publicUser } = user;
  return publicUser;
}

export function createAuthService({ userModel }) {
  return {
    async register({ fullName, email, phoneNumber, barangay, municipality, password }) {
      const existingUser = await userModel.findByEmail(email);
      if (existingUser) {
        throw new HttpError(409, 'EMAIL_IN_USE', 'An account already uses this email address.');
      }

      const passwordHash = await bcrypt.hash(password, 12);
      return toPublicUser(
        await userModel.create({ fullName, email, phoneNumber, barangay, municipality, passwordHash, accountType: 'registered' })
      );
    },

    async login({ email, password }) {
      const user = await userModel.findByEmail(email);
      const matches = user?.passwordHash ? await bcrypt.compare(password, user.passwordHash) : false;
      if (!matches) {
        throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
      }
      if (user.isArchived) {
        throw new HttpError(403, 'ACCOUNT_ARCHIVED', 'This account is archived and cannot sign in.');
      }
      return toPublicUser(user);
    },
  };
}
