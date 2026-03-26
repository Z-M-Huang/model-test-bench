import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { SDKMessageRecord } from '../types.js';
import { ToolCallBlock } from './ToolCallBlock.js';
import { ThinkingBlock } from './ThinkingBlock.js';

interface Props {
  messages: readonly SDKMessageRecord[];
  loading?: boolean;
}

/** Extract the inner message from SDK envelope. SDK yields { type, message: { role, content } }. */
function unwrap(msg: Record<string, unknown>): { type: string; role?: string; content?: unknown; raw: Record<string, unknown> } {
  const type = (msg.type as string) ?? '';
  const inner = msg.message as Record<string, unknown> | undefined;

  // If there's a nested `message` object (SDK envelope), use it for role/content
  if (inner && typeof inner === 'object') {
    return {
      type,
      role: (inner.role as string) ?? undefined,
      content: inner.content,
      raw: msg,
    };
  }

  // Flat message (role/content at top level)
  return {
    type,
    role: (msg.role as string) ?? undefined,
    content: msg.content,
    raw: msg,
  };
}

function renderContentBlock(block: Record<string, unknown>, idx: number): React.JSX.Element | null {
  const blockType = block.type as string | undefined;

  if (blockType === 'text') {
    return (
      <div key={idx} className="text-sm text-on-surface whitespace-pre-wrap leading-relaxed">
        {block.text as string}
      </div>
    );
  }

  if (blockType === 'tool_use') {
    return (
      <ToolCallBlock
        key={idx}
        name={(block.name as string) ?? 'unknown'}
        input={block.input}
      />
    );
  }

  if (blockType === 'tool_result') {
    const content = block.content;
    const isError = block.is_error === true;
    const text = typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? (content as Record<string, unknown>[])
            .filter((c) => c.type === 'text')
            .map((c) => c.text as string)
            .join('\n')
        : JSON.stringify(content);
    return (
      <ToolCallBlock
        key={idx}
        name={isError ? 'Error' : 'Result'}
        output={text}
      />
    );
  }

  if (blockType === 'thinking') {
    return <ThinkingBlock key={idx} content={(block.thinking as string) ?? ''} />;
  }

  return null;
}

/** Extract readable text from content (string or content blocks array). */
function extractText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return (content as Record<string, unknown>[])
      .filter((c) => c.type === 'text')
      .map((c) => c.text as string)
      .join('\n');
  }
  return JSON.stringify(content);
}

function MessageEntry({ record }: { record: SDKMessageRecord }): React.JSX.Element {
  const { t } = useTranslation();
  const { type, role, content, raw } = unwrap(record.message);

  // ── System messages: show compact or hide ──
  if (type === 'system') {
    const subtype = raw.subtype as string | undefined;
    // Hide init/api_retry noise
    if (subtype === 'init') {
      return (
        <div className="text-[0.65rem] text-on-surface-variant/40 font-mono pl-9 flex items-center gap-2">
          <span className="material-symbols-outlined" style={{ fontSize: '0.7rem' }}>terminal</span>
          {t('messageLog.sessionInitialized')}
        </div>
      );
    }
    if (subtype === 'api_retry') {
      const attempt = raw.attempt as number | undefined;
      const error = raw.error as string | undefined;
      return (
        <div className="text-[0.65rem] text-warning/60 font-mono pl-9 flex items-center gap-2">
          <span className="material-symbols-outlined" style={{ fontSize: '0.7rem' }}>refresh</span>
          {error
            ? t('messageLog.apiRetryWithError', { attempt: attempt ?? '?', error })
            : t('messageLog.apiRetry', { attempt: attempt ?? '?' })}
        </div>
      );
    }
    return (
      <div className="text-[0.65rem] text-on-surface-variant/40 font-mono pl-9">
        system: {subtype ?? JSON.stringify(raw).slice(0, 120)}
      </div>
    );
  }

  // ── Assistant messages ──
  if (type === 'assistant' || role === 'assistant') {
    const blocks = Array.isArray(content) ? (content as Record<string, unknown>[]) : [];
    const textOnly = typeof content === 'string';

    return (
      <div className="flex gap-3">
        <div className="w-6 h-6 rounded-full bg-primary-container/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: '0.8rem' }}>smart_toy</span>
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          {textOnly && (
            <div className="text-sm text-on-surface whitespace-pre-wrap leading-relaxed">
              {content as string}
            </div>
          )}
          {blocks.map((block, idx) => renderContentBlock(block, idx))}
          {!textOnly && blocks.length === 0 && (
            <div className="text-xs text-on-surface-variant/50 italic">
              (assistant message)
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── User messages (includes tool results fed back to the model) ──
  if (type === 'user' || role === 'user' || role === 'human') {
    // Content is often an array of tool_result blocks
    if (Array.isArray(content)) {
      const blocks = content as Record<string, unknown>[];
      const hasToolResults = blocks.some((b) => b.type === 'tool_result');
      if (hasToolResults) {
        return (
          <div className="ml-9 space-y-1">
            {blocks.map((block, idx) => renderContentBlock(block, idx))}
          </div>
        );
      }
    }

    const text = extractText(content);
    return (
      <div className="flex gap-3">
        <div className="w-6 h-6 rounded-full bg-secondary-container/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="material-symbols-outlined text-secondary" style={{ fontSize: '0.8rem' }}>person</span>
        </div>
        <div className="text-sm text-on-surface-variant whitespace-pre-wrap leading-relaxed">
          {text}
        </div>
      </div>
    );
  }

  // ── Result summary ──
  if (type === 'result') {
    const subtype = raw.subtype as string | undefined;
    const result = raw.result as string | undefined;
    const isSuccess = subtype === 'success';
    return (
      <div className="flex gap-3">
        <div className={'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ' + (isSuccess ? 'bg-green-400/20' : 'bg-error/20')}>
          <span className={'material-symbols-outlined ' + (isSuccess ? 'text-green-400' : 'text-error')} style={{ fontSize: '0.8rem' }}>
            {isSuccess ? 'check' : 'error'}
          </span>
        </div>
        <div className={'text-sm whitespace-pre-wrap ' + (isSuccess ? 'text-green-400/80' : 'text-error/80')}>
          {result ?? (typeof content === 'string' ? content : JSON.stringify(content))}
        </div>
      </div>
    );
  }

  // ── Default: unknown event type ──
  return (
    <div className="text-[0.65rem] text-on-surface-variant/50 font-mono pl-9 truncate">
      {type || role || 'event'}: {JSON.stringify(raw).slice(0, 200)}
    </div>
  );
}

function LoadingSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3">
          <div className="w-6 h-6 rounded-full bg-surface-container-high" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-surface-container-high rounded w-3/4" />
            <div className="h-3 bg-surface-container-high rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MessageLog({ messages, loading }: Props): React.JSX.Element {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (loading && messages.length === 0) {
    return (
      <div className="p-4">
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {messages.map((record, idx) => (
        <MessageEntry key={idx} record={record} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
