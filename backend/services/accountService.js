import bcrypt from 'bcryptjs';
import { HttpError } from '../middleware/errorHandler.js';

export function createAccountService({ pool, userModel, waterTestModel, uploadDeletionService }) {
  return {
    async removeCurrent({ userId, password }) {
      const account = await userModel.findById(userId);
      if (!account || account.isArchived) {
        throw new HttpError(401, 'ACCOUNT_INACTIVE', 'This account is no longer active. Please sign in again.');
      }
      if (account.accountType === 'registered') {
        if (typeof password !== 'string' || !password) {
          throw new HttpError(400, 'PASSWORD_CONFIRMATION_REQUIRED', 'Enter your current password to permanently delete your account.');
        }
        if (!(await bcrypt.compare(password, account.passwordHash || ''))) {
          throw new HttpError(401, 'INVALID_CREDENTIALS', 'Your current password is incorrect.');
        }
      }

      const client = await pool.connect();
      let stagedUploads = null;
      let committed = false;
      try {
        await client.query('BEGIN');
        const lockedAccount = await userModel.findByIdForDeletion(userId, client);
        if (!lockedAccount || lockedAccount.isArchived) {
          throw new HttpError(401, 'ACCOUNT_INACTIVE', 'This account is no longer active. Please sign in again.');
        }
        const ownedTests = await waterTestModel.listOwnedForDeletion(userId, client);
        stagedUploads = await uploadDeletionService.stage(ownedTests.map((waterTest) => waterTest.imagePath));
        if (!(await userModel.removeOwned(userId, client))) {
          throw new HttpError(404, 'USER_NOT_FOUND', 'User not found.');
        }
        await client.query('COMMIT');
        committed = true;
      } catch (error) {
        if (!committed) await client.query('ROLLBACK').catch(() => undefined);
        if (stagedUploads) await stagedUploads.restore().catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }

      if (stagedUploads) {
        await stagedUploads.finalize().catch(() => {
          console.error(JSON.stringify({ event: 'upload-cleanup-failed', operation: 'account-delete' }));
        });
      }
    },
  };
}
