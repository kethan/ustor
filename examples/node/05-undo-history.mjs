import assert from "node:assert/strict";
import { store } from "../preact-setup.mjs";

const editor = store({
	past: [],
	present: { text: "" },
	future: [],
	get canUndo() { return this.past.length > 0; },
	get canRedo() { return this.future.length > 0; },
});

// Copy the snapshot instead of retaining a mutable proxy in history.
const snapshot = (value) => ({ text: value.text });

const update = (text) => {
	editor.past = [...editor.past, snapshot(editor.present)];
	editor.present = { text };
	editor.future = [];
};

const undo = () => {
	if (!editor.canUndo) return;
	const previous = editor.past.at(-1);
	editor.past = editor.past.slice(0, -1);
	editor.future = [snapshot(editor.present), ...editor.future];
	editor.present = snapshot(previous);
};

const redo = () => {
	if (!editor.canRedo) return;
	const next = editor.future[0];
	editor.future = editor.future.slice(1);
	editor.past = [...editor.past, snapshot(editor.present)];
	editor.present = snapshot(next);
};

update("Hello");
update("Hello, signals");
assert.equal(editor.present.text, "Hello, signals");
assert.equal(editor.canUndo, true);

undo();
assert.equal(editor.present.text, "Hello");
assert.equal(editor.canRedo, true);

redo();
assert.equal(editor.present.text, "Hello, signals");
undo();
update("Hello, UStor");
assert.equal(editor.canRedo, false);
assert.equal(editor.present.text, "Hello, UStor");

console.log("Undo history example passed:", {
	past: editor.past.length,
	present: editor.present.text,
	future: editor.future.length,
});
