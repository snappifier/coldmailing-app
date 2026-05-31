// app/(app)/skrzynki/page.tsx
import {requireOrg} from "@/lib/org"
import {listEmailAccounts} from "@/features/email-accounts/queries"
import {disconnectEmailAccount} from "@/features/email-accounts/actions"

export default async function SkrzynkiPage({searchParams}: {searchParams: Promise<{connected?: string; error?: string}>}) {
	const {orgId} = await requireOrg()
	const [accounts, sp] = await Promise.all([listEmailAccounts(orgId), searchParams])

	return (
		<section className="flex flex-col gap-4">
			<h1 className="text-lg font-semibold">Skrzynki wysyłkowe</h1>
			{sp.connected ? <p className="text-sm text-green-700">Skrzynka połączona.</p> : null}
			{sp.error === "oauth" ? <p className="text-sm text-red-600">Połączenie odrzucone lub nieprawidłowy stan.</p> : null}
			{sp.error === "exchange" ? <p className="text-sm text-red-600">Nie udało się dokończyć połączenia. Spróbuj ponownie.</p> : null}
			<div>
				<a className="inline-block rounded bg-zinc-900 px-3 py-1.5 text-sm text-white" href="/api/mailbox/google/connect">
					Połącz skrzynkę Google
				</a>
			</div>
			<ul className="flex flex-col gap-2">
				{accounts.map((a) => (
					<li className="flex items-center justify-between rounded border border-zinc-200 px-3 py-2 text-sm" key={a.id}>
						<span>
							{a.email} <span className="text-zinc-400">· {a.status} · limit {a.dailyLimit}/dzień</span>
						</span>
						<form
							action={async () => {
								"use server"
								await disconnectEmailAccount(a.id)
							}}
						>
							<button className="text-red-600" type="submit">
								Odłącz
							</button>
						</form>
					</li>
				))}
				{accounts.length === 0 ? <li className="text-sm text-zinc-500">Brak połączonych skrzynek.</li> : null}
			</ul>
		</section>
	)
}
