import express from 'express';
import { authMiddleware, requireOrg } from './middleware/auth.js';
import meRouter from './routes/me.js';
import orgsRouter from './routes/orgs.js';
import projectsRouter from './routes/projects.js';
import tasksRouter from './routes/tasks.js';

const app: express.Express = express();
app.use(express.json());

app.use(authMiddleware);

app.use(meRouter);

app.use('/orgs', orgsRouter);

app.use(requireOrg);
app.use(projectsRouter);
app.use(tasksRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}) as express.ErrorRequestHandler);

export default app;
