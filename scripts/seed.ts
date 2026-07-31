import fs from "node:fs";
import path from "node:path";
import { CatalogDatabase, seedDemo } from "@ai-interfaces/catalog";

const databasePath = process.env.AI_DATABASE_PATH ?? ".data/ai-interfaces.db";
const database = new CatalogDatabase(databasePath);
const keys = seedDemo(database);
const keysPath = path.join(path.dirname(databasePath), "demo-keys.json");
fs.mkdirSync(path.dirname(keysPath), { recursive: true });
fs.writeFileSync(keysPath, JSON.stringify(keys, null, 2), { mode: 0o600 });
database.close();

console.log("Seeded two isolated tenants. Development keys (shown once):");
for (const key of keys) console.log(`  ${key.tenantName}: ${key.apiKey}`);
console.log(`Local playground key file: ${keysPath}`);
