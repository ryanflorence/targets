import { register } from "node:module";

register("./loader.js", { parentURL: import.meta.url });
