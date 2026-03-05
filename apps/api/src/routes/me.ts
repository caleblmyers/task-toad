import express, { Router, type Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { getUser } from '../db/table.js';

const router: express.IRouter = Router();

router.get('/me', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenant = req.tenant!;
  const email = req.userEmail ?? '';
  if (tenant.orgId) {
    const userRecord = await getUser(tenant.orgId, tenant.userId);
    const emailFromDb = userRecord?.email ?? email;
    res.json({
      userId: tenant.userId,
      email: emailFromDb,
      orgId: tenant.orgId,
      role: tenant.role,
    });
    return;
  }
  res.json({
    userId: tenant.userId,
    email,
    orgId: null,
    role: null,
  });
});

export default router;
