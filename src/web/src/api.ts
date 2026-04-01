// ---------------------------------------------------------------------------
// Typed API client for the Model Test Bench server
// ---------------------------------------------------------------------------

import type {
  Provider,
  Scenario,
  Run,
  RunStatus,
  Evaluation,
  CreateEvaluationBody,
} from './types.js';

const BASE = window.location.origin;

// -- Helpers -----------------------------------------------------------------

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${res.statusText} – ${body}`);
  }
  // 204 No Content has no body — return undefined instead of parsing JSON
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

function get<T>(path: string) {
  return request<T>(path);
}

function post<T>(path: string, body: unknown) {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

function put<T>(path: string, body: unknown) {
  return request<T>(path, { method: 'PUT', body: JSON.stringify(body) });
}

function del<T = void>(path: string) {
  return request<T>(path, { method: 'DELETE' });
}

// -- Filters -----------------------------------------------------------------

export interface RunFilters {
  providerId?: string;
  scenarioId?: string;
  status?: RunStatus;
}

export interface EvaluationFilters {
  runId?: string;
}

function toQuery(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(
    (e): e is [string, string] => e[1] !== undefined,
  );
  if (entries.length === 0) return '';
  return '?' + new URLSearchParams(entries).toString();
}

// -- API object --------------------------------------------------------------

export const api = {
  providers: {
    list: () => get<Provider[]>('/api/providers'),
    get: (id: string) => get<Provider>(`/api/providers/${id}`),
    create: (data: Partial<Provider>) => post<Provider>('/api/providers', data),
    update: (id: string, data: Partial<Provider>) =>
      put<Provider>(`/api/providers/${id}`, data),
    delete: (id: string) => del(`/api/providers/${id}`),
  },

  scenarios: {
    list: () => get<Scenario[]>('/api/scenarios'),
    get: (id: string) => get<Scenario>(`/api/scenarios/${id}`),
    create: (data: Partial<Scenario>) =>
      post<Scenario>('/api/scenarios', data),
    update: (id: string, data: Partial<Scenario>) =>
      put<Scenario>(`/api/scenarios/${id}`, data),
    delete: (id: string) => del(`/api/scenarios/${id}`),
  },

  runs: {
    list: (filters?: RunFilters) =>
      get<Run[]>(`/api/runs${toQuery(filters ?? {})}`),
    get: (id: string) => get<Run>(`/api/runs/${id}`),
    getSummary: (id: string) =>
      get<{ run: Run; evaluation?: Evaluation }>(`/api/runs/${id}/summary`),
    create: (body: { providerId: string; scenarioId: string; reviewerProviderIds?: string[]; maxEvalRounds?: number }) =>
      post<Run>('/api/runs', body),
    delete: (id: string) => del(`/api/runs/${id}`),
  },

  evaluations: {
    list: (filters?: EvaluationFilters) =>
      get<Evaluation[]>(`/api/evaluations${toQuery(filters ?? {})}`),
    get: (id: string) => get<Evaluation>(`/api/evaluations/${id}`),
    create: (body: CreateEvaluationBody) =>
      post<Evaluation>('/api/evaluations', body),
  },
} as const;

// -- SSE helper --------------------------------------------------------------

export interface SSEHandlers {
  onMessage?: (event: MessageEvent) => void;
  onError?: (event: Event) => void;
  onOpen?: (event: Event) => void;
}

/**
 * Subscribe to a server-sent events stream.
 * Returns an unsubscribe function that closes the connection.
 */
export function subscribeSSE(url: string, handlers: SSEHandlers): () => void {
  const fullUrl = url.startsWith('http') ? url : `${BASE}${url}`;
  const source = new EventSource(fullUrl);

  if (handlers.onOpen) source.addEventListener('open', handlers.onOpen);
  if (handlers.onMessage) source.addEventListener('message', handlers.onMessage);
  if (handlers.onError) source.addEventListener('error', handlers.onError);

  return () => {
    source.close();
  };
}
