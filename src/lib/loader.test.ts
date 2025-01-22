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
import { registerTarget } from "@remix/targets";;
export const MyTarget = registerTarget("da1ca634c3f1991b39af0c738e1f96cd61ad05a9", function MyTarget({ foo }) {
  return "hello" + foo;
})
export const MyOtherTarget = registerTarget("b66914bb3d9ffd85cb8d0b50e93cf42a434b06ac", async function MyOtherTarget() {
  return "world";
})
`;

  const result = await load(
    new URL("test.js", import.meta.url),
    { conditions: ["test"] },
    async () => ({ source, format: "module" }),
  );

  assert.equal(result?.source?.toString().trim(), expected.trim());
});
