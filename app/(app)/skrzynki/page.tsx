// app/(app)/skrzynki/page.tsx
import {requireOrg} from "@/lib/org"
import {listEmailAccounts} from "@/features/email-accounts/queries"
import {disconnectEmailAccount} from "@/features/email-accounts/actions"
import {TIMEZONES} from "@/features/email-accounts/settings"
import {ConfirmButton} from "@/components/ui/confirm-button"
import {MailboxSettingsForm} from "./mailbox-settings-form"

export default async function SkrzynkiPage({searchParams}: {searchParams: Promise<{connected?: string; error?: string}>}) {
	const {orgId} = await requireOrg()
	const [accounts, sp] = await Promise.all([listEmailAccounts(orgId), searchParams])

	return (
		<section className="flex flex-col gap-4">
			<h1 className="text-lg font-semibold">Skrzynki wysyłkowe</h1>
			{sp.connected ? <p className="text-sm text-success">Skrzynka połączona.</p> : null}
			{sp.error === "oauth" ? <p className="text-sm text-danger">Połączenie odrzucone lub nieprawidłowy stan.</p> : null}
			{sp.error === "exchange" ? <p className="text-sm text-danger">Nie udało się dokończyć połączenia. Spróbuj ponownie.</p> : null}
			<div>
				<a className="inline-block rounded bg-primary px-3 py-1.5 text-sm text-primary-fg" href="/api/mailbox/google/connect">
					Połącz skrzynkę Google
				</a>
			</div>
			<ul className="flex flex-col gap-3">
				{accounts.map((a) => (
					<li className="flex flex-col gap-3 rounded-lg border border-border bg-surface-1 p-4" key={a.id}>
						<div className="flex flex-wrap items-center gap-2">
							<span className="text-sm font-semibold">{a.email}</span>
							<span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-fg-muted">{a.status}</span>
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
				{accounts.length === 0 ? <li className="text-sm text-fg-muted">Brak połączonych skrzynek.</li> : null}
			</ul>
		</section>
	)
}
