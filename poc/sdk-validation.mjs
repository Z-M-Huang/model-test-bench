/**
 * Phase 0: SDK Proof-of-Concept Validation
 *
 * Validates the highest-uncertainty SDK feature combination:
 * 1. query() with cwd pointing to a temp workspace
 * 2. settingSources: ['project'] loading CLAUDE.md from that workspace
 * 3. sandbox restricting writes to workspace only
 * 4. outputFormat for structured JSON output
 *
 * Requirements: ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN in .env file.
 *
 * Usage: node poc/sdk-validation.mjs
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';

// ─── Load .env file ─────────────────────────────────────────────────

const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (key && val) process.env[key] = val;
  }
  console.log('Loaded .env file');
} else {
  console.log('No .env file found — using environment variables');
}

// ─── Setup temp workspace ───────────────────────────────────────────

const workspaceDir = path.join(os.tmpdir(), `ctb-poc-${randomUUID().slice(0, 8)}`);
fs.mkdirSync(workspaceDir, { recursive: true });

// Write CLAUDE.md at workspace root
const claudeMdContent = `# POC Validation Rules

You MUST follow these rules:
1. Always start your response with the exact phrase "POC_MARKER_ACTIVE"
2. Never use the word "certainly"
3. Always mention the color "blue" somewhere in your response
`;
fs.writeFileSync(path.join(workspaceDir, 'CLAUDE.md'), claudeMdContent);

// Write a .claude directory with a rule
fs.mkdirSync(path.join(workspaceDir, '.claude', 'rules'), { recursive: true });
fs.writeFileSync(
  path.join(workspaceDir, '.claude', 'rules', 'test-rule.md'),
  'Always end your response with "RULE_CHECK_OK".'
);

// Write a workspace file (scenario)
fs.writeFileSync(
  path.join(workspaceDir, 'hello.txt'),
  'This is a test file in the workspace.'
);

console.log(`\n=== Phase 0: SDK POC Validation ===`);
console.log(`Workspace: ${workspaceDir}`);
console.log(`CLAUDE.md written: ${fs.existsSync(path.join(workspaceDir, 'CLAUDE.md'))}`);
console.log(`Rule written: ${fs.existsSync(path.join(workspaceDir, '.claude', 'rules', 'test-rule.md'))}`);

// ─── Read config from .env ──────────────────────────────────────────

const apiKey = process.env.ANTHROPIC_API_KEY;
const baseUrl = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const oauthToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;

if (!apiKey && !oauthToken) {
  console.error('ERROR: Set ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN in .env');
  process.exit(1);
}

console.log(`Provider: ${apiKey ? 'API' : 'OAuth'}`);
console.log(`Base URL: ${baseUrl}`);
console.log(`Model: ${model}`);

// ─── Build env for SDK subprocess ───────────────────────────────────

const env = {};
const envAllowlist = ['PATH', 'HOME', 'USER', 'SHELL', 'TERM', 'LANG', 'TMPDIR'];
for (const key of envAllowlist) {
  if (process.env[key]) env[key] = process.env[key];
}

if (apiKey) {
  env.ANTHROPIC_API_KEY = apiKey;
  env.ANTHROPIC_BASE_URL = baseUrl;
} else {
  env.CLAUDE_CODE_OAUTH_TOKEN = oauthToken;
}

// All aliases point to the same model — SDK always uses our configured model
env.ANTHROPIC_DEFAULT_SONNET_MODEL = model;
env.ANTHROPIC_DEFAULT_HAIKU_MODEL = model;
env.ANTHROPIC_DEFAULT_OPUS_MODEL = model;

// ─── Test 1: cwd + settingSources + basic query ─────────────────────

console.log('\n--- Test 1: cwd + settingSources: [project] ---');
console.log('Expectation: CLAUDE.md rules appear in agent behavior');

const results = { test1: false, test2: false, test3: false };

try {
  const q1 = query({
    prompt: 'Read the file hello.txt in the current directory and tell me what it says. Keep your response under 100 words.',
    options: {
      cwd: workspaceDir,
      model: 'sonnet', // Alias doesn't matter — all resolve to ANTHROPIC_MODEL via env
      settingSources: ['project'],
      permissionMode: 'default',
      allowedTools: ['Read', 'Bash', 'Glob', 'Grep'],
      maxTurns: 5,
      persistSession: false,
      env,
    },
  });

  let resultText = '';
  for await (const msg of q1) {
    if (msg.type === 'assistant') {
      const textBlocks = msg.message?.content?.filter(b => b.type === 'text') || [];
      for (const block of textBlocks) {
        resultText += block.text + '\n';
      }
    }
    if (msg.type === 'result') {
      if (msg.subtype === 'success') {
        resultText = msg.result || resultText;
        console.log(`Result: ${resultText.substring(0, 300)}`);

        // Check if CLAUDE.md rules were followed
        const hasMarker = resultText.includes('POC_MARKER_ACTIVE');
        const hasBlue = resultText.toLowerCase().includes('blue');
        const hasRuleCheck = resultText.includes('RULE_CHECK_OK');

        console.log(`  POC_MARKER_ACTIVE present: ${hasMarker}`);
        console.log(`  "blue" mentioned: ${hasBlue}`);
        console.log(`  RULE_CHECK_OK present: ${hasRuleCheck}`);

        // At least one marker means CLAUDE.md was loaded
        results.test1 = hasMarker || hasBlue || hasRuleCheck;
        console.log(`  TEST 1 PASS: ${results.test1} (CLAUDE.md/rules loaded)`);
      } else {
        console.log(`  ERROR: ${msg.subtype} - ${JSON.stringify(msg)}`);
      }
    }
  }
} catch (err) {
  console.log(`  FAILED: ${err.message}`);
}

// ─── Test 2: Sandbox write restriction ──────────────────────────────

console.log('\n--- Test 2: Sandbox filesystem.allowWrite ---');
console.log('Expectation: Agent can write inside workspace, cannot write outside');

try {
  const outsideDir = path.join(os.tmpdir(), `ctb-poc-outside-${randomUUID().slice(0, 8)}`);
  fs.mkdirSync(outsideDir, { recursive: true });

  const q2 = query({
    prompt: `Try to write a file called "test-write.txt" with content "sandbox test" to the current directory. Then try to write a file to ${outsideDir}/escaped.txt. Report what happened with each attempt.`,
    options: {
      cwd: workspaceDir,
      model: 'sonnet', // Alias doesn't matter — all resolve to ANTHROPIC_MODEL via env
      settingSources: ['project'],
      permissionMode: 'default',
      allowedTools: ['Read', 'Write', 'Bash'],
      maxTurns: 5,
      persistSession: false,
      env,
      sandbox: {
        enabled: true,
        autoAllowBashIfSandboxed: true,
        filesystem: {
          allowWrite: [workspaceDir],
        },
      },
    },
  });

  for await (const msg of q2) {
    if (msg.type === 'result') {
      if (msg.subtype === 'success') {
        const insideWritten = fs.existsSync(path.join(workspaceDir, 'test-write.txt'));
        const outsideWritten = fs.existsSync(path.join(outsideDir, 'escaped.txt'));

        console.log(`  File written inside workspace: ${insideWritten}`);
        console.log(`  File written outside workspace: ${outsideWritten}`);

        results.test2 = insideWritten && !outsideWritten;
        console.log(`  TEST 2 PASS: ${results.test2} (sandbox restricts writes)`);
      } else {
        console.log(`  Result: ${msg.subtype}`);
        // Sandbox may have blocked the outside write, causing an error — that's also a pass
        const insideWritten = fs.existsSync(path.join(workspaceDir, 'test-write.txt'));
        const outsideWritten = fs.existsSync(path.join(outsideDir, 'escaped.txt'));
        results.test2 = !outsideWritten;
        console.log(`  Inside: ${insideWritten}, Outside: ${outsideWritten}`);
        console.log(`  TEST 2 PASS: ${results.test2} (outside write blocked)`);
      }
    }
  }

  // Cleanup outside dir
  fs.rmSync(outsideDir, { recursive: true, force: true });
} catch (err) {
  console.log(`  FAILED: ${err.message}`);
}

// ─── Test 3: Structured output (outputFormat) ───────────────────────

console.log('\n--- Test 3: outputFormat with json_schema ---');
console.log('Expectation: Agent returns valid JSON matching schema');

try {
  const q3 = query({
    prompt: 'Analyze the workspace. List the files you can see and rate the workspace setup quality from 1 to 10.',
    options: {
      cwd: workspaceDir,
      model: 'sonnet', // Alias doesn't matter — all resolve to ANTHROPIC_MODEL via env
      settingSources: ['project'],
      allowedTools: ['Read', 'Glob', 'Grep'],
      maxTurns: 5,
      persistSession: false,
      env,
      outputFormat: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            files: {
              type: 'array',
              items: { type: 'string' },
            },
            qualityScore: {
              type: 'number',
            },
            summary: {
              type: 'string',
            },
          },
          required: ['files', 'qualityScore', 'summary'],
        },
      },
    },
  });

  for await (const msg of q3) {
    if (msg.type === 'result') {
      if (msg.subtype === 'success' && msg.result) {
        try {
          const parsed = JSON.parse(msg.result);
          const hasFiles = Array.isArray(parsed.files);
          const hasScore = typeof parsed.qualityScore === 'number';
          const hasSummary = typeof parsed.summary === 'string';

          console.log(`  Parsed JSON: ${JSON.stringify(parsed).substring(0, 300)}`);
          console.log(`  files is array: ${hasFiles}`);
          console.log(`  qualityScore is number: ${hasScore}`);
          console.log(`  summary is string: ${hasSummary}`);

          results.test3 = hasFiles && hasScore && hasSummary;
          console.log(`  TEST 3 PASS: ${results.test3} (structured output works)`);
        } catch (parseErr) {
          console.log(`  JSON parse error: ${parseErr.message}`);
          console.log(`  Raw result: ${msg.result?.substring(0, 200)}`);
        }
      } else {
        console.log(`  Result: ${msg.subtype} - ${msg.result?.substring(0, 200)}`);
      }
    }
  }
} catch (err) {
  console.log(`  FAILED: ${err.message}`);
}

// ─── Summary ────────────────────────────────────────────────────────

console.log('\n=== POC Validation Summary ===');
console.log(`Test 1 (cwd + settingSources loads CLAUDE.md): ${results.test1 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 2 (sandbox restricts writes):             ${results.test2 ? 'PASS ✓' : 'FAIL ✗'}`);
console.log(`Test 3 (outputFormat structured output):       ${results.test3 ? 'PASS ✓' : 'FAIL ✗'}`);

const allPass = results.test1 && results.test2 && results.test3;
console.log(`\nOverall: ${allPass ? 'ALL TESTS PASSED — proceed to Phase 1' : 'SOME TESTS FAILED — investigate before proceeding'}`);

// ─── Cleanup ────────────────────────────────────────────────────────

fs.rmSync(workspaceDir, { recursive: true, force: true });
console.log(`Workspace cleaned up: ${workspaceDir}`);

process.exit(allPass ? 0 : 1);
