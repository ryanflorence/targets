import fs from "node:fs/promises";
import path from "node:path";
import { createServer } from "node:http";
import { createRequestListener } from "@mjackson/node-fetch-server";
import { Header } from "./modules/components.ts";
import {
  getTarget,
  type RevalidationPayload,
  runWithTargets,
  serializeTargetCalls,
} from "../src/lib/targets.ts";
import { setUserName } from "./modules/data.ts";

createServer(
  createRequestListener(async request => {
    if (request.method === "POST") {
      return handleFormSubmission(request);
    }

    if (request.url.endsWith(".js")) {
      return handleClientJSFile(request);
    }

    return runWithTargets(async () => {
      let markup = await renderDocument();
      let targets = serializeTargetCalls();
      markup = markup.replace(
        `</body>`,
        `<script>window.__TARGETS__ = new Map(${targets});</script></body>`,
      );
      return new Response(markup, {
        headers: { "Content-Type": "text/html" },
      });
    });
  }),
).listen(26163, () => {
  console.log("Server listening on http://localhost:26163");
});

////////////////////////////////////////////////////////////////////////////////
let html = String.raw;

async function renderDocument() {
  return html`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Targets Example</title>
        <script type="module" src="/app.js"></script>
      </head>
      <body>
        ${await Header({ name: "header", title: "Targets Example" })}
        <form method="post" id="the-form">
          <input type="text" name="name" />
          <button type="submit">Submit</button>
        </form>
      </body>
    </html>
  `;
}

async function handleClientJSFile(request: Request) {
  let fileName = request.url.split("/").pop() as string;
  let localPath = path.join(import.meta.dirname, "public", fileName);
  let file = await fs.readFile(localPath, "utf-8");
  return new Response(file, {
    headers: { "Content-Type": "application/javascript" },
  });
}

async function handleFormSubmission(request: Request) {
  // change some data
  let formData = await request.formData();
  let name = formData.get("name") as string;
  await setUserName(name);

  // get requested target revalidations
  let revalidations = JSON.parse(
    request.headers.get("X-Revalidate")!,
  ) as RevalidationPayload;

  // render the targets
  let payload = await runWithTargets(async () => {
    let content = await Promise.all(
      revalidations.map(([targetId, props]) => {
        let target = getTarget(targetId);
        return target(props);
      }),
    );
    return {
      content,
      targets: serializeTargetCalls(),
    };
  });

  return new Response(JSON.stringify(payload));
}
