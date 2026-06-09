// app/(app)/skrzynki/page.tsx
import {requireOrg} from "@/lib/org"
import {listEmailAccounts} from "@/features/email-accounts/queries"
import {disconnectEmailAccount} from "@/features/email-accounts/actions"
import {ConfirmButton} from "@/components/ui/confirm-button"

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
			<ul className="flex flex-col gap-2">
				{accounts.map((a) => (
					<li className="flex items-center justify-between rounded border border-border px-3 py-2 text-sm" key={a.id}>
						<span>
							{a.email} <span className="text-fg-faint">· {a.status} · limit {a.dailyLimit}/dzień · {a.scope?.includes("gmail.readonly") ? "odpowiedzi: on" : "odpowiedzi: off (przepnij skrzynkę)"}</span>
						</span>
						<ConfirmButton action={disconnectEmailAccount.bind(null, a.id)} confirm={{title: "Odłączyć skrzynkę?", body: "Odłączenie usuwa też historię wiadomości tej skrzynki i wyłącza wykrywanie odpowiedzi. Tej operacji nie można cofnąć.", confirmLabel: "Odłącz", danger: true}} toast="Odłączono skrzynkę">
							Odłącz
						</ConfirmButton>
					</li>
				))}
				{accounts.length === 0 ? <li className="text-sm text-fg-muted">Brak połączonych skrzynek.</li> : null}
			</ul>
		</section>
	)
}
