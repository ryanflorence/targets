import { createContext, provide, pull } from "@ryanflorence/async-provider";

let targets = new Map();

type TargetId = string;
type TargetsContext = Map<TargetId, Array<any>>;
type Target<T extends any[], U> = (...args: T) => Promise<U>;

let context = createContext<TargetsContext>();

export function runWithTargets<U>(fn: () => Promise<U>): Promise<U> {
  return provide([[context, new Map()]], fn);
}

export async function registerTarget<T extends any[], U>(
  id: string,
  target: Target<T, U>,
): Promise<Target<T, U>> {
  let wrapper = wrapTarget(id, target);
  targets.set(id, wrapper);
  return wrapper;
}

function wrapTarget<T extends any[], U>(
  targetId: string,
  target: Target<T, U>,
): Target<T, U> {
  return async function (...args: T) {
    let targetsMap = pull(context);
    let instancesParams = targetsMap.get(targetId) || [];
    instancesParams.push(args);
    targetsMap.set(targetId, instancesParams);
    return target(...args);
  };
}
export function getTarget(id: string) {
  return targets.get(id);
}

// TODO: allow for custom serialization
export function serializeTargetCalls() {
  let targetsContext = pull(context);
  let serialized = Object.fromEntries(targetsContext);
  return JSON.stringify(serialized);
}

type RevalidationPayload = Array<[TargetId, any[]]>;

// TODO: allow for custom parsing
export function parseRevalidationPayload(payload: string): RevalidationPayload {
  return JSON.parse(payload);
}
