import express, { Router, type Response } from 'express';
import { AdminUpdateUserAttributesCommand, CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { createOrgSchema } from '@task-toad/shared';
import { putOrg, putUser } from '../db/table.js';
import { v4 as uuidv4 } from 'uuid';

const router: express.IRouter = Router();
const cognito = new CognitoIdentityProviderClient({ region: process.env.COGNITO_REGION ?? 'us-east-1' });
const userPoolId = process.env.COGNITO_USER_POOL_ID ?? '';

router.post('/orgs', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parsed = createOrgSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const tenant = req.tenant!;
  if (tenant.orgId) {
    res.status(400).json({ error: 'User already belongs to an organization' });
    return;
  }
  const orgId = uuidv4();
  await putOrg(orgId, parsed.data.name);
  await putUser(orgId, tenant.userId, req.userEmail ?? '', 'org:admin');
  if (userPoolId) {
    await cognito.send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: userPoolId,
        Username: tenant.userId,
        UserAttributes: [
          { Name: 'custom:org_id', Value: orgId },
          { Name: 'custom:role', Value: 'org:admin' },
        ],
      })
    );
  }
  res.status(201).json({ orgId, name: parsed.data.name });
});

export default router;
