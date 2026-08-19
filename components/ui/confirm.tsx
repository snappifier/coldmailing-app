"use client"
import {useCallback, useRef, useState} from "react"
import {defaultConfirmOptions, type ConfirmOptions, type ResolvedConfirm} from "@/components/ui/confirm-state"
import {ConfirmContext, type ConfirmFn} from "@/components/ui/use-confirm"
import {Button} from "@/components/ui/button"

export function ConfirmProvider({children}: {children: React.ReactNode}) {
	const dialogRef = useRef<HTMLDialogElement>(null)
	const resolver = useRef<((v: boolean) => void) | null>(null)
	const [opts, setOpts] = useState<ResolvedConfirm | null>(null)

	const confirm = useCallback<ConfirmFn>((o: ConfirmOptions) => {
		setOpts(defaultConfirmOptions(o))
		dialogRef.current?.showModal()
		return new Promise<boolean>((resolve) => {
			resolver.current = resolve
		})
	}, [])

	const settle = (v: boolean) => {
		dialogRef.current?.close()
		resolver.current?.(v)
		resolver.current = null
	}

	return (
		<ConfirmContext.Provider value={confirm}>
			{children}
			<dialog
				ref={dialogRef}
				onCancel={(e) => {e.preventDefault(); settle(false)}}
				className="m-auto w-[380px] max-w-[calc(100vw-32px)] rounded-lg border border-border-strong bg-surface-1 p-[18px] text-fg shadow-modal open:[animation:confirmIn_.2s_var(--ease-out-quart)] backdrop:bg-black/50 backdrop:backdrop-blur-[2px]"
			>
				{opts ? (
					<>
						<h3 className="text-[15px] font-semibold tracking-[-0.02em]">{opts.title}</h3>
						{opts.body ? <p className="mb-[18px] mt-1.5 text-[13px] text-fg-muted">{opts.body}</p> : <div className="mb-[18px]" />}
						<div className="flex justify-end gap-2">
							<Button variant="secondary" onClick={() => settle(false)}>{opts.cancelLabel}</Button>
							<Button variant={opts.danger ? "danger" : "primary"} onClick={() => settle(true)}>{opts.confirmLabel}</Button>
						</div>
					</>
				) : null}
			</dialog>
		</ConfirmContext.Provider>
	)
}
