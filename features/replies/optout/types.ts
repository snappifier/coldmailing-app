export interface OptOutResult {
	optOut: boolean
	score: number
}

export interface OptOutDetector {
	detect(text: string): Promise<OptOutResult>
}
