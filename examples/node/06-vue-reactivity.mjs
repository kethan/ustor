import assert from "node:assert/strict";
import { computed, isRef, shallowRef } from "@vue/reactivity";
import { api, store } from "ustor";

// Vue uses shallow refs so it does not wrap UStor's proxies a second time.
Object.assign(api, {
	signal: shallowRef,
	memo: computed,
	get: (value) => value.value,
	getMemo: (value) => value.value,
	set: (target, value) => { target.value = value; },
	is: isRef,
});

const dashboard = store({
	online: true,
	visitors: [2, 3],
	get totalVisitors() {
		return this.visitors.reduce((sum, value) => sum + value, 0);
	},
	get status() {
		return this.online ? "online" : "offline";
	},
});

assert.equal(dashboard.totalVisitors, 5);
dashboard.visitors.push(4);
assert.equal(dashboard.totalVisitors, 9);
dashboard.online = false;
assert.equal(dashboard.status, "offline");

console.log("Vue reactivity example passed:", {
	status: dashboard.status,
	visitors: dashboard.totalVisitors,
});
