// types/next-auth.d.ts
import type {DefaultSession} from "next-auth"
import type {Role} from "@/generated/prisma/client"

declare module "next-auth" {
	interface Session {
		user: {
			id: string
			orgId: string
			role: Role
		} & DefaultSession["user"]
	}
}

declare module "next-auth/jwt" {
	interface JWT {
		uid?: string
		orgId?: string
		role?: Role
	}
}
