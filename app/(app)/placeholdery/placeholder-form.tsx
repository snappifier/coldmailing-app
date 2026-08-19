"use client"

import {useActionState, useRef} from "react"
import {createPlaceholder, type PlaceholderResult} from "@/features/placeholders/actions"
import {Input} from "@/components/ui/input"
import {Select} from "@/components/ui/select"
import {Button} from "@/components/ui/button"
import {Field} from "@/components/ui/field"
import {useToast} from "@/components/ui/use-toast"
import {PLACEHOLDER_TYPE_LABEL} from "@/features/enums/labels"

export function PlaceholderForm({onSuccess}: {onSuccess?: () => void}) {
	const formRef = useRef<HTMLFormElement>(null)
	const toast = useToast()
	const [state, action, pending] = useActionState<PlaceholderResult | null, FormData>(
		async (prev, formData) => {
			const res = await createPlaceholder(prev, formData)
			if (res.ok) {
				toast("Dodano placeholder")
				formRef.current?.reset()
				onSuccess?.()
			}
			return res
		},
		null,
	)

	return (
		<form className="flex flex-col gap-3" ref={formRef} action={action}>
			<Field label="Klucz">
				<Input name="key" placeholder="np. branza" required />
			</Field>
			<Field label="Etykieta">
				<Input name="label" required />
			</Field>
			<Field label="Typ">
				<Select name="type" defaultValue="TEXT">
					<option value="TEXT">{PLACEHOLDER_TYPE_LABEL["TEXT"]}</option>
					<option value="CHOICE">{PLACEHOLDER_TYPE_LABEL["CHOICE"]}</option>
				</Select>
			</Field>
			<Field label="Opcje">
				<Input name="options" placeholder="opcje listy wyboru: a, b, c" />
			</Field>
			<Field label="Fallback">
				<Input name="fallback" />
			</Field>
			<Field label="Źródło">
				<Input name="source" placeholder="source (opcjonalnie)" />
			</Field>
			<Button variant="primary" type="submit" disabled={pending}>
				Dodaj placeholder
			</Button>
			{state && !state.ok ? <p className="text-sm text-danger">{state.error}</p> : null}
		</form>
	)
}
