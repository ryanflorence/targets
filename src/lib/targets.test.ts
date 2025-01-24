import { test } from "node:test";
import assert from "node:assert";
import {
  getTarget,
  parseRevalidationPayload,
  registerTarget,
  runWithTargets,
  serializeTargetCalls,
  type TargetProps,
  type RevalidationPayload,
} from "./targets.ts";

test("basic render + serialize + revalidate flow", async t => {
  ////////////////////////////////////////////////////////////////////////////////
  // App initialization

  // 1. Define targets
  async function Target1({ food }: TargetProps) {
    return `<h1>Tons of ${food}</h1>`;
  }

  async function Target2({ servings }: TargetProps) {
    return Array.from(
      { length: servings },
      () => "<div>Nutty Pudding</div>",
    ).join("! ");
  }

  // 2. Import loader will register the targets, but we do it manually for the test
  let t1 = registerTarget("target-type-id-1", Target1);
  let t2 = registerTarget("target-type-id-2", Target2);

  ////////////////////////////////////////////////////////////////////////////////
  // Initial render request

  // 1. Render the app in a targets context
  let { targetsPayload } = await runWithTargets(async () => {
    let content = `
      <div>
        ${await t1({ name: "broccoli", food: "Tons of Broccoli" })}
        ${await t1({ name: "cauliflower", food: "Tons of Cauliflower" })}
        ${await t2({ name: "t2", servings: 3 })}
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
  assert.deepEqual(calls, [
    [
      "broccoli",
      ["target-type-id-1", { name: "broccoli", food: "Tons of Broccoli" }],
    ],
    [
      "cauliflower",
      [
        "target-type-id-1",
        { name: "cauliflower", food: "Tons of Cauliflower" },
      ],
    ],
    ["t2", ["target-type-id-2", { name: "t2", servings: 3 }]],
  ]);

  ////////////////////////////////////////////////////////////////////////////////
  // Client revalidation

  // 1. Client sends a revalidation payload using the embedded payload. The
  // client renderer implements its own APIs to define what to revalidate.
  let revalidationPayload = JSON.stringify([
    ["target-type-id-1", { name: "broccoli", food: "Broccoli" }],
    ["target-type-id-1", { name: "cauliflower", food: "Cauliflower" }],
    ["target-type-id-2", { name: "some-name", servings: 1 }],
  ] as RevalidationPayload);

  // 2. Renderer parses the payload
  let revalidations = parseRevalidationPayload(revalidationPayload);

  // 3. Render the requested targets w/ their params from the payload
  let revalidationResponse = await runWithTargets(async () => {
    let content = await Promise.all(
      revalidations.map(([targetId, props]) => {
        let target = getTarget(targetId);
        return target(props);
      }),
    );
    return {
      content,
      payload: serializeTargetCalls(),
    };
  });

  assert.equal(
    revalidationResponse.content[0],
    '<x-target type="target-type-id-1" name="broccoli"><h1>Tons of Broccoli</h1></x-target>',
  );
  assert.equal(
    revalidationResponse.content[1],
    '<x-target type="target-type-id-1" name="cauliflower"><h1>Tons of Cauliflower</h1></x-target>',
  );
  assert.equal(
    revalidationResponse.content[2],
    '<x-target type="target-type-id-2" name="some-name"><div>Nutty Pudding</div></x-target>',
  );

  // 4. Client renderer replaces the content on the page with the new content
});
