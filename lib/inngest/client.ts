import {Inngest} from "inngest"

// Inngest SDK v4 defaults to cloud mode; enable dev mode only under `next dev`
// (NODE_ENV==="development"). In production it runs in cloud mode and uses
// INNGEST_SIGNING_KEY / INNGEST_EVENT_KEY from the environment.
export const inngest = new Inngest({
	id: "coldmailing-app",
	isDev: process.env.NODE_ENV === "development",
})
