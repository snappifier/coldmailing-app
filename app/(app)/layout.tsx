// app/(app)/layout.tsx
import {auth, signOut} from "@/lib/auth"
import {redirect} from "next/navigation"
import Link from "next/link"

export default async function AppLayout({children}: {children: React.ReactNode}) {
	const session = await auth()
	if (!session?.user) redirect("/logowanie")

	return (
		<div className="flex min-h-screen flex-col">
			<header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
				<nav className="flex gap-4 text-sm">
					<Link href="/leady">Leady</Link>
					<Link href="/linie">Linie usług</Link>
					<Link href="/szablony">Szablony</Link>
					<Link href="/placeholdery">Placeholdery</Link>
					<Link href="/kampanie">Kampanie</Link>
					<Link href="/skrzynki">Skrzynki</Link>
					<Link href="/suppression">Suppression</Link>
					<Link href="/ustawienia">Ustawienia</Link>
				</nav>
				<form
					action={async () => {
						"use server"
						await signOut({redirectTo: "/logowanie"})
					}}
				>
					<button className="text-sm text-zinc-600 hover:text-zinc-900" type="submit">
						Wyloguj ({session.user.email})
					</button>
				</form>
			</header>
			<main className="flex-1 p-4">{children}</main>
		</div>
	)
}
