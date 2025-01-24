interface LoadContext {
  conditions: string[];
  format?: string;
  importAttributes?: Record<string, unknown>;
}

interface LoadResult {
  format: string;
  shortCircuit?: boolean;
  source?: string | ArrayBuffer | SharedArrayBuffer | Uint8Array;
}

export async function load(
  url: string,
  context: LoadContext,
  defaultLoad: (url: string, context: LoadContext) => Promise<LoadResult>,
): Promise<LoadResult> {
  // console.log("PROCESSING:", url);
  const result = await defaultLoad(url, context);
  // console.log("Source type:", typeof result.source);
  // console.log("Source instanceof:", result.source instanceof Uint8Array);

  if (
    !url.endsWith(".js") &&
    !url.endsWith(".jsx") &&
    !url.endsWith(".ts") &&
    !url.endsWith(".tsx")
  ) {
    // console.log("Returning early", url);
    return result;
  }

  if (!result.source) {
    return result;
  }

  const source = (
    result.source instanceof Uint8Array
      ? new TextDecoder().decode(result.source)
      : result.source.toString()
  ).trim();

  if (
    !source.startsWith("'use target'") &&
    !source.startsWith('"use target"')
  ) {
    // console.log("Returning early not a target", url);
    return result;
  }

  const matches = source.matchAll(
    /export( async)? function (\w+)(\([^)]*\)(?:\s*{((?:[^{}]|{(?:[^{}]|{[^{}]*})*})*})))/g,
  );
  const transformedFunctions = [];

  for (const [fullMatch, isAsync, name, functionBody] of matches) {
    // console.log("functionBody:", functionBody);
    const asyncStr = isAsync ? "async " : "";
    const fileName = JSON.stringify(url);
    const targetName = JSON.stringify(name);
    const id = await makeId(fileName, targetName);

    transformedFunctions.push({
      original: fullMatch,
      transformed: `export const ${name} = registerTarget(${JSON.stringify(
        id,
      )}, ${asyncStr}function ${name}${functionBody})`,
    });
  }

  let newCode = source.replace(
    /^['"]use target['"]/,
    `import { registerTarget } from "../../src/lib/targets.ts"`,
  );

  // Replace each function declaration with its transformed version
  for (const { original, transformed } of transformedFunctions) {
    newCode = newCode.replace(original, transformed);
  }

  let buffer = new TextEncoder().encode(newCode + "\n\n");

  // console.log("FINAL CODE:", url);
  // console.log(newCode);

  return {
    ...result,
    source: buffer,
  };
}

export async function makeId(fileName: string, targetName: string) {
  const hash = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(`${fileName}:${targetName}`),
  );
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}
