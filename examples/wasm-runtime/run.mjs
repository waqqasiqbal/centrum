import { readFile } from "node:fs/promises";

const artifact = JSON.parse(await readFile(new URL("./artifact.json", import.meta.url), "utf8"));
const { instance } = await WebAssembly.instantiate(Buffer.from(artifact.moduleBase64, "base64"));
const transform = instance.exports[artifact.entrypoint];
const rows = [{ id: "p-1", stock: 3 }, { id: "p-2", stock: 7 }];
const result = rows.map((row) => ({ ...row, [artifact.outputField]: transform(row[artifact.inputField]) }));
console.log(JSON.stringify(result, null, 2));

