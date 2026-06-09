// components/ui/toast-reducer.ts
export interface Toast {
	id: string
	title: string
	variant: "success" | "neutral"
}
export interface ToastState {
	toasts: Toast[]
}
export type ToastAction = {type: "add"; toast: Toast} | {type: "remove"; id: string}

export function toastReducer(state: ToastState, action: ToastAction): ToastState {
	switch (action.type) {
		case "add":
			return {toasts: [...state.toasts, action.toast]}
		case "remove":
			return {toasts: state.toasts.filter((t) => t.id !== action.id)}
	}
}
