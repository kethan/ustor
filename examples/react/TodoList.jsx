import { useCallback, useState } from "react";
import { useSelector } from "ustor/react";
import { store } from "../preact-setup.mjs";

export default function TodoList() {
	const [state] = useState(() => store({
		draft: "",
		todos: /** @type {{ id: number, text: string, done: boolean }[]} */ ([]),
	}));
	const selectCount = useCallback(() => state.todos.length, [state]);
	const selectRemaining = useCallback(
		() => state.todos.reduce((count, todo) => count + (todo.done ? 0 : 1), 0),
		[state],
	);
	const selectDraft = useCallback(() => state.draft, [state]);

	// Primitive snapshots notify React about structure and done-field changes.
	const count = useSelector(selectCount);
	const remaining = useSelector(selectRemaining);
	const draft = useSelector(selectDraft);

	/** @param {import("react").FormEvent<HTMLFormElement>} event */
	const addTodo = (event) => {
		event.preventDefault();
		const text = state.draft.trim();
		if (!text) return;
		const id = state.todos.reduce((max, todo) => Math.max(max, todo.id), 0) + 1;
		state.todos.push({ id, text, done: false });
		state.draft = "";
	};

	return (
		<section>
			<h2>Todos: {count} total / {remaining} remaining</h2>
			<form onSubmit={addTodo}>
				<label>
					New todo
					<input value={draft} onInput={(event) => { state.draft = event.currentTarget.value; }} />
				</label>
				<button type="submit">Add</button>
			</form>
			<ul>
				{state.todos.map((todo, index) => (
					<li key={todo.id}>
						<label>
							<input
								type="checkbox"
								checked={todo.done}
								onChange={() => { todo.done = !todo.done; }}
							/>
							{todo.text}
						</label>
						<button type="button" onClick={() => state.todos.splice(index, 1)}>Remove</button>
					</li>
				))}
			</ul>
		</section>
	);
}
