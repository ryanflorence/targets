"use target";

import { getUserName } from "./data.ts";

export async function Header({ title }: { title: string; name: string }) {
  let name = await getUserName();
  return `
    <header>
      <h1>${title}</h1>
      <p>Hello, ${name}!</p>
    </header>
  `;
}
