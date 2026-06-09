"use server"
// features/auth/actions.ts
import {signOut} from "@/lib/auth"

export async function signOutAction(): Promise<void> {
	await signOut({redirectTo: "/logowanie"})
}
