import { HttpError } from '../middleware/errorHandler.js';
import { toPublicUser } from './authService.js';

function guestExpiration(now, days) {
  const expiresAt = new Date(now);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + days);
  return expiresAt.toISOString();
}

export function createUserService({ userModel, guestArchiveDays = 30, now = () => new Date() }) {
  return {
    async createGuest({ fullName, phoneNumber, barangay, municipality }) {
      return toPublicUser(
        await userModel.create({
          fullName,
          phoneNumber,
          barangay,
          municipality,
          email: null,
          passwordHash: null,
          accountType: 'guest',
          guestExpiresAt: guestExpiration(now(), guestArchiveDays),
        })
      );
    },
    async list() {
      return (await userModel.list()).map(toPublicUser);
    },
    async getById(id) {
      const user = await userModel.findById(id);
      if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found.');
      return toPublicUser(user);
    },
    async requireActiveSession(id) {
      const user = await userModel.touchActiveSession(id, guestArchiveDays);
      if (!user) {
        throw new HttpError(401, 'ACCOUNT_INACTIVE', 'This account is no longer active. Please sign in again.');
      }
      return toPublicUser(user);
    },
    async update(id, profile) {
      const user = await userModel.update(id, profile);
      if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found.');
      return toPublicUser(user);
    },
    async remove(id) {
      if (!(await userModel.remove(id))) {
        throw new HttpError(404, 'USER_NOT_FOUND', 'User not found.');
      }
    },
  };
}
