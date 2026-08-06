import { HttpError } from '../middleware/errorHandler.js';

export function createWaterTestService({ waterTestModel, pool = null, uploadDeletionService = null }) {
  async function getOwnedWaterTest(id, userId, executor) {
    const waterTest = await waterTestModel.findById(id, executor);
    if (!waterTest) throw new HttpError(404, 'WATER_TEST_NOT_FOUND', 'Water test not found.');
    if (waterTest.userId !== userId) throw new HttpError(403, 'FORBIDDEN', 'You do not have access to this resource.');
    return waterTest;
  }

  return {
    async list({ userId } = {}) {
      return waterTestModel.list({ userId: userId || null });
    },
    async getById(id, userId, executor = undefined) {
      return getOwnedWaterTest(id, userId, executor);
    },
    async update(id, userId, updates) {
      await this.getById(id, userId);
      const waterTest = await waterTestModel.updateMetadata(id, updates);
      if (!waterTest) throw new HttpError(404, 'WATER_TEST_NOT_FOUND', 'Water test not found.');
      return waterTest;
    },
    async remove(id, userId) {
      if (!pool || !uploadDeletionService) {
        await getOwnedWaterTest(id, userId);
        if (!(await waterTestModel.remove(id))) {
          throw new HttpError(404, 'WATER_TEST_NOT_FOUND', 'Water test not found.');
        }
        return;
      }

      const client = await pool.connect();
      let stagedUploads = null;
      let committed = false;
      try {
        await client.query('BEGIN');
        const waterTest = await getOwnedWaterTest(id, userId, client);
        stagedUploads = await uploadDeletionService.stage([waterTest.imagePath]);
        if (!(await waterTestModel.removeOwned(id, userId, client))) {
          throw new HttpError(404, 'WATER_TEST_NOT_FOUND', 'Water test not found.');
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
          console.error(JSON.stringify({ event: 'upload-cleanup-failed', operation: 'water-test-delete' }));
        });
      }
    },
  };
}
