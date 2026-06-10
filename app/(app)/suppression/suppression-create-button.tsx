"use client"
// app/(app)/suppression/suppression-create-button.tsx

import {useState} from "react"
import {Button} from "@/components/ui/button"
import {Modal} from "@/components/ui/modal"
import {SuppressionForm} from "./suppression-form"

export function SuppressionCreateButton({variant = "primary"}: {variant?: "primary" | "secondary"}) {
	const [open, setOpen] = useState(false)
	return (
		<>
			<Button variant={variant} type="button" onClick={() => setOpen(true)}>+ Dodaj wykluczenie</Button>
			<Modal open={open} onClose={() => setOpen(false)} title="Dodaj wykluczenie">
				<SuppressionForm onSuccess={() => setOpen(false)} />
			</Modal>
		</>
	)
}
