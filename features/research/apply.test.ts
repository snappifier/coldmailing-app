import {describe, it, expect} from "vitest"
import {computeApply, toLeadUpdate} from "@/features/research/apply"

const FIELDS = [
	{key: "imie", label: "Imię", target: "contactPersonName", type: "TEXT", required: false, description: null},
	{key: "plec", label: "Płeć", target: "honorific", type: "GENDER", required: false, description: null},
	{key: "jakosc", label: "Jakość", target: "siteQuality", type: "NUMBER", required: false, description: null},
	{key: "mail", label: "Email", target: "email", type: "EMAIL", required: false, description: null},
	{key: "tel", label: "Tel", target: "CUSTOM", type: "TEXT", required: false, description: null},
	{key: "ocena", label: "Ocena", target: "score", type: "NUMBER", required: false, description: null},
] as never

const emptyLead = {contactPersonName: null, honorific: null, siteQuality: null, priority: null, score: null, email: null, contactRole: null, city: null, region: null, schoolType: null, aiHook: null, aiNotes: null, customFields: null}

describe("computeApply", () => {
	it("AUTO: empties applied, normalizes gender, clamps number, lowercases email", () => {
		const d = computeApply({lead: emptyLead, fields: FIELDS, mode: "AUTO", emailTaken: false, findings: {imie: " Jan Kowalski ", plec: "mężczyzna", jakosc: 9, mail: "DYR@Szkola.PL", tel: 123456}})
		const byKey = Object.fromEntries(d.applied.map((a) => [a.key, a.value]))
		expect(byKey.imie).toBe("Jan Kowalski")
		expect(byKey.plec).toBe("PAN")
		expect(byKey.jakosc).toBe(5)
		expect(byKey.mail).toBe("dyr@szkola.pl")
		expect(byKey.tel).toBe("123456")
		expect(d.proposed).toHaveLength(0)
	})

	it("AUTO: a set field becomes a proposal, not applied", () => {
		const d = computeApply({lead: {...emptyLead, honorific: "PANI"}, fields: FIELDS, mode: "AUTO", emailTaken: false, findings: {plec: "mężczyzna"}})
		expect(d.applied).toHaveLength(0)
		expect(d.proposed[0]).toMatchObject({key: "plec", value: "PAN", current: "PANI"})
	})

	it("MANUAL: everything is a proposal", () => {
		const d = computeApply({lead: emptyLead, fields: FIELDS, mode: "MANUAL", emailTaken: false, findings: {imie: "Anna"}})
		expect(d.applied).toHaveLength(0)
		expect(d.proposed.map((p) => p.key)).toContain("imie")
	})

	it("skips email when taken, unrecognized gender, and no-ops", () => {
		const d = computeApply({lead: {...emptyLead, contactPersonName: "Jan"}, fields: FIELDS, mode: "AUTO", emailTaken: true, findings: {mail: "x@y.pl", plec: "robot", imie: "Jan"}})
		const reasons = Object.fromEntries(d.skipped.map((s) => [s.key, s.reason]))
		expect(reasons.mail).toBeTruthy()
		expect(reasons.plec).toBeTruthy()
		expect(reasons.imie).toBeTruthy()
	})

	it("score: AUTO clamps 0-100, rounds, fills empty; a set score becomes a proposal", () => {
		const high = computeApply({lead: emptyLead, fields: FIELDS, mode: "AUTO", emailTaken: false, findings: {ocena: 150}})
		expect(high.applied.find((a) => a.key === "ocena")?.value).toBe(100)
		const low = computeApply({lead: emptyLead, fields: FIELDS, mode: "AUTO", emailTaken: false, findings: {ocena: -5}})
		expect(low.applied.find((a) => a.key === "ocena")?.value).toBe(0)
		const round = computeApply({lead: emptyLead, fields: FIELDS, mode: "AUTO", emailTaken: false, findings: {ocena: 73.6}})
		expect(round.applied.find((a) => a.key === "ocena")?.value).toBe(74)
		const set = computeApply({lead: {...emptyLead, score: 40}, fields: FIELDS, mode: "AUTO", emailTaken: false, findings: {ocena: 90}})
		expect(set.applied.find((a) => a.key === "ocena")).toBeUndefined()
		expect(set.proposed.find((p) => p.key === "ocena")).toMatchObject({value: 90, current: 40})
	})

	it("toLeadUpdate routes columns vs customFields and merges", () => {
		const {data, customFields} = toLeadUpdate(
			[{key: "imie", target: "contactPersonName", label: "", value: "Jan"}, {key: "tel", target: "CUSTOM", label: "", value: "123"}],
			{istniejace: "x"},
		)
		expect(data.contactPersonName).toBe("Jan")
		expect(customFields).toEqual({istniejace: "x", tel: "123"})
	})
})
