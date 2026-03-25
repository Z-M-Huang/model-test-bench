// ---------------------------------------------------------------------------
// SSE (Server-Sent Events) handler for real-time run streaming
// ---------------------------------------------------------------------------

import type { Request, Response } from 'express';
import type { SDKMessageRecord } from '../types/index.js';

/** Per-run subscriber set for SSE clients. */
export type SSESubscriberMap = Map<string, Set<Response>>;

/**
 * Set up an SSE connection for a given run ID.
 * The response is kept open and messages are pushed via `sendSSE`.
 */
export function handleSSEConnection(
  req: Request,
  res: Response,
  runId: string,
  subscribers: SSESubscriberMap,
): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.flushHeaders();

  // Register subscriber
  if (!subscribers.has(runId)) {
    subscribers.set(runId, new Set());
  }
  subscribers.get(runId)!.add(res);

  // Clean up on disconnect
  req.on('close', () => {
    const subs = subscribers.get(runId);
    if (subs) {
      subs.delete(res);
      if (subs.size === 0) {
        subscribers.delete(runId);
      }
    }
  });
}

/**
 * Broadcast a message to all SSE subscribers for a run.
 */
export function broadcastSSE(
  runId: string,
  event: string,
  data: SDKMessageRecord | Record<string, unknown> | string,
  subscribers: SSESubscriberMap,
): void {
  const subs = subscribers.get(runId);
  if (!subs || subs.size === 0) return;

  const payload = typeof data === 'string' ? data : JSON.stringify(data);
  for (const res of subs) {
    res.write(`event: ${event}\ndata: ${payload}\n\n`);
  }
}

/**
 * Close all SSE connections for a run.
 */
export function closeSSE(runId: string, subscribers: SSESubscriberMap): void {
  const subs = subscribers.get(runId);
  if (!subs) return;

  for (const res of subs) {
    res.write('event: done\ndata: {}\n\n');
    res.end();
  }
  subscribers.delete(runId);
}
