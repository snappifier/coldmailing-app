// app/logowanie/page.tsx
import {signIn, auth} from "@/lib/auth"
import {redirect} from "next/navigation"

export default async function LoginPage() {
	const session = await auth()
	if (session?.user) redirect("/leady")

	return (
		<main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
			<h1 className="text-xl font-semibold">Cold Mailing</h1>
			<p className="text-sm text-fg-muted">Zaloguj się kontem Google z listy dostępu.</p>
			<form
				action={async () => {
					"use server"
					await signIn("google", {redirectTo: "/leady"})
				}}
			>
				<button className="rounded border border-border px-4 py-2 text-sm hover:bg-surface-2" type="submit">
					Zaloguj przez Google
				</button>
			</form>
		</main>
	)
}
