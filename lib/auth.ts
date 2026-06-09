// lib/auth.ts
import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import {PrismaAdapter} from "@auth/prisma-adapter"
import {prisma} from "@/lib/prisma"
import {ensureMembership, isSignInAllowed} from "@/lib/auth-helpers"
import type {Role} from "@/generated/prisma/client"

export const {handlers, signIn, signOut, auth} = NextAuth({
	adapter: PrismaAdapter(prisma),
	session: {strategy: "jwt"},
	pages: {signIn: "/logowanie"},
	providers: [Google],
	callbacks: {
		async signIn({user}) {
			return isSignInAllowed(user.email)
		},
		async jwt({token, user}) {
			if (user?.id && user.email) {
				const membership = await ensureMembership(user.id, user.email)
				token.uid = user.id
				token.orgId = membership.organizationId
				token.role = membership.role
			}
			return token
		},
		session({session, token}) {
			if (session.user) {
				if (token.uid) session.user.id = token.uid as string
				session.user.orgId = token.orgId as string
				session.user.role = token.role as Role
			}
			return session
		},
	},
})
