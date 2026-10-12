const assert = require('node:assert/strict');
const ts = require('typescript');
const vm = require('node:vm');
const fs = require('node:fs');
const output = ts.transpileModule(fs.readFileSync('lib/box/boxClient.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
let responses = [], calls = [];
const exportsObject = {};
vm.runInNewContext(output, {
  exports: exportsObject, Response, URL, AbortSignal, setTimeout: callback => callback(),
  require: name => name === 'server-only' ? {} : { getBoxAccessToken: async () => 'test-token' },
  fetch: async (url, options) => { calls.push({ url: String(url), options }); assert.ok(responses.length, 'Unexpected fetch'); return responses.shift(); },
});
(async () => {
  responses = [new Response(null, { status: 202, headers: { 'retry-after': '1' } }), new Response(null, { status: 302, headers: { location: 'https://dl.boxcloud.com/test' } }), new Response('%PDF-test')];
  assert.equal(await (await exportsObject.downloadBoxPdf('123', '456')).text(), '%PDF-test');
  assert.equal(calls.length, 3);
  assert.ok(calls[0].url.endsWith('?version=456'));
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-token');
  assert.equal(calls[2].options.headers, undefined, 'No bearer token sent to CDN');
  responses = [new Response(JSON.stringify({ code: 'access_denied_insufficient_permissions' }), { status: 403 })];
  await assert.rejects(() => exportsObject.downloadBoxPdf('123', '456'), error => error.status === 403 && error.message.includes('access_denied_insufficient_permissions'));
  responses = [new Response(null, { status: 302, headers: { location: 'https://example.com/test' } })];
  await assert.rejects(() => exportsObject.downloadBoxPdf('123', '456'), error => error.code === 'invalid_location');
  responses = Array.from({ length: 4 }, () => new Response(null, { status: 202 }));
  await assert.rejects(() => exportsObject.downloadBoxPdf('123', '456'), error => error.code === 'retry_later');
  console.log('DHR download: delayed readiness, redirect, credential isolation, permissions, invalid URL and retry limit verified.');
})();
