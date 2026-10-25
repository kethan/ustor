import { useCallback, useSyncExternalStore } from "react";
import { api } from "./index.js";

/** Subscribe to a selector that returns a primitive or stable reference. */
const useStore = (selector) => {
	const subscribe = useCallback((notify) => {
		if (!api.effect) throw new Error("ustor/react: configure api.effect with cleanup support");
		let initial = true;
		return api.effect(() => {
			selector();
			if (initial) initial = false;
			else notify();
		});
	}, [selector]);
	return useSyncExternalStore(subscribe, selector, selector);
};

/** Subscribe to one underlying signal exposed as state.$property. */
const useSignal = (signal) => {
	const read = useCallback(() => api.get(signal), [signal]);
	return useStore(read);
};

export { useSignal, useStore };
