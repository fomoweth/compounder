import { PoolFee } from "../constants/enums";

export const encodePath = (path: string[], fees: PoolFee[]): string => {
    const FEE_SIZE = 3;

    if (path.length !== fees.length + 1) {
        throw new Error("Invalid lengths of params");
    }

    let encoded = "0x";
    for (let i = 0; i < fees.length; i++) {
        encoded += path[i].slice(2);
        encoded += fees[i].toString(16).padStart(2 * FEE_SIZE, "0");
    }

    encoded += path[path.length - 1].slice(2);

    return encoded.toLowerCase();
};
