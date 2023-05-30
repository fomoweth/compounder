import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "ethers";
import { ethers } from "hardhat";

import { setNameTag } from "../helpers/tracer";

export const deployContract = async <T extends Contract>(
    name: string,
    deployer: SignerWithAddress,
    args?: any[],
    id?: string
): Promise<T> => {
    const contractFactory = await ethers.getContractFactory(name, deployer);
    const contract = await contractFactory.deploy(...(args || []));
    await contract.deployed();

    setNameTag(id || name, contract.address);

    return contract as T;
};

export const getContract = async <T extends Contract>(
    name: string,
    address: string,
    id?: string
): Promise<T> => {
    const contract = await ethers.getContractAt(name, address);

    setNameTag(id || name, contract.address);

    return contract as T;
};
