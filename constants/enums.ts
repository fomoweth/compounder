export enum ChainId {
	MAINNET = 1,
	OPTIMISM = 10,
	POLYGON = 137,
	ARBITRUM = 42161
}

export enum PoolFee {
	LOWEST = 100,
	LOW = 500,
	MEDIUM = 3000,
	HIGH = 10000
}

export const TICK_SPACING: { [amount in PoolFee]: number } = {
	[PoolFee.LOWEST]: 1,
	[PoolFee.LOW]: 10,
	[PoolFee.MEDIUM]: 60,
	[PoolFee.HIGH]: 200,
}
