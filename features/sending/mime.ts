export interface MailInput {
	from: string
	to: string
	subject: string
	text: string
}

function toBase64Url(buf: Buffer): string {
	return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

const NON_ASCII = /[^\x00-\x7F]/

function encodeHeaderWord(value: string): string {
	if (!NON_ASCII.test(value)) return value
	return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`
}

// Wrap base64 body at 76 chars per line (RFC 2045).
function chunk76(s: string): string {
	return s.replace(/(.{76})/g, "$1\r\n")
}

export function buildRawMessage(input: MailInput): string {
	const bodyB64 = chunk76(Buffer.from(input.text, "utf8").toString("base64"))
	const headers = [
		`From: ${input.from}`,
		`To: ${input.to}`,
		`Subject: ${encodeHeaderWord(input.subject)}`,
		"MIME-Version: 1.0",
		'Content-Type: text/plain; charset="UTF-8"',
		"Content-Transfer-Encoding: base64",
	].join("\r\n")
	const message = `${headers}\r\n\r\n${bodyB64}`
	return toBase64Url(Buffer.from(message, "utf8"))
}
