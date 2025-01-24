import { register } from "node:module";

register("./loader.ts", { parentURL: import.meta.url });
