"use client"
import {useCallback, useReducer, useRef} from "react"
import {toastReducer} from "@/components/ui/toast-reducer"
import {ToastContext, type ToastFn} from "@/components/ui/use-toast"
import {CheckIcon} from "@/components/ui/icons"
import {cn} from "@/lib/cn"

export function ToastProvider({children}: {children: React.ReactNode}) {
	const [state, dispatch] = useReducer(toastReducer, {toasts: []})
	const seq = useRef(0)
	const toast = useCallback<ToastFn>((title, variant = "success") => {
		const id = String(++seq.current)
		dispatch({type: "add", toast: {id, title, variant}})
		setTimeout(() => dispatch({type: "remove", id}), 2600)
	}, [])
	return (
		<ToastContext.Provider value={toast}>
			{children}
			<div className="fixed bottom-[18px] right-[18px] z-[60] flex flex-col gap-2">
				{state.toasts.map((t) => (
					<div key={t.id} className="flex min-w-[240px] items-center gap-2.5 rounded-md border border-border-strong bg-surface-1 px-3 py-2.5 text-[13px] text-fg shadow-pop [animation:toastIn_.3s_var(--ease-out)]">
						<span className={cn("grid size-[18px] flex-none place-items-center rounded-full", t.variant === "success" ? "bg-success-quiet text-success" : "bg-surface-3 text-fg-muted")}>
							<CheckIcon className="size-3" />
						</span>
						{t.title}
					</div>
				))}
			</div>
		</ToastContext.Provider>
	)
}
