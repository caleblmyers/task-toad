import type { Response } from 'express';

interface SSEClient {
  id: string;
  orgId: string;
  userId: string;
  res: Response;
}

const MAX_CONNECTIONS_PER_USER = 5;

class SSEManager {
  private clients: Map<string, SSEClient> = new Map();

  addClient(id: string, orgId: string, userId: string, res: Response): void {
    // Enforce per-user connection limit — evict oldest if at max
    const userClients: SSEClient[] = [];
    for (const client of this.clients.values()) {
      if (client.userId === userId) userClients.push(client);
    }
    if (userClients.length >= MAX_CONNECTIONS_PER_USER) {
      // Close the oldest connection (first found, which is insertion-order oldest in Map)
      const oldest = userClients[0];
      oldest.res.end();
      this.clients.delete(oldest.id);
    }

    this.clients.set(id, { id, orgId, userId, res });
    res.on('close', () => this.clients.delete(id));
  }

  broadcast(orgId: string, event: string, data: unknown): void {
    for (const client of this.clients.values()) {
      if (client.orgId === orgId) {
        client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        // Flush immediately to prevent any buffering layer from holding SSE data
        if (typeof (client.res as unknown as { flush?: () => void }).flush === 'function') {
          (client.res as unknown as { flush: () => void }).flush();
        }
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

  getUserClientCount(userId: string): number {
    let count = 0;
    for (const client of this.clients.values()) {
      if (client.userId === userId) count++;
    }
    return count;
  }

  closeAllConnections(): void {
    for (const client of this.clients.values()) {
      client.res.end();
    }
    this.clients.clear();
  }
}

export const sseManager = new SSEManager();
