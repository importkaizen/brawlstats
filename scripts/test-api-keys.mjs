import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function compile(name) {
  const source = readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), "utf8");
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
}
const tagExports = {};
runInNewContext(compile("tag"), { exports: tagExports });
const clientSource = compile("brawlstars");
const tag = "#2YYYGQQY02";
const player = { tag, rankedElo: 5474 };
const ok = () => Response.json(player);
const rejection = () => Response.json({ reason: "accessDenied.invalidIp", message: "Invalid IP" }, { status: 403 });

function client(env, respond) {
  const exports = {};
  const calls = [];
  runInNewContext(clientSource, {
    exports,
    process: { env },
    URL, Headers,
    require: (name) => {
      assert.equal(name, "./tag");
      return tagExports;
    },
    fetch: async (url, init) => {
      const authorization = init.headers.get("Authorization");
      calls.push(authorization);
      assert.equal(url, "https://api.brawlstars.com/v1/players/%232YYYGQQY02");
      assert.equal(init.cache, "no-store");
      return respond(authorization);
    },
  });
  return { ...exports, calls };
}
const both = { BRAWLSTARS_API_KEY: "first-test-key", BRAWLSTARS_API_KEY_BACKUP: "second-test-key" };
let accepted = "Bearer second-test-key";
const fallback = client(both, (authorization) => authorization === accepted ? ok() : rejection());
assert.equal(fallback.hasApiKey(), true);
assert.deepEqual(await fallback.fetchPlayer(tag), player);
assert.deepEqual(fallback.calls, ["Bearer first-test-key", "Bearer second-test-key"], "Try the backup after an IP rejection");
fallback.calls.length = 0;
await fallback.fetchPlayer(tag);
assert.deepEqual(fallback.calls, ["Bearer second-test-key"], "Remember the successful key");
accepted = "Bearer first-test-key";
fallback.calls.length = 0;
await fallback.fetchPlayer(tag);
assert.deepEqual(fallback.calls, ["Bearer second-test-key", "Bearer first-test-key"], "Switch back when the outbound IP changes again");

const unauthorized = client(both, (authorization) => authorization === "Bearer first-test-key"
  ? Response.json({ reason: "unauthorized" }, { status: 401 }) : ok());
await unauthorized.fetchPlayer(tag);
assert.equal(unauthorized.calls.length, 2);

for (const status of [404, 429, 500]) {
  const failed = client(both, () => Response.json({ reason: "testFailure" }, { status }));
  await assert.rejects(failed.fetchPlayer(tag), (err) => err instanceof failed.BrawlApiError && err.status === status);
  assert.equal(failed.calls.length, 1, "Do not rotate keys for missing players, rate limits, or service failures");
}
const denied = client(both, rejection);
await assert.rejects(denied.fetchPlayer(tag), (err) => err instanceof denied.BrawlApiError && err.status === 403 && err.reason === "accessDenied.invalidIp");
assert.equal(denied.calls.length, 2);
const single = client({ BRAWLSTARS_API_KEY: "first-test-key" }, ok);
await single.fetchPlayer(tag);
assert.equal(single.calls.length, 1);
const onlyBackup = client({ BRAWLSTARS_API_KEY_BACKUP: "second-test-key" }, ok);
assert.equal(onlyBackup.hasApiKey(), true);
await onlyBackup.fetchPlayer(tag);
assert.deepEqual(onlyBackup.calls, ["Bearer second-test-key"]);
const duplicate = client({ BRAWLSTARS_API_KEY: " first-test-key ", BRAWLSTARS_API_KEY_BACKUP: "first-test-key" }, rejection);
await assert.rejects(duplicate.fetchPlayer(tag));
assert.equal(duplicate.calls.length, 1, "Trim and deduplicate configured keys");
const empty = client({ BRAWLSTARS_API_KEY: " " }, ok);
assert.equal(empty.hasApiKey(), false);
await assert.rejects(empty.fetchPlayer(tag), empty.MissingApiKeyError);
assert.equal(empty.calls.length, 0);
const network = client(both, () => { throw new Error("Offline"); });
await assert.rejects(network.fetchPlayer(tag), (err) => err instanceof network.BrawlApiError && err.status === 0);
assert.equal(network.calls.length, 1);
console.log("API key checks passed: fallback, preferred key, IP changes, single key, duplicate keys, and error handling.");
