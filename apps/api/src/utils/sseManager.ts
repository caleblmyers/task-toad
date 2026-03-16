import type { Response } from 'express';

interface SSEClient {
  id: string;
  orgId: string;
  userId: string;
  res: Response;
}

class SSEManager {
  private clients: Map<string, SSEClient> = new Map();

  addClient(id: string, orgId: string, userId: string, res: Response): void {
    this.clients.set(id, { id, orgId, userId, res });
    res.on('close', () => this.clients.delete(id));
  }

  broadcast(orgId: string, event: string, data: unknown): void {
    for (const client of this.clients.values()) {
      if (client.orgId === orgId) {
        client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    }
  }

  getClientCount(orgId: string): number {
    let count = 0;
    for (const client of this.clients.values()) {
      if (client.orgId === orgId) count++;
    }
    return count;
  }
}

export const sseManager = new SSEManager();
