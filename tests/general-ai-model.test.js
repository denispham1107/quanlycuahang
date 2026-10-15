const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const server = fs.readFileSync('functions/index.js', 'utf8');
function harness(env = {}, respond = async () => ({ output_text: 'OK', usage: { output_tokens: 1 } })) {
  const calls = [];
  const context = {
    process: { env }, OPENAI_API_KEY: { value: () => 'FAKE_QA_KEY' },
    GENERAL_SYSTEM_PROMPT: 'QA general instructions', isModerationFlagged: async () => false,
    getOutputText: response => response.output_text, logger: { warn: () => {} },
    OpenAI: class { constructor(options) { assert.equal(options.apiKey, 'FAKE_QA_KEY'); this.responses = { create: async request => { calls.push(request); return respond(request, calls.length); } }; } }
  };
  vm.createContext(context);
  vm.runInContext(server.match(/^const OPENAI_(?:MODEL|FALLBACK_MODEL|GENERAL_MODEL) = .*;$/gm).join('\n'), context);
  vm.runInContext(server.slice(server.indexOf('function buildGeneralInput('), server.indexOf('async function isModerationFlagged(')), context);
  vm.runInContext(server.slice(server.indexOf('async function callGeneralOpenAI('), server.indexOf('async function handleGeneralChatRequest(')), context);
  return { context, calls, send: options => context.callGeneralOpenAI({ message: 'Xin chào QA', history: [], attachments: [], useWebSearch: false, ...options }) };
}
test('general chat defaults to chat-latest without changing the store-report model or fallback', async () => {
  const h = harness(), result = await h.send();
  assert.equal(result.model, 'chat-latest'); assert.equal(h.calls[0].model, 'chat-latest');
  assert.equal(vm.runInContext('OPENAI_MODEL', h.context), 'gpt-5.4-mini');
  assert.equal(vm.runInContext('OPENAI_FALLBACK_MODEL', h.context), 'gpt-5.4-mini');
  assert.equal(h.calls[0].max_output_tokens, 1200); assert.equal(h.calls[0].instructions, 'QA general instructions');
  assert.equal(h.calls[0].temperature, undefined); assert.equal(h.calls[0].reasoning, undefined);
});
test('store-model environment overrides do not silently override the selected general-chat alias', async () => {
  const h = harness({ OPENAI_MODEL: 'store-model-qa', OPENAI_FALLBACK_MODEL: 'store-fallback-qa' });
  assert.equal((await h.send()).model, 'chat-latest');
  assert.equal(vm.runInContext('OPENAI_MODEL', h.context), 'store-model-qa');
  assert.equal(vm.runInContext('OPENAI_FALLBACK_MODEL', h.context), 'store-fallback-qa');
  const custom = harness({ OPENAI_GENERAL_MODEL: 'general-model-qa', OPENAI_MAX_OUTPUT_TOKENS: '1600' });
  assert.equal((await custom.send()).model, 'general-model-qa'); assert.equal(custom.calls[0].max_output_tokens, 1600);
});
test('web-search retry keeps chat-latest and preserves the full input rather than falling back to an older model', async () => {
  const h = harness({}, async (request, count) => { if (count === 1) throw Object.assign(new Error('QA search failure'), { status: 503 }); return { output_text: 'OK' }; });
  const text = JSON.stringify({ stores: [{ closingBookReport: { sentinel: 'x'.repeat(180000) } }] });
  const result = await h.send({ useWebSearch: true, attachments: [{ name: 'QA.json', kind: 'json', text, truncated: false }] });
  assert.equal(h.calls.length, 2); assert.equal(result.usedWebSearch, false);
  assert.equal(h.calls[0].model, 'chat-latest'); assert.equal(h.calls[1].model, 'chat-latest');
  assert.equal(h.calls[0].tools[0].type, 'web_search_preview'); assert.equal(h.calls[1].tools, undefined);
  assert.deepEqual(h.calls[1].input, h.calls[0].input); assert.ok(h.calls[1].input[0].content.includes(text));
});
test('general model errors remain visible; no silent older-model fallback is introduced', async () => {
  const error = Object.assign(new Error('QA model unavailable'), { status: 404 });
  const h = harness({}, async () => { throw error; });
  await assert.rejects(() => h.send(), item => item === error); assert.equal(h.calls.length, 1);
});
test('both general entry points share the selected model, with existing moderation and role guards unchanged', async () => {
  const h = harness(); h.context.isModerationFlagged = async () => true;
  assert.equal((await h.send()).model, null); assert.equal(h.calls.length, 0);
  const general = server.slice(server.indexOf('exports.chatGeneralAI ='), server.indexOf('exports.chatWithAI ='));
  const shared = server.slice(server.indexOf('exports.chatWithAI ='));
  assert.match(general, /await handleGeneralChatRequest\(req, res\)/);
  assert.match(shared, /if \(req.body\?\.mode === "general"\)[\s\S]*?return await handleGeneralChatRequest\(req, res\)/);
  const handler = server.slice(server.indexOf('async function handleGeneralChatRequest('), server.indexOf('async function getEmployeeManagementStores('));
  assert.match(handler, /await callGeneralOpenAI\(/); assert.match(handler, /!hasCompleteExport && shouldUseWebSearch/);
  assert.match(handler, /await requireUserProfile\(req, "admin"\)/);
  assert.match(server, /const primaryModel = OPENAI_MODEL;/);
});
