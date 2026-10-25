import assert from "node:assert/strict";
import { batch, store } from "../preact-setup.mjs";

const form = store({
	email: "",
	password: "",
	remember: false,
	get validationMessage() {
		if (!this.email.includes("@")) return "Enter a valid email address.";
		if (this.password.length < 8) return "Password must contain at least 8 characters.";
		return "";
	},
	get valid() {
		return this.validationMessage === "";
	},
});

assert.equal(form.valid, false);
assert.match(form.validationMessage, /email/);

batch(() => {
	form.email = "person@example.com";
	form.password = "very-secret";
	form.remember = true;
});

assert.equal(form.valid, true);
assert.equal(form.validationMessage, "");

form.password = "short";
assert.equal(form.valid, false);
assert.match(form.validationMessage, /8 characters/);

console.log("Form validation example passed:", {
	valid: form.valid,
	message: form.validationMessage,
});
