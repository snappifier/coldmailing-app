"use client"
// app/(app)/placeholdery/placeholder-create-button.tsx

import {useState} from "react"
import {Button} from "@/components/ui/button"
import {Modal} from "@/components/ui/modal"
import {PlaceholderForm} from "./placeholder-form"

export function PlaceholderCreateButton({variant = "primary"}: {variant?: "primary" | "secondary"}) {
	const [open, setOpen] = useState(false)
	return (
		<>
			<Button variant={variant} type="button" onClick={() => setOpen(true)}>+ Nowy placeholder</Button>
			<Modal open={open} onClose={() => setOpen(false)} title="Nowy placeholder">
				<PlaceholderForm onSuccess={() => setOpen(false)} />
			</Modal>
		</>
	)
}
