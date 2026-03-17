import type { PrismaClient } from '@prisma/client';
import type { EventBus } from '../eventbus/port.js';
import * as activityListener from './activityListener.js';
import * as notificationListener from './notificationListener.js';
import * as webhookListener from './webhookListener.js';
import * as automationListener from './automationListener.js';
import * as sseListener from './sseListener.js';
import * as slackListener from './slackListener.js';

export function registerListeners(bus: EventBus, prisma: PrismaClient): void {
  activityListener.register(bus, prisma);
  notificationListener.register(bus, prisma);
  webhookListener.register(bus, prisma);
  automationListener.register(bus, prisma);
  sseListener.register(bus);
  slackListener.register(bus, prisma);
}
