import { signal } from "@preact/signals-core";
import { useSignal, useStore } from "ustor/react";
import type { SignalValue } from "ustor/react";

function expectType<Value>(_value: Value): void {}

const state = { count: 1, list: [1, 2] };
const total = useStore(() => state.list.reduce((sum, value) => sum + value, 0));
expectType<number>(total);
expectType<{ count: number }>(useStore(() => ({ count: state.count })));

const countSignal = signal(1);
expectType<number>(useSignal(countSignal));
expectType<number>(useSignal(() => 1));
expectType<SignalValue<typeof countSignal>>(1);

// @ts-expect-error selectors must be functions
useStore(42);
