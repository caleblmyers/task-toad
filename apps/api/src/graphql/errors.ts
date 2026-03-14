import { GraphQLError } from 'graphql';
import type { Context } from './context.js';

export class AuthenticationError extends GraphQLError {
  constructor(message = 'Authentication required') {
    super(message, { extensions: { code: 'UNAUTHENTICATED' } });
  }
}

export class AuthorizationError extends GraphQLError {
  constructor(message = 'Insufficient permissions') {
    super(message, { extensions: { code: 'FORBIDDEN' } });
  }
}

export class NotFoundError extends GraphQLError {
  constructor(message = 'Resource not found') {
    super(message, { extensions: { code: 'NOT_FOUND' } });
  }
}

export class ValidationError extends GraphQLError {
  constructor(message = 'Invalid input') {
    super(message, { extensions: { code: 'BAD_USER_INPUT' } });
  }
}

export class ConflictError extends GraphQLError {
  constructor(message = 'Resource already exists') {
    super(message, { extensions: { code: 'CONFLICT' } });
  }
}

export class RateLimitError extends GraphQLError {
  constructor(message = 'Rate limit exceeded') {
    super(message, { extensions: { code: 'RATE_LIMITED' } });
  }
}

export class ExternalServiceError extends GraphQLError {
  constructor(message = 'External service error') {
    super(message, { extensions: { code: 'EXTERNAL_SERVICE_ERROR' } });
  }
}

export function requireAuth(ctx: Context): asserts ctx is Context & { user: NonNullable<Context['user']>; org: NonNullable<Context['org']> } {
  if (!ctx.user) throw new AuthenticationError();
  if (!ctx.org) throw new AuthenticationError('No organization found');
}

export function requireAdmin(ctx: Context): void {
  requireAuth(ctx);
  if (ctx.user.role !== 'org:admin') throw new AuthorizationError('Admin access required');
}
