import { createServer, proxy } from 'aws-serverless-express';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import app from './app.js';

const server = createServer(app);

export const handler = (event: APIGatewayProxyEvent, context: Context) => {
  const e = { ...event };
  if (e.path && e.path.split('/').length > 1) {
    const segments = e.path.split('/').filter(Boolean);
    if (segments[0] && ['prod', 'dev', 'stage'].includes(segments[0])) {
      e.path = '/' + segments.slice(1).join('/') || '/';
    }
  }
  return proxy(server, e, context, 'PROMISE').promise;
};
