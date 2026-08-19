import {randomBytes, createCipheriv, createDecipheriv} from "node:crypto"

function key(): Buffer {
	const raw = process.env.TOKEN_ENCRYPTION_KEY
	if (!raw) throw new Error("TOKEN_ENCRYPTION_KEY is not set")
	const buf = Buffer.from(raw, "base64")
	if (buf.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes (base64)")
	return buf
}

// Format: ivBase64:authTagBase64:ciphertextBase64
export function encryptSecret(plain: string): string {
	const iv = randomBytes(12)
	const cipher = createCipheriv("aes-256-gcm", key(), iv)
	const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
	const tag = cipher.getAuthTag()
	return [iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(":")
}

export function decryptSecret(enc: string): string {
	const [ivB64, tagB64, ctB64] = enc.split(":")
	if (!ivB64 || !tagB64 || !ctB64) throw new Error("Malformed ciphertext")
	const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"))
	decipher.setAuthTag(Buffer.from(tagB64, "base64"))
	return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8")
}
