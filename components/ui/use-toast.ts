"use client"
// components/ui/use-toast.ts
import {createContext, useContext} from "react"

export type ToastFn = (title: string, variant?: "success" | "neutral") => void
export const ToastContext = createContext<ToastFn | null>(null)

export function useToast(): ToastFn {
	const fn = useContext(ToastContext)
	if (!fn) throw new Error("useToast must be used within <ToastProvider>")
	return fn
}
