// app/(app)/layout.tsx
import {auth, signOut} from "@/lib/auth"
import {redirect} from "next/navigation"
import {ToastProvider} from "@/components/ui/toast-provider"
import {ConfirmProvider} from "@/components/ui/confirm"
import {Container} from "@/components/ui/container"
import {ThemeToggle} from "@/components/ui/theme-toggle"
import {NavLink} from "./nav-link"

const LINKS: [string, string][] = [
	["/leady", "Leady"], ["/pipeline", "Pipeline"], ["/linie", "Linie usług"], ["/szablony", "Szablony"],
	["/placeholdery", "Placeholdery"], ["/badania", "Badania"], ["/kampanie", "Kampanie"], ["/skrzynki", "Skrzynki"],
	["/suppression", "Suppression"], ["/ustawienia", "Ustawienia"],
]

export default async function AppLayout({children}: {children: React.ReactNode}) {
	const session = await auth()
	if (!session?.user) redirect("/logowanie")

	return (
		<ToastProvider>
			<ConfirmProvider>
				<a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface-1 focus:px-3 focus:py-1.5 focus:text-sm focus:ring-2 focus:ring-ring">Przejdź do treści</a>
				<div className="flex min-h-screen flex-col">
					<header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur-md">
						<Container className="flex h-[52px] items-center gap-4">
							<nav className="flex flex-wrap gap-1">
								{LINKS.map(([href, label]) => <NavLink key={href} href={href}>{label}</NavLink>)}
							</nav>
							<div className="flex-1" />
							<ThemeToggle />
							<form action={async () => {"use server"; await signOut({redirectTo: "/logowanie"})}}>
								<button className="text-sm text-fg-muted transition-colors hover:text-fg" type="submit">Wyloguj</button>
							</form>
						</Container>
					</header>
					<main id="main" className="flex-1">
						<Container className="py-8">{children}</Container>
					</main>
				</div>
			</ConfirmProvider>
		</ToastProvider>
	)
}