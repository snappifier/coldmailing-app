// app/logowanie/page.tsx
import {signIn, auth} from "@/lib/auth"
import {redirect} from "next/navigation"
import {Card, CardBody} from "@/components/ui/card"
import {Button} from "@/components/ui/button"

export default async function LoginPage() {
	const session = await auth()
	if (session?.user) redirect("/leady")

	return (
		<main className="relative isolate mx-auto flex min-h-screen w-full max-w-[360px] flex-col justify-center gap-5 p-6">
			<div className="pointer-events-none absolute inset-0 -z-10" style={{background: "radial-gradient(120% 80% at 50% 0%, var(--accent-quiet), transparent 60%)"}} />
			<div className="flex items-center gap-2 text-[15px] font-bold tracking-[-0.02em]">
				<span className="text-[9px] text-accent">●</span> cold·mail
			</div>
			<Card>
				<CardBody className="flex flex-col gap-4">
					<div>
						<h1 className="text-[15px] font-semibold tracking-[-0.02em]">Zaloguj się</h1>
						<p className="mt-1 text-[12.5px] text-fg-muted">Wewnętrzne narzędzie cold mailingu. Dostęp przez konto Google.</p>
					</div>
					<form
						action={async () => {
							"use server"
							await signIn("google", {redirectTo: "/leady"})
						}}
					>
						<Button className="w-full justify-center" type="submit">
							<svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 11v2.7h6.4c-.26 1.65-1.93 4.84-6.4 4.84-3.85 0-6.99-3.19-6.99-7.12S8.15 4.3 12 4.3c2.19 0 3.66.93 4.5 1.74l2.07-2C17.24 2.8 14.86 1.8 12 1.8 6.48 1.8 2 6.28 2 11.8s4.48 10 10 10c5.77 0 9.6-4.06 9.6-9.77 0-.66-.07-1.16-.16-1.66H12z"/></svg>
							Zaloguj przez Google
						</Button>
					</form>
				</CardBody>
			</Card>
			<p className="text-center text-[11.5px] text-fg-faint">Dostęp tylko dla zaproszonych kont.</p>
		</main>
	)
}
