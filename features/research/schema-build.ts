import type {OutputField} from "@/features/research-types/schema"

export interface FindingsSchema {
	type: "object"
	additionalProperties: false
	properties: Record<string, Record<string, unknown>>
	required: string[]
}

export function buildFindingsSchema(fields: OutputField[]): FindingsSchema {
	const properties: Record<string, Record<string, unknown>> = {}
	const required: string[] = []
	for (const field of fields) {
		properties[field.key] = propertyFor(field)
		if (field.required) required.push(field.key)
	}
	return {type: "object", additionalProperties: false, properties, required}
}

function propertyFor(field: OutputField): Record<string, unknown> {
	const base: Record<string, unknown> = field.description ? {description: field.description} : {}
	switch (field.type) {
		case "NUMBER":
			return {...base, type: "number"}
		case "BOOLEAN":
			return {...base, type: "boolean"}
		case "EMAIL":
			return {...base, type: "string", format: "email"}
		case "GENDER":
			return {...base, type: "string", enum: ["PAN", "PANI"]}
		default:
			return {...base, type: "string"}
	}
}
