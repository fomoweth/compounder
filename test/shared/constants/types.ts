export type Mapping<T> = Record<string, T>;

export interface TokenModel {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    slot: number;
}

export interface UniswapV3Config {
    FACTORY: string;
    NFT: string;
    QUOTER_V2: string;
    ROUTER: string;
}
