"use client"
// app/(app)/leady/import/import-wizard.tsx

import {useActionState, useMemo, useState} from "react"
import {parseTable} from "@/features/leads/import"
import {importLeads, type ImportResult} from "@/features/leads/actions"

const FIELDS: {key: string; label: string}[] = [
	{key: "organizationName", label: "Nazwa placówki *"},
	{key: "email", label: "Email"},
	{key: "website", label: "WWW"},
	{key: "contactPersonName", label: "Osoba"},
	{key: "contactRole", label: "Rola"},
	{key: "phone", label: "Telefon"},
	{key: "city", label: "Miasto"},
	{key: "region", label: "Region"},
	{key: "schoolType", label: "Typ szkoły"},
	{key: "honorific", label: "Zwrot (Pan/Pani)"},
]

export function ImportWizard({offeringLines}: {offeringLines: {id: string; name: string}[]}) {
	const [text, setText] = useState("")
	const [hasHeader, setHasHeader] = useState(true)
	const [state, action, pending] = useActionState<ImportResult | null, FormData>(importLeads, null)

	const rows = useMemo(() => (text.trim() ? parseTable(text).slice(0, 5) : []), [text])
	const columnCount = rows.reduce((max, r) => Math.max(max, r.length), 0)
	const columnOptions = Array.from({length: columnCount}, (_, i) => i)

	return (
		<form className="flex flex-col gap-4" action={action}>
			<textarea
				className="h-40 rounded border border-zinc-300 p-2 font-mono text-xs"
				name="text"
				placeholder="Wklej CSV/TSV (np. z arkusza). Pierwszy wiersz = nagłówki."
				value={text}
				onChange={(e) => setText(e.target.value)}
			/>
			<label className="flex items-center gap-2 text-sm">
				<input name="hasHeader" type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
				Pierwszy wiersz to nagłówki
			</label>

			{rows.length > 0 ? (
				<div className="overflow-x-auto">
					<table className="border-collapse text-xs">
						<tbody>
							{rows.map((r, ri) => (
								<tr key={ri} className="border-b border-zinc-100">
									{r.map((c, ci) => (
										<td className="border border-zinc-200 px-2 py-1" key={ci}>
											{c}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : null}

			<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
				{FIELDS.map((field) => (
					<label className="flex flex-col text-xs" key={field.key}>
						{field.label}
						<select className="rounded border border-zinc-300 px-1 py-1" name={`mapping_${field.key}`} defaultValue="">
							<option value="">—</option>
							{columnOptions.map((i) => (
								<option key={i} value={i}>
									Kolumna {i + 1}
								</option>
							))}
						</select>
					</label>
				))}
			</div>

			<label className="flex flex-col text-sm">
				Przypisz do linii usługi
				<select className="w-64 rounded border border-zinc-300 px-2 py-1" name="offeringLineId" defaultValue="">
					<option value="">— brak —</option>
					{offeringLines.map((l) => (
						<option key={l.id} value={l.id}>
							{l.name}
						</option>
					))}
				</select>
			</label>

			<button className="w-40 rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50" type="submit" disabled={pending}>
				{pending ? "Importuję..." : "Importuj"}
			</button>

			{state ? (
				state.ok ? (
					<p className="text-sm text-green-700">
						Dodano {state.created}, pominięto duplikaty: {state.duplicateCount}, na suppression: {state.suppressedCount}.
					</p>
				) : (
					<p className="text-sm text-red-600">{state.error}</p>
				)
			) : null}
		</form>
	)
}
