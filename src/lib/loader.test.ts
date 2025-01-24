import { test } from "node:test";
import assert from "node:assert";
import { load } from "./loader.ts";

test("transforms target modules", async () => {
  let source = `
"use target";
export function MyTarget({ foo }) {
  return "hello" + foo;
}
export async function MyOtherTarget() {
  return "world";
}
`;

  let expected = `
import { registerTarget } from "../../src/lib/targets.ts";
export const MyTarget = registerTarget("cd855d99617b11648826538f9178f24474274688", function MyTarget({ foo }) {
  return "hello" + foo;
})
export const MyOtherTarget = registerTarget("044bb5ee42a58a73227d15ce7d8823b833039257", async function MyOtherTarget() {
  return "world";
})
`;

  const result = await load("test.js", { conditions: ["test"] }, async () => ({
    source,
    format: "module",
  }));

  assert.ok(result);
  assert.ok(result.source);

  let string = new TextDecoder().decode(result.source as Uint8Array);
  assert.equal(string.trim(), expected.trim());
});
