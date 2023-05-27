export type Mapping<T> = Record<string, T>;

export interface TokenModel {
    chainId: number;
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    logoURI?: string;
}
