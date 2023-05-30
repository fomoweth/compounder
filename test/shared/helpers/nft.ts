import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, BigNumberish, ContractReceipt } from "ethers";

import { getNft } from "./uniswap";

export const getNftBalance = async (
    ownerAddress: string
): Promise<BigNumber> => {
    const nft = getNft();
    const balance = await nft.balanceOf(ownerAddress);

    return balance;
};

export const getOwner = async (tokenId: BigNumberish): Promise<string> => {
    const nft = getNft();
    const ownerAddress = await nft.ownerOf(tokenId);

    return ownerAddress;
};

export const getTokenId = async (
    ownerAddress: string,
    index: number = 0
): Promise<BigNumber> => {
    const nft = getNft();
    const tokenId = await nft.tokenOfOwnerByIndex(ownerAddress, index);

    return tokenId;
};

export const getTokenIds = async (
    ownerAddress: string
): Promise<BigNumber[]> => {
    const nft = getNft();
    const balance = await nft.balanceOf(ownerAddress);
    const length = balance.toNumber();

    const tokenIds: BigNumber[] = [];

    for (let i = 0; i < length; i++) {
        const tokenId = await nft.tokenOfOwnerByIndex(ownerAddress, i);
        tokenIds.push(tokenId);
    }

    return tokenIds;
};

export const approveNft = async (
    tokenId: BigNumberish,
    spenderAddress: string,
    signer: SignerWithAddress
): Promise<ContractReceipt> => {
    const nft = getNft(signer);
    const { operator } = await nft.positions(tokenId);

    const tx = await nft.approve(spenderAddress, tokenId);
    const receipt = await tx.wait();

    if (operator !== spenderAddress) {
        throw new Error("Failed to approve NFT");
    }

    return receipt;
};

export const transferNft = async (
    tokenId: BigNumberish,
    recipientAddress: string,
    signer: SignerWithAddress
): Promise<ContractReceipt> => {
    const nft = getNft(signer);
    const tx = await nft["safeTransferFrom(address,address,uint256,bytes)"](
        signer.address,
        recipientAddress,
        tokenId,
        ""
    );
    const receipt = await tx.wait();

    return receipt;
};
