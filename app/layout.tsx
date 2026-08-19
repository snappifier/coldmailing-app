import type {Metadata} from "next"
import {Inter} from "next/font/google"
import {GeistMono} from "geist/font/mono"
import "./globals.css"

const inter = Inter({subsets: ["latin"], variable: "--font-inter", display: "swap"})

export const metadata: Metadata = {
	title: "Cold Mailing",
	description: "Wewnętrzne narzędzie do cold-mailingu",
}

// No-flash theme bootstrap: mirrors features/theme/resolve.ts resolveInitialTheme (stored "dark"/"light", else "dark"). Keep the two in sync.
const themeScript = `(function(){try{var t=localStorage.getItem("theme");document.documentElement.dataset.theme=(t==="dark"||t==="light")?t:"dark";}catch(e){document.documentElement.dataset.theme="dark";}})();`

export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
	return (
		<html lang="pl" data-theme="dark" className={`h-full antialiased ${inter.variable} ${GeistMono.variable}`} suppressHydrationWarning>
			<body className="min-h-full font-sans bg-bg text-fg">
				<script suppressHydrationWarning dangerouslySetInnerHTML={{__html: themeScript}} />
				{children}
			</body>
		</html>
	)
}
