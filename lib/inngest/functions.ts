// lib/inngest/functions.ts
import {inngest} from "@/lib/inngest/client"

export const helloWorld = inngest.createFunction(
	{id: "hello-world"},
	{event: "test/hello.world"},
	async ({event}) => {
		return {message: `Hello ${event.data?.name ?? "world"}`}
	},
)
