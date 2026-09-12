// Provider-readiness tests A–K (shared OpenAI-compatible client + honest factory behaviour).
// No network and no keys are used: fetch is injected and failures are simulated.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chatCompletion, normalizeBaseUrl, chatEndpoint, resolveModel, redact, STATUS, DEFAULT_BASE_URL } from "../lib/provider-client.mjs";
import { enrichContent } from "../harness/copywriter.mjs";
import { PROVIDERS } from "../harness/writing-critic.mjs";

const okFetch = (contentObj, sink = []) => async (url, opts) => {
  sink.push(url);
  return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(contentObj) } }] }) };
};
const urlOnly = (sink) => async (url) => { sink.push(url); return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "{}" } }] }) }; };
const P0 = { identity: { name: "Test System", one_line_promise: "A test promise.", subtitle: "Test subtitle" }, customer: {} };

test("A. a configured base URL is actually used", async () => {
  const calls = [];
  const env = { OPENAI_API_KEY: "testkey-abcdefghijklmnop", OPENAI_BASE_URL: "https://gateway.example.com/openai/v1" };
  const r = await chatCompletion({ worker: "copywriter", messages: [], jsonMode: true, env, fetchImpl: urlOnly(calls) });
  assert.equal(calls[0], "https://gateway.example.com/openai/v1/chat/completions");
  assert.equal(r.endpoint_host, "gateway.example.com");
  assert.equal(r.status, STATUS.PROVIDER_SUCCESS);
});

test("B. official/default OpenAI configuration still works structurally", async () => {
  const calls = [];
  const env = { OPENAI_API_KEY: "testkey-abcdefghijklmnop" };
  const r = await chatCompletion({ worker: "copywriter", messages: [], jsonMode: true, env, fetchImpl: urlOnly(calls) });
  assert.equal(calls[0], `${DEFAULT_BASE_URL}/chat/completions`);
  assert.equal(r.endpoint_host, "api.openai.com");
});

test("C. malformed/misconfigured endpoint fails honestly and URL normalization is safe", async () => {
  assert.equal(normalizeBaseUrl("https://h.example/v1/v1/"), "https://h.example/v1");
  assert.equal(chatEndpoint("https://h.example/v1/chat/completions"), "https://h.example/v1/chat/completions");
  assert.equal(chatEndpoint("https://h.example"), "https://h.example/v1/chat/completions");
  const boom = async () => { throw new Error("ENOTFOUND bad host"); };
  const r = await chatCompletion({ messages: [], env: { OPENAI_API_KEY: "testkey-abcdefghijklmnop", OPENAI_BASE_URL: "not-a-url" }, fetchImpl: boom });
  assert.equal(r.ok, false);
  assert.equal(r.status, STATUS.PROVIDER_ATTEMPT_FAILED);
});

test("D. COPYWRITER_MODEL and WRITING_CRITIC_MODEL can differ", () => {
  const env = { OPENAI_MODEL: "shared-model", COPYWRITER_MODEL: "copy-model-x", WRITING_CRITIC_MODEL: "critic-model-y" };
  assert.equal(resolveModel("copywriter", env), "copy-model-x");
  assert.equal(resolveModel("writing-critic", env), "critic-model-y");
  assert.notEqual(resolveModel("copywriter", env), resolveModel("writing-critic", env));
  assert.equal(resolveModel("copywriter", { OPENAI_MODEL: "shared-model" }), "shared-model");
  assert.equal(resolveModel("mae-generation", { MAE_GENERATION_MODEL: "gen-z" }), "gen-z");
  assert.equal(resolveModel("mae-critic", { MAE_CRITIC_MODEL: "crit-z" }), "crit-z");
});

test("E. generator and critic remain independent", async () => {
  const env = { COPYWRITER_PROVIDER: "openai", OPENAI_API_KEY: "testkey-abcdefghijklmnop", OPENAI_BASE_URL: "https://gw.example/v1", COPYWRITER_MODEL: "copy-model-x" };
  const r = await enrichContent("faq.json", { items: [] }, P0, {}, [], ".", { env, fetchImpl: okFetch({ enriched: true }) });
  assert.equal(r.meta.actual_generator, "openai");
  // Critic uses a different worker config and its own (absent) key context → NOT_RUN, independent.
  const crit = await PROVIDERS.openai.critique({}, { WRITING_CRITIC_PROVIDER: "openai", WRITING_CRITIC_MODEL: "critic-model-y" });
  assert.equal(crit.ran, false);
  assert.equal(crit.status, "NOT_RUN");
  assert.equal(crit.model, "critic-model-y");
});

