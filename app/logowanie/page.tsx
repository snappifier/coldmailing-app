import {signIn, auth} from "@/lib/auth"
import {redirect} from "next/navigation"
import {Card, CardBody} from "@/components/ui/card"
import {SignInButton} from "@/app/logowanie/sign-in-button"

export default async function LoginPage() {
	const session = await auth()
	if (session?.user) redirect("/leady")

	return (
		<main className="relative isolate mx-auto flex min-h-screen w-full flex-col items-center justify-center gap-5 p-6">
			<div className="pointer-events-none absolute inset-0 -z-10" style={{background: "radial-gradient(120% 80% at 50% 0%, var(--accent-quiet), transparent 60%)"}} />
			<div className="flex items-center gap-2 text-[15px] font-bold tracking-[-0.02em]">
				<span className="text-[9px] text-accent">●</span> cold·mail
			</div>
			<Card className="w-full max-w-90">
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
						<SignInButton />
					</form>
				</CardBody>
			</Card>
			<p className="text-center text-[11.5px] text-fg-faint">Dostęp tylko dla zaproszonych kont.</p>
		</main>
	)
}
