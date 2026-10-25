/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StrictMode, act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { effect, signal } from "@preact/signals-core";
import { api, store } from "./src/index.js";
import { useSignal, useStore } from "./src/react.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

beforeEach(() => {
	for (const key of Object.keys(api)) delete api[key];
	Object.assign(api, {
		signal,
		effect,
		get: (value) => value.value,
		set: (target, value) => { target.value = value; },
		is: (value) => typeof value?.peek === "function",
	});
	container = document.createElement("div");
	document.body.append(container);
	root = createRoot(container);
});

afterEach(() => {
	if (root) act(() => root.unmount());
	container.remove();
});

describe("React integration", () => {
	it("rerenders when a single underlying signal changes", () => {
		const state = store({ count: 1 });
		const Counter = () => {
			const count = useSignal(state.$count);
			return createElement("span", null, count);
		};
		act(() => root.render(createElement(Counter)));
		expect(container.textContent).toBe("1");
		act(() => { state.count = 2; });
		expect(container.textContent).toBe("2");
	});

	it("tracks derived selectors and in-place array mutations", () => {
		const state = store({ factor: 2, list: [1, 2] });
		const selectTotal = () => state.factor * state.list.reduce((sum, value) => sum + value, 0);
		const Total = () => {
			const total = useStore(selectTotal);
			return createElement("output", null, total);
		};
		act(() => root.render(createElement(Total)));
		expect(container.textContent).toBe("6");
		act(() => { state.list.push(3); });
		expect(container.textContent).toBe("12");
		act(() => { state.factor = 3; });
		expect(container.textContent).toBe("18");
		act(() => { state.list[0] = 4; });
		expect(container.textContent).toBe("27");
	});

	it("cleans up subscriptions in StrictMode and after unmount", () => {
		const state = store({ count: 1 });
		let reads = 0;
		const selectCount = () => { reads++; return state.count; };
		const Counter = () => createElement("span", null, useStore(selectCount));
		act(() => root.render(createElement(StrictMode, null, createElement(Counter))));
		expect(container.textContent).toBe("1");
		act(() => root.unmount());
		root = null;
		const afterUnmount = reads;
		state.count = 2;
		expect(reads).toBe(afterUnmount);
	});

	it("fails clearly when the configured effect has no React subscription support", () => {
		delete api.effect;
		const state = store({ count: 1 });
		const selectCount = () => state.count;
		const Counter = () => createElement("span", null, useStore(selectCount));
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
		try {
			expect(() => act(() => root.render(createElement(Counter)))).toThrow(/configure api\.effect/);
		} finally {
			consoleError.mockRestore();
		}
	});
});
