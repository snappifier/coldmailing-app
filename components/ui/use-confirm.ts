"use client"
// components/ui/use-confirm.ts
import {createContext, useContext} from "react"
import type {ConfirmOptions} from "@/components/ui/confirm-state"

export type ConfirmFn = (o: ConfirmOptions) => Promise<boolean>
export const ConfirmContext = createContext<ConfirmFn | null>(null)

export function useConfirm(): ConfirmFn {
	const fn = useContext(ConfirmContext)
	if (!fn) throw new Error("useConfirm must be used within <ConfirmProvider>")
	return fn
}
