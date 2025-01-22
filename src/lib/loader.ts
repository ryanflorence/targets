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
  url: URL,
  context: LoadContext,
  defaultLoad: (url: URL, context: LoadContext) => Promise<LoadResult>,
): Promise<LoadResult> {
  const result = await defaultLoad(url, context);

  if (
    !url.href.endsWith(".js") &&
    !url.href.endsWith(".jsx") &&
    !url.href.endsWith(".ts") &&
    !url.href.endsWith(".tsx")
  ) {
    return result;
  }

  if (!result.source) {
    return result;
  }

  const source = result.source.toString().trim();
  if (
    !source.startsWith("'use target'") &&
    !source.startsWith('"use target"')
  ) {
    return result;
  }

  const matches = source.matchAll(
    /export( async)? function (\w+)(\([^)]*\)[\s\S]*?\})/g,
  );
  const transformedFunctions = [];

  for (const [fullMatch, isAsync, name, functionBody] of matches) {
    const asyncStr = isAsync ? "async " : "";
    const fileName = JSON.stringify(url.href);
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
    `import { registerTarget } from "@remix/targets";`,
  );

  // Replace each function declaration with its transformed version
  for (const { original, transformed } of transformedFunctions) {
    newCode = newCode.replace(original, transformed);
  }

  return {
    ...result,
    source: newCode,
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
