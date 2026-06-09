"use client"
// app/(app)/leady/import/import-wizard.tsx

import {useMemo, useState, useActionState} from "react"
import {parseTable, defaultCustomKey, type LeadFieldKey} from "@/features/leads/import"
import {importLeads, type ImportResult} from "@/features/leads/actions"

const FIELDS: {key: LeadFieldKey; label: string}[] = [
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

type Target = {kind: "ignore"} | {kind: "field"; field: LeadFieldKey} | {kind: "custom"; key: string}

export function ImportWizard({offeringLines}: {offeringLines: {id: string; name: string}[]}) {
	const [text, setText] = useState("")
	const [hasHeader, setHasHeader] = useState(true)
	const [targets, setTargets] = useState<Record<number, Target>>({})
	const [state, action, pending] = useActionState<ImportResult | null, FormData>(importLeads, null)

	const allRows = useMemo(() => (text.trim() ? parseTable(text) : []), [text])
	const previewRows = allRows.slice(0, 5)
	const columnCount = allRows.reduce((max, r) => Math.max(max, r.length), 0)
	const headers = hasHeader ? allRows[0] ?? [] : []

	// Reset the per-column mapping when the column COUNT changes (a structural re-paste), so stale
	// index-keyed targets can't silently point at different semantic columns. Same-shape edits keep the mapping.
	function onText(value: string) {
		const count = value.trim() ? parseTable(value).reduce((m, r) => Math.max(m, r.length), 0) : 0
		if (count !== columnCount) setTargets({})
		setText(value)
	}

	const targetOf = (i: number): Target => targets[i] ?? {kind: "ignore"}
	const selValue = (t: Target) => (t.kind === "field" ? `field:${t.field}` : t.kind === "custom" ? "custom" : "")
	function onSelect(i: number, value: string) {
		if (value === "custom") setTargets({...targets, [i]: {kind: "custom", key: defaultCustomKey(headers[i] ?? null, i)}})
		else if (value.startsWith("field:")) setTargets({...targets, [i]: {kind: "field", field: value.slice(6) as LeadFieldKey}})
		else setTargets({...targets, [i]: {kind: "ignore"}})
	}

	return (
		<form className="flex flex-col gap-4" action={action}>
			<textarea
				className="h-40 rounded border border-border p-2 font-mono text-xs"
				name="text"
				placeholder="Wklej CSV/TSV (np. z arkusza). Pierwszy wiersz = nagłówki."
				value={text}
				onChange={(e) => onText(e.target.value)}
			/>
			<label className="flex items-center gap-2 text-sm">
				<input name="hasHeader" type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
				Pierwszy wiersz to nagłówki
			</label>

			{previewRows.length > 0 ? (
				<div className="overflow-x-auto">
					<table className="border-collapse text-xs">
						<tbody>
							{previewRows.map((r, ri) => (
								<tr key={ri} className="border-b border-border">
									{r.map((c, ci) => (
										<td className="border border-border px-2 py-1" key={ci}>
											{c}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : null}

			{columnCount > 0 ? (
				<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
					{Array.from({length: columnCount}, (_, i) => {
						const t = targetOf(i)
						return (
							<div className="flex flex-col gap-1 text-xs" key={i}>
								<span className="truncate text-fg-muted">{headers[i]?.trim() || `Kolumna ${i + 1}`}</span>
								<select className="rounded border border-border px-1 py-1" name={`target_${i}`} value={selValue(t)} onChange={(e) => onSelect(i, e.target.value)}>
									<option value="">— ignoruj —</option>
									{FIELDS.map((f) => (
										<option key={f.key} value={`field:${f.key}`}>
											{f.label}
										</option>
									))}
									<option value="custom">Pole własne</option>
								</select>
								{t.kind === "custom" ? (
									<input
										className="rounded border border-dashed border-border px-1 py-1"
										name={`customkey_${i}`}
										placeholder="klucz pola"
										value={t.key}
										onChange={(e) => setTargets({...targets, [i]: {kind: "custom", key: e.target.value}})}
									/>
								) : null}
							</div>
						)
					})}
				</div>
			) : null}

			<p className="text-xs text-fg-muted">
				Wskazówka: zmapuj kolumnę Email - bez niej leady wejdą bez adresu i nie wezmą udziału w dedupe ani wysyłce. Kolumny ustawione na „Pole własne” trafią do pól własnych leada.
			</p>

			<label className="flex flex-col text-sm">
				Przypisz do linii usługi
				<select className="w-64 rounded border border-border px-2 py-1" name="offeringLineId" defaultValue="">
					<option value="">— brak —</option>
					{offeringLines.map((l) => (
						<option key={l.id} value={l.id}>
							{l.name}
						</option>
					))}
				</select>
			</label>

			<button className="w-40 rounded bg-primary px-3 py-2 text-sm text-primary-fg disabled:opacity-50" type="submit" disabled={pending}>
				{pending ? "Importuję..." : "Importuj"}
			</button>

			{state ? (
				state.ok ? (
					<p className="text-sm text-success">
						Dodano {state.created}, pominięto duplikaty: {state.duplicateCount}, na suppression: {state.suppressedCount}.
						{state.withoutEmail > 0 ? ` Uwaga: ${state.withoutEmail} bez emaila.` : ""}
					</p>
				) : (
					<p className="text-sm text-danger">{state.error}</p>
				)
			) : null}
		</form>
	)
}
