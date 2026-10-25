import { useStore } from "ustor/react";
import { store } from "../preact-setup.mjs";

// Module-level state is useful for client-only shared UI state. For SSR, use
// component- or request-owned state instead (see examples/nextjs).
export const counter = store({ count: 0 });
const selectCount = () => counter.count;

export default function Counter() {
	const count = useStore(selectCount);
	return (
		<button type="button" onClick={() => counter.count++}>
			Count: {count}
		</button>
	);
}
