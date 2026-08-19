import {auth} from "@/lib/auth"
import {redirect} from "next/navigation"
import {prisma} from "@/lib/prisma"
import {ToastProvider} from "@/components/ui/toast-provider"
import {ConfirmProvider} from "@/components/ui/confirm"
import {Container} from "@/components/ui/container"
import {Sidebar} from "./sidebar"
import {DevSeed} from "./dev-seed"
import {DevSkeletonGate} from "./dev-skeleton"
import {DEMO_EMAIL_SUFFIX} from "@/features/demo/seed-data"

export default async function AppLayout({children}: {children: React.ReactNode}) {
	const session = await auth()
	if (!session?.user) redirect("/logowanie")
	const org = session.user.orgId ? await prisma.organization.findUnique({where: {id: session.user.orgId}, select: {name: true}}) : null
	const devMode = process.env.NODE_ENV === "development"
	const demoSeeded = devMode && session.user.orgId ? (await prisma.lead.count({where: {organizationId: session.user.orgId, email: {endsWith: DEMO_EMAIL_SUFFIX}}})) > 0 : false

	return (
		<ToastProvider>
			<ConfirmProvider>
				<a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface-1 focus:px-3 focus:py-1.5 focus:text-sm focus:ring-2 focus:ring-ring">Przejdź do treści</a>
				<div className="flex min-h-screen">
					<Sidebar user={{name: session.user.name ?? null, email: session.user.email ?? null, role: String(session.user.role ?? ""), orgName: org?.name ?? ""}} />
					<main id="main" className="min-w-0 flex-1">
						<Container className="py-8">{devMode ? <DevSkeletonGate>{children}</DevSkeletonGate> : children}</Container>
					</main>
				</div>
				{devMode && <DevSeed seeded={demoSeeded} />}
			</ConfirmProvider>
		</ToastProvider>
	)
}
