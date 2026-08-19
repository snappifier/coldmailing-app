"use client"
import {useFormStatus} from "react-dom"
import {Button} from "@/components/ui/button"
import {Spinner} from "@/components/ui/spinner"

export function SignInButton() {
	const {pending} = useFormStatus()
	return (
		<Button className="w-full justify-center" type="submit" disabled={pending}>
			{pending ? (
				<Spinner className="size-4" />
			) : (
				<svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" aria-hidden><path fill="currentColor" d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81"></path></svg>
			)}
			Kontynuuj przez Google
		</Button>
	)
}
