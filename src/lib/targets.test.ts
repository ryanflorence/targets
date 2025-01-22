import { test } from "node:test";
import assert from "node:assert";
import {
  getTarget,
  parseRevalidationPayload,
  registerTarget,
  runWithTargets,
  serializeTargetCalls,
} from "./targets.ts";

test("basic render + serialize + revalidate flow", async t => {
  ////////////////////////////////////////////////////////////////////////////////
  // App initialization

  // 1. Define targets
  async function Target1({ food }: { food: string }) {
    return `Tons of ${food}`;
  }

  async function Target2({ servings }: { servings: number }) {
    return Array.from({ length: servings }, () => "Nutty Pudding").join("! ");
  }

  // 2. Import loader will register the targets, but we do it manually for the test
  let t1 = await registerTarget("target1", Target1);
  let t2 = await registerTarget("target2", Target2);

  ////////////////////////////////////////////////////////////////////////////////
  // Initial render request

  // 1. Render the app in a targets context
  let { targetsPayload } = await runWithTargets(async () => {
    let content = `
      <div>
        ${await t1({ food: "Tons of Broccoli" })}
        ${await t1({ food: "Tons of Cauliflower" })}
        ${await t2({ servings: 3 })}
      </div>
    `;

    let targetsPayload = serializeTargetCalls();

    // 2. Include the payload in the response. It's up to the renderer how to do
    // this, will likely inject at the end with out of order streaming, but
    // here's a simple example w/o streaming
    let document = `
      <html>
        <body>
          ${content}
          <script>
            window.__TARGETS_PAYLOAD__ = ${JSON.stringify(targetsPayload)}
          </script>
        </body>
      </html>`;
    return { document, targetsPayload };
  });

  // parse and assert for this test
  let calls = JSON.parse(targetsPayload);
  assert.deepEqual(calls, {
    target1: [
      [{ food: "Tons of Broccoli" }],
      [{ food: "Tons of Cauliflower" }],
    ],
    target2: [[{ servings: 3 }]],
  });

  ////////////////////////////////////////////////////////////////////////////////
  // Client revalidation

  // 1. Client sends a revalidation payload using the embedded payload. The
  // client renderer implements its own APIs to define what to revalidate.
  let revalidationPayload = JSON.stringify([
    ["target1", [{ food: "Broccoli" }]],
    ["target2", [{ servings: 1 }]],
  ]);

  // 2. Renderer parses the payload
  let revalidations = parseRevalidationPayload(revalidationPayload);

  // 3. Render the requested targets w/ their params from the payload
  let revalidationResponse = await runWithTargets(async () => {
    let results = await Promise.all(
      revalidations.map(([targetId, params]) => {
        let target = getTarget(targetId);
        return target(...params);
      }),
    );
    return {
      results,
      targetsPayload: serializeTargetCalls(),
    };
  });

  assert.equal(revalidationResponse.results[0], "Tons of Broccoli");
  assert.equal(revalidationResponse.results[1], "Nutty Pudding");

  // 4. Client renderer replaces the content on the page with the new content
});
