/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
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
	root = null;
});

afterEach(() => {
	if (root) act(() => root.unmount());
	container.remove();
});

describe("server rendering and hydration", () => {
	it("renders on the server without creating effects", () => {
		const state = store({ count: 2, list: [1, 2] });
		const selectTotal = () => state.list.reduce((sum, value) => sum + value, 0);
		const View = () => createElement(
			"div",
			null,
			`${useSignal(state.$count)}:${useStore(selectTotal)}`,
		);
		delete api.effect;
		expect(renderToString(createElement(View))).toBe("<div>2:3</div>");
	});

	it("isolates independent server requests", () => {
		delete api.effect;
		const renderRequest = (count) => {
			const state = store({ count });
			const View = () => createElement("span", null, useSignal(state.$count));
			return renderToString(createElement(View));
		};
		expect(renderRequest(1)).toBe("<span>1</span>");
		expect(renderRequest(2)).toBe("<span>2</span>");
		expect(renderRequest(1)).toBe("<span>1</span>");
	});

	it("hydrates without mismatches and reacts to later updates", () => {
		const state = store({ count: 1, list: [1, 2] });
		const selectTotal = () => state.list.reduce((sum, value) => sum + value, 0);
		const View = () => createElement(
			"main",
			null,
			`${useSignal(state.$count)}:${useStore(selectTotal)}`,
		);
		let subscriptions = 0;
		const preactEffect = api.effect;
		api.effect = (fn) => {
			subscriptions++;
			return preactEffect(fn);
		};
		const html = renderToString(createElement(View));
		expect(subscriptions).toBe(0);
		container.innerHTML = html;

		const recoverableErrors = [];
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
		try {
			act(() => {
				root = hydrateRoot(container, createElement(View), {
					onRecoverableError: (error) => recoverableErrors.push(error),
				});
			});
			expect(container.textContent).toBe("1:3");
			expect(recoverableErrors).toEqual([]);
			expect(consoleError).not.toHaveBeenCalled();
			expect(subscriptions).toBeGreaterThan(0);

			act(() => { state.count = 2; });
			expect(container.textContent).toBe("2:3");
			act(() => { state.list.push(3); });
			expect(container.textContent).toBe("2:6");
		} finally {
			consoleError.mockRestore();
		}
	});
});
