"use client"
// app/(app)/linie/linia-create-button.tsx

import {useState} from "react"
import {Button} from "@/components/ui/button"
import {Modal} from "@/components/ui/modal"
import {OfferingLineForm} from "./offering-line-form"

export function LiniaCreateButton({variant = "primary"}: {variant?: "primary" | "secondary"}) {
	const [open, setOpen] = useState(false)
	return (
		<>
			<Button variant={variant} type="button" onClick={() => setOpen(true)}>+ Nowa linia</Button>
			<Modal open={open} onClose={() => setOpen(false)} title="Nowa linia">
				<OfferingLineForm onSuccess={() => setOpen(false)} />
			</Modal>
		</>
	)
}
