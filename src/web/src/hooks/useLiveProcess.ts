import { useState, useEffect, useRef, useCallback } from 'react';
import { subscribeSSE } from '../api.js';
import type { SDKMessageRecord } from '../types.js';

export interface UseLiveProcessOptions {
  /** SSE URL to subscribe to. Pass null to skip subscription. */
  sseUrl: string | null;
  /** Called when a terminal status is received. */
  onComplete?: (data: Record<string, unknown>) => void;
}

export interface UseLiveProcessResult {
  messages: SDKMessageRecord[];
  progressSteps: string[];
  status: string | null;
  elapsedMs: number;
  isConnected: boolean;
}

export function useLiveProcess({ sseUrl, onComplete }: UseLiveProcessOptions): UseLiveProcessResult {
  const [messages, setMessages] = useState<SDKMessageRecord[]>([]);
  const [progressSteps, setProgressSteps] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!sseUrl) return;

    // Reset state on new subscription
    setMessages([]);
    setProgressSteps([]);
    setStatus(null);
    setElapsedMs(0);
    setIsConnected(true);

    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      if (startTimeRef.current) {
        setElapsedMs(Date.now() - startTimeRef.current);
      }
    }, 500);

    const unsub = subscribeSSE(sseUrl, {
      onMessage: (event) => {
        try {
          const data = JSON.parse(event.data as string) as Record<string, unknown>;
          const type = data.type as string | undefined;

          if (type === 'status') {
            const s = data.status as string;
            setStatus(s);
            if (s === 'completed' || s === 'failed' || s === 'cancelled') {
              stopTimer();
              setIsConnected(false);
              onCompleteRef.current?.(data);
            }
          } else if (type === 'progress') {
            const detail = data.detail as string | undefined;
            const step = data.step as string;
            setProgressSteps((prev) => [...prev, detail ? `${step}: ${detail}` : step]);
          } else if (type === 'sdkMessage') {
            const record: SDKMessageRecord = {
              timestamp: data.timestamp as string ?? new Date().toISOString(),
              message: data.message as Record<string, unknown> ?? data,
            };
            setMessages((prev) => [...prev, record]);
          } else if (type === 'runComplete') {
            stopTimer();
            setIsConnected(false);
            onCompleteRef.current?.(data);
          } else {
            // Treat as SDK message (backward compat with run SSE)
            const record: SDKMessageRecord = {
              timestamp: (data.timestamp as string) ?? new Date().toISOString(),
              message: data,
            };
            setMessages((prev) => [...prev, record]);
          }
        } catch {
          // Ignore parse errors
        }
      },
      onError: () => {
        stopTimer();
        setIsConnected(false);
      },
    });

    return () => {
      unsub();
      stopTimer();
      setIsConnected(false);
    };
  }, [sseUrl, stopTimer]);

  return { messages, progressSteps, status, elapsedMs, isConnected };
}
