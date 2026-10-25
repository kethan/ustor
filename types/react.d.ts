export type SignalValue<Signal> = Signal extends { state: readonly (infer Value)[] }
	? Value
	: Signal extends { value: infer Value }
		? Value
		: Signal extends { get(): infer Value }
			? Value
			: Signal extends () => infer Value
				? Value
				: Signal extends readonly [() => infer Value, ...any[]]
					? Value
					: unknown;

/** Subscribe to a selector that returns a primitive or stable reference. */
export declare function useStore<Value>(selector: () => Value): Value;

/** Subscribe to one underlying signal exposed as state.$property. */
export declare function useSignal<Signal>(signal: Signal): SignalValue<Signal>;
