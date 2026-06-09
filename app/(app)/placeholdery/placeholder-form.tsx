"use client"
// app/(app)/placeholdery/placeholder-form.tsx

import {useActionState} from "react"
import {createPlaceholder, type PlaceholderResult} from "@/features/placeholders/actions"
import {Input} from "@/components/ui/input"
import {Select} from "@/components/ui/select"
import {Button} from "@/components/ui/button"
import {PLACEHOLDER_TYPE_LABEL} from "@/features/enums/labels"

export function PlaceholderForm() {
	const [state, action, pending] = useActionState<PlaceholderResult | null, FormData>(createPlaceholder, null)

	return (
		<form className="flex flex-wrap items-end gap-2 border-b border-border pb-4" action={action}>
			<Input className="w-36" name="key" placeholder="klucz (np. branza)" required />
			<Input className="w-36" name="label" placeholder="Etykieta" required />
			<Select className="w-36" name="type" defaultValue="TEXT">
				<option value="TEXT">{PLACEHOLDER_TYPE_LABEL["TEXT"]}</option>
				<option value="CHOICE">{PLACEHOLDER_TYPE_LABEL["CHOICE"]}</option>
			</Select>
			<Input className="w-48" name="options" placeholder="opcje listy wyboru: a, b, c" />
			<Input className="w-32" name="fallback" placeholder="fallback" />
			<Input className="w-40" name="source" placeholder="source (opcjonalnie)" />
			<Button variant="primary" type="submit" disabled={pending}>
				Dodaj
			</Button>
			{state && !state.ok ? <p className="text-sm text-danger">{state.error}</p> : null}
		</form>
	)
}
