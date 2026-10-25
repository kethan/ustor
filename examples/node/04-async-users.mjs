import assert from "node:assert/strict";
import { store } from "../preact-setup.mjs";

const deferred = () => {
	let resolve;
	let reject;
	const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
	return { promise, resolve, reject };
};

const createUserLoader = (fetchUsers) => {
	const state = store({ status: "idle", users: [], error: null });
	let latestRequest = 0;

	return {
		state,
		async load() {
			const request = ++latestRequest;
			state.status = "loading";
			state.error = null;
			try {
				// Replace fetchUsers with your API request in an application.
				const users = await fetchUsers();
				if (request !== latestRequest) return;
				state.users = users;
				state.status = "success";
			} catch (error) {
				if (request !== latestRequest) return;
				state.error = error instanceof Error ? error.message : String(error);
				state.status = "error";
			}
		},
	};
};

const first = deferred();
const second = deferred();
let call = 0;
const loader = createUserLoader(() => (++call === 1 ? first.promise : second.promise));

const firstLoad = loader.load();
const secondLoad = loader.load();
second.resolve([{ id: 2, name: "Latest response" }]);
await secondLoad;
first.resolve([{ id: 1, name: "Stale response" }]);
await firstLoad;

assert.equal(loader.state.status, "success");
assert.equal(loader.state.users[0].id, 2);

const failed = createUserLoader(async () => { throw new Error("Network offline"); });
await failed.load();
assert.equal(failed.state.status, "error");
assert.equal(failed.state.error, "Network offline");

console.log("Async users example passed:", loader.state.status, loader.state.users[0].name);
