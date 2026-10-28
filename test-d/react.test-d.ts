import { useSelector } from "ustor/react";

function expectType<Value>(_value: Value): void {}

const state = { count: 1, list: [1, 2] };
const total = useSelector(() => state.list.reduce((sum, value) => sum + value, 0));
expectType<number>(total);
expectType<number>(useSelector(() => state.count));
expectType<{ count: number }>(useSelector(() => ({ count: state.count })));

// @ts-expect-error selectors must be functions
useSelector(42);
