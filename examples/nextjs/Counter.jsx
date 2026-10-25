"use client";

import { useCallback, useState } from "react";
import { useStore } from "ustor/react";
import { store } from "../preact-setup.mjs";

/** @param {{ initialCount: number, initialItems: number[] }} props */
export default function Counter({ initialCount, initialItems }) {
	// useState creates one store per component instance and per server request.
	const [state] = useState(() => store({
		count: initialCount,
		items: [...initialItems], // Do not mutate the props array.
	}));
	const selectCount = useCallback(() => state.count, [state]);
	const selectTotal = useCallback(
		() => state.items.reduce((sum, value) => sum + value, 0),
		[state],
	);
	const count = useStore(selectCount);
	const total = useStore(selectTotal);

	return (
		<button type="button" onClick={() => { state.count++; state.items.push(1); }}>
			Count: {count}; item total: {total}
		</button>
	);
}
