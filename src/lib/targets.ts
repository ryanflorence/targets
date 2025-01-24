import { createContext, provide, pull } from "@ryanflorence/async-provider";

let targets = new Map();

type TargetTypeId = string;
type TargetName = string;
type TargetsContext = Map<TargetName, [TargetTypeId, TargetProps]>;
export type TargetProps = Record<string, any> & { name: string };
type Target<T extends TargetProps> = (props: T) => Promise<string>;

let context = createContext<TargetsContext>();

export function runWithTargets<U>(fn: () => Promise<U>): Promise<U> {
  return provide([[context, new Map()]], fn);
}

export function registerTarget<T extends TargetProps>(
  id: string,
  target: Target<T>,
) {
  let wrapper = wrapTarget(id, target);
  targets.set(id, wrapper);
  return wrapper;
}

function wrapTarget<T extends TargetProps>(
  targetTypeId: string,
  target: Target<T>,
) {
  return async function (props: T) {
    let name = props.name;
    let renderedTargets = pull(context);
    if (renderedTargets.has(name)) {
      throw new Error("Target name already exists: " + name);
    }
    renderedTargets.set(name, [targetTypeId, props]);
    let content = await target(props);
    return `<x-target type="${targetTypeId}" name="${name}">${content}</x-target>`;
  };
}

export function getTarget(targetTypeId: string) {
  return targets.get(targetTypeId);
}

export function serializeTargetCalls() {
  let targetsContext = pull(context);
  let serialized = Array.from(targetsContext.entries());
  return JSON.stringify(serialized);
}

export type RevalidationPayload = Array<[TargetTypeId, TargetProps]>;

export function parseRevalidationPayload(payload: string): RevalidationPayload {
  return JSON.parse(payload);
}
