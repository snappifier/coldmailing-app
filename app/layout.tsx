// app/layout.tsx
import type {Metadata} from "next"
import "./globals.css"

export const metadata: Metadata = {
	title: "Cold Mailing",
	description: "Wewnętrzne narzędzie do cold-mailingu",
}

export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
	return (
		<html lang="pl" className="h-full antialiased">
			<body className="min-h-full bg-white text-zinc-900">{children}</body>
		</html>
	)
}