test("F. missing provider credentials cannot produce fake provider success", async () => {
  const r = await chatCompletion({ worker: "copywriter", messages: [], env: { OPENAI_API_KEY: "" } });
  assert.equal(r.ok, false);
  assert.equal(r.status, STATUS.PROVIDER_NOT_CONFIGURED);
  const env = { COPYWRITER_PROVIDER: "openai" }; // no key
  const e = await enrichContent("faq.json", { items: [] }, P0, {}, [], ".", { env });
  assert.equal(e.meta.actual_generator, "deterministic");
  assert.equal(e.meta.fallback_used, true);
  assert.equal(e.meta.provider_attempt_status, STATUS.PROVIDER_NOT_CONFIGURED);
});

test("G. provider HTTP failure is recorded", async () => {
  const fail = async () => ({ ok: false, status: 503, json: async () => ({}) });
  const r = await chatCompletion({ messages: [], env: { OPENAI_API_KEY: "testkey-abcdefghijklmnop" }, fetchImpl: fail });
  assert.equal(r.status, STATUS.PROVIDER_ATTEMPT_FAILED);
  assert.equal(r.http_status, 503);
  assert.match(r.error, /503/);
});

test("H. invalid provider response is recorded", async () => {
  const noChoices = async () => ({ ok: true, status: 200, json: async () => ({ usage: {} }) });
  const r1 = await chatCompletion({ messages: [], env: { OPENAI_API_KEY: "testkey-abcdefghijklmnop" }, fetchImpl: noChoices });
  assert.equal(r1.status, STATUS.PROVIDER_RESPONSE_INVALID);
  const notJson = async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "not json" } }] }) });
  const r2 = await chatCompletion({ messages: [], jsonMode: true, env: { OPENAI_API_KEY: "testkey-abcdefghijklmnop" }, fetchImpl: notJson });
  assert.equal(r2.status, STATUS.PROVIDER_RESPONSE_INVALID);
});

test("I. deterministic fallback, if used, is explicitly labelled as fallback", async () => {
  const boom = async () => { throw new Error("network down"); };
  const env = { COPYWRITER_PROVIDER: "openai", OPENAI_API_KEY: "testkey-abcdefghijklmnop" };
  const r = await enrichContent("faq.json", { items: [] }, P0, {}, [], ".", { env, fetchImpl: boom });
  assert.equal(r.meta.requested_provider, "openai");
  assert.equal(r.meta.fallback_used, true);
  assert.equal(r.meta.provider_attempt_status, STATUS.PROVIDER_ATTEMPT_FAILED);
  assert.equal(r.meta.actual_generator, "deterministic");
  // deterministic was actually used
  assert.deepEqual(r.content.items, []);
});

test("J. actual_generator records what really generated the content", async () => {
  const envOk = { COPYWRITER_PROVIDER: "openai", OPENAI_API_KEY: "testkey-abcdefghijklmnop" };
  const ok = await enrichContent("faq.json", { items: [] }, P0, {}, [], ".", { env: envOk, fetchImpl: okFetch({ enriched: true }) });
  assert.equal(ok.meta.actual_generator, "openai");
  assert.equal(ok.content.enriched, true);
  const envDown = { COPYWRITER_PROVIDER: "openai", OPENAI_API_KEY: "testkey-abcdefghijklmnop" };
  const down = await enrichContent("faq.json", { items: [] }, P0, {}, [], ".", { env: envDown, fetchImpl: async () => { throw new Error("down"); } });
  assert.equal(down.meta.actual_generator, "deterministic");
  // requested external model must never be reported as the actual generator
  assert.notEqual(down.meta.actual_generator, envDown.COPYWRITER_MODEL || "openai");
});

test("K. no API key appears in generated records or logged errors", async () => {
  const key = "testkey-SECRET-1234567890abcdef";
  const leak = async () => { throw new Error(`auth failed for ${key}`); };
  const env = { COPYWRITER_PROVIDER: "openai", OPENAI_API_KEY: key };
  const r = await enrichContent("faq.json", { items: [] }, P0, {}, [], ".", { env, fetchImpl: leak });
  const serialized = JSON.stringify(r.meta);
  assert.equal(serialized.includes(key), false);
  assert.equal(redact(`Bearer ${key}`, env).includes(key), false);
  const c = await chatCompletion({ messages: [], env, fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({}) }) });
  assert.equal(JSON.stringify(c).includes(key), false);
});
