export const MAX_BATCH = 200

export function partitionCandidates(candidateIds: string[], recentlyResearchedIds: Set<string>): {toQueue: string[]; skippedRecent: string[]} {
	const toQueue: string[] = []
	const skippedRecent: string[] = []
	for (const id of candidateIds) {
		if (recentlyResearchedIds.has(id)) skippedRecent.push(id)
		else toQueue.push(id)
	}
	return {toQueue, skippedRecent}
}

export function capBatch(ids: string[]): {capped: string[]; truncated: boolean} {
	return {capped: ids.slice(0, MAX_BATCH), truncated: ids.length > MAX_BATCH}
}
