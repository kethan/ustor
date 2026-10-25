import { store } from "ustor";

type Status = "idle" | "loading" | "success" | "error";

interface User {
	id: number;
	name: string;
}

const dashboard = store({
	status: "idle" as Status,
	users: [] as User[],
	get ready(): boolean {
		return this.status === "success";
	},
	get firstUserName(): string {
		return this.users[0]?.name ?? "No users";
	},
});

dashboard.status = "loading";
dashboard.users = [{ id: 1, name: "Ada" }];
dashboard.status = "success";

const ready: boolean = dashboard.ready;
const firstUserName: string = dashboard.firstUserName;
const firstUserId: number = dashboard.users[0].id;

// Uncomment to see a compile-time error:
// dashboard.status = "unknown";

console.log("TypeScript dashboard example:", { ready, firstUserName, firstUserId });
