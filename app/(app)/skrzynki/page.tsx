// app/(app)/skrzynki/page.tsx
import {requireOrg, currentRole} from "@/lib/org"
import {hasRole} from "@/features/team/roles"
import {redirect} from "next/navigation"
import {listEmailAccounts} from "@/features/email-accounts/queries"
import {disconnectEmailAccount} from "@/features/email-accounts/actions"
import {TIMEZONES} from "@/features/email-accounts/settings"
import {ConfirmButton} from "@/components/ui/confirm-button"
import {Badge} from "@/components/ui/badge"
import {PageHeader} from "@/components/ui/page-header"
import {EmptyState} from "@/components/ui/empty-state"
import {EMAIL_ACCOUNT_STATUS_LABEL, EMAIL_ACCOUNT_STATUS_VARIANT} from "@/features/enums/labels"
import {MailboxSettingsForm} from "./mailbox-settings-form"

const connectAnchorClass = "inline-flex items-center gap-2 rounded-md font-medium tracking-[-0.01em] transition-[transform,background,border-color,opacity] duration-150 ease-out active:scale-[.97] h-8 px-3 text-sm bg-primary text-primary-fg hover:opacity-90"

export default async function SkrzynkiPage({searchParams}: {searchParams: Promise<{connected?: string; error?: string}>}) {
	const ctx = await requireOrg()
	const role = await currentRole(ctx)
	if (!hasRole(role, "ADMIN")) redirect("/")
	const orgId = ctx.orgId
	const [accounts, sp] = await Promise.all([listEmailAccounts(orgId), searchParams])
	const connected = accounts.filter((a) => a.status === "CONNECTED").length

	const connectAnchor = (
		<a className={connectAnchorClass} href="/api/mailbox/google/connect">
			Połącz skrzynkę Google
		</a>
	)

	return (
		<section className="flex flex-col gap-4">
			<PageHeader
				title="Skrzynki wysyłkowe"
				description="Połączone konta Gmail z limitami i oknami wysyłki."
				meta={`${accounts.length} skrzynek · ${connected} połączonych`}
				action={connectAnchor}
			/>
			{sp.connected ? <p className="text-sm text-success">Skrzynka połączona.</p> : null}
			{sp.error === "oauth" ? <p className="text-sm text-danger">Połączenie odrzucone lub nieprawidłowy stan.</p> : null}
			{sp.error === "exchange" ? <p className="text-sm text-danger">Nie udało się dokończyć połączenia. Spróbuj ponownie.</p> : null}
			{accounts.length === 0 ? (
				<EmptyState title="Brak połączonych skrzynek" action={connectAnchor} />
			) : (
				<ul className="flex flex-col gap-3">
					{accounts.map((a) => (
						<li className="flex flex-col gap-3 rounded-lg border border-border bg-surface-1 p-4" key={a.id}>
							<div className="flex flex-wrap items-center gap-2">
								<span className="text-sm font-semibold">{a.email}</span>
								<Badge variant={EMAIL_ACCOUNT_STATUS_VARIANT[a.status]}>{EMAIL_ACCOUNT_STATUS_LABEL[a.status]}</Badge>
								{a.scope?.includes("gmail.readonly") ? (
									<span className="rounded-full bg-accent-quiet px-2 py-0.5 text-xs text-accent">odpowiedzi: on</span>
								) : (
									<span className="rounded-full bg-warning-quiet px-2 py-0.5 text-xs text-warning">odpowiedzi: off (przepnij skrzynkę)</span>
								)}
								<span className="flex-1" />
								<ConfirmButton action={disconnectEmailAccount.bind(null, a.id)} confirm={{title: "Odłączyć skrzynkę?", body: "Odłączenie usuwa też historię wiadomości tej skrzynki i wyłącza wykrywanie odpowiedzi. Tej operacji nie można cofnąć.", confirmLabel: "Odłącz", danger: true}} toast="Odłączono skrzynkę">
									Odłącz
								</ConfirmButton>
							</div>
							<MailboxSettingsForm account={a} timezones={TIMEZONES} />
						</li>
					))}
				</ul>
			)}
		</section>
	)
}
