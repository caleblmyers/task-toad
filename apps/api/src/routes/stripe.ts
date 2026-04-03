import { Router } from 'express';
import express from 'express';
import Stripe from 'stripe';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '../graphql/context.js';
import { getPrisma } from './sharedPrisma.js';
import { invalidateOrgPlanCache } from '../utils/orgPlanCache.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('stripe');

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  return new Stripe(key);
}

/** Extract authenticated user from cookies or Authorization header */
async function getUserFromRequest(req: express.Request): Promise<{ userId: string; email: string; orgId: string | null; role: string | null } | null> {
  const token = req.cookies?.['tt-access'] || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.sub;
    if (!userId) return null;
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { userId },
      select: { userId: true, email: true, orgId: true, role: true },
    });
    return user;
  } catch {
    return null;
  }
}

export const stripeWebhookHandler: express.RequestHandler = async (req, res) => {
  const stripe = getStripe();
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    res.status(400).json({ error: 'Missing signature or webhook secret' });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig as string, webhookSecret);
  } catch (err) {
    log.warn({ err }, 'Stripe webhook signature verification failed');
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  const prisma = getPrisma();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId = session.metadata?.orgId;
      if (orgId && session.subscription) {
        await prisma.org.update({
          where: { orgId },
          data: {
            plan: 'paid',
            stripeSubscriptionId: session.subscription as string,
          },
        });
        invalidateOrgPlanCache(orgId);
        log.info({ orgId, subscriptionId: session.subscription }, 'Checkout completed — org upgraded to paid');
      }
      break;
    }
    case 'customer.subscription.deleted':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const org = await prisma.org.findFirst({
        where: { stripeCustomerId: subscription.customer as string },
      });
      if (org) {
        const isActive = subscription.status === 'active' || subscription.status === 'trialing';
        await prisma.org.update({
          where: { orgId: org.orgId },
          data: {
            plan: isActive ? 'paid' : 'free',
            stripeSubscriptionId: isActive ? subscription.id : null,
          },
        });
        invalidateOrgPlanCache(org.orgId);
        log.info({ orgId: org.orgId, status: subscription.status, isActive }, 'Subscription updated');
      }
      break;
    }
  }

  res.json({ received: true });
};

export const stripeRouter: Router = Router();

// Create Stripe Checkout session for Pro upgrade
stripeRouter.post('/checkout', async (req, res) => {
  const user = await getUserFromRequest(req);
  if (!user?.orgId) { res.status(401).json({ error: 'Not authenticated' }); return; }
  if (user.role !== 'org:admin') { res.status(403).json({ error: 'Admin role required' }); return; }

  const { priceId } = req.body as { priceId?: string };
  if (!priceId) { res.status(400).json({ error: 'priceId is required' }); return; }

  const stripe = getStripe();
  const prisma = getPrisma();

  // Get or create Stripe customer
  const org = await prisma.org.findUnique({ where: { orgId: user.orgId } });
  if (!org) { res.status(404).json({ error: 'Org not found' }); return; }

  let customerId = org.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { orgId: user.orgId },
    });
    customerId = customer.id;
    await prisma.org.update({
      where: { orgId: user.orgId },
      data: { stripeCustomerId: customerId },
    });
  }

  const successUrl = `${process.env.CORS_ORIGINS?.split(',')[0] ?? 'http://localhost:5173'}/settings?billing=success`;
  const cancelUrl = `${process.env.CORS_ORIGINS?.split(',')[0] ?? 'http://localhost:5173'}/settings?billing=cancelled`;

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { orgId: user.orgId },
  });

  res.json({ url: session.url });
});

// Create Stripe billing portal session for subscription management
stripeRouter.post('/portal', async (req, res) => {
  const user = await getUserFromRequest(req);
  if (!user?.orgId) { res.status(401).json({ error: 'Not authenticated' }); return; }
  if (user.role !== 'org:admin') { res.status(403).json({ error: 'Admin role required' }); return; }

  const prisma = getPrisma();
  const org = await prisma.org.findUnique({ where: { orgId: user.orgId } });
  if (!org?.stripeCustomerId) {
    res.status(400).json({ error: 'No billing account' });
    return;
  }

  const stripe = getStripe();
  const returnUrl = `${process.env.CORS_ORIGINS?.split(',')[0] ?? 'http://localhost:5173'}/settings`;

  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: returnUrl,
  });

  res.json({ url: session.url });
});
