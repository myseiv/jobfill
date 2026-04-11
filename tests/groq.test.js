import { test } from 'node:test';
import assert from 'node:assert/strict';

// Mock fetch before import
globalThis.fetch = async (url, options) => {
  const body = JSON.parse(options.body);
  // Verify the request shape
  assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.ok(options.headers['Authorization'].startsWith('Bearer '));
  assert.ok(body.messages.length === 2);
  return {
    ok: true,
    json: async () => ({
      choices: [{ message: { content: '  Generated answer.  ' } }],
    }),
  };
};

const { generateAnswer } = await import('../shared/groq.js');

test('generateAnswer returns trimmed content from API', async () => {
  const answer = await generateAnswer({
    apiKey: 'test-key',
    model: 'llama3-8b-8192',
    fieldLabel: 'Why do you want this role?',
    jdText: 'We build developer tools.',
    profileChunk: 'I have 3 years of JS experience.',
  });
  assert.equal(answer, 'Generated answer.');
});

test('generateAnswer throws on API error', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 401 });
  await assert.rejects(
    () => generateAnswer({ apiKey: 'bad', model: 'llama3-8b-8192', fieldLabel: 'test', jdText: '', profileChunk: '' }),
    /Groq API error: 401/
  );
});
