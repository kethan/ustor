import { readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const directory = path.join(root, "examples", "node");
const requested = process.argv.slice(2);
const files = (await readdir(directory))
	.filter((file) => file.endsWith(".mjs"))
	.filter((file) => requested.length === 0 || requested.includes(file))
	.sort();

if (files.length === 0) {
	throw new Error("No matching Node examples. Pass a filename such as 01-counter.mjs.");
}

let failures = 0;
for (const file of files) {
	console.log(`\n--- examples/node/${file}`);
	const exitCode = await new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [path.join(directory, file)], {
			cwd: root,
			stdio: "inherit",
		});
		child.once("error", reject);
		child.once("exit", (code, signal) => {
			if (signal) reject(new Error(`${file} was terminated by ${signal}`));
			else resolve(code ?? 1);
		});
	});
	if (exitCode !== 0) {
		failures++;
		console.error(`Example failed: ${file} (exit code ${exitCode})`);
	}
}

if (failures > 0) {
	throw new Error(`${failures} Node example${failures === 1 ? "" : "s"} failed.`);
}
console.log(`\n${files.length} isolated Node examples passed.`);
