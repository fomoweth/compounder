import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getAddress } from "../utils/addresses";

declare var hre: HardhatRuntimeEnvironment;

interface TracerOption {
    logs: boolean;
    calls: boolean;
    sstores: boolean;
    sloads: boolean;
    gasCost: boolean;
}

const DEFAULT_TRADER_OPTION: TracerOption = {
    logs: false,
    calls: true,
    sstores: false,
    sloads: false,
    gasCost: false,
};

const toggle = () => {
    hre.tracer.enabled = !hre.tracer.enabled;
};

const enable = (option: TracerOption = DEFAULT_TRADER_OPTION) => {
    hre.tracer.enabled = true;
    hre.tracer.calls = option.calls;
    hre.tracer.sstores = option.sstores;
    hre.tracer.sloads = option.sloads;
    hre.tracer.gasCost = option.gasCost;
};

const disable = () => {
    hre.tracer.enabled = false;
};

export const setNameTag = (id: string, address: string) => {
    if (!hre.tracer.nameTags[getAddress(address)]) {
        hre.tracer.nameTags[getAddress(address)] = id;
    }
};

export default {
    config: hre.tracer,
    toggle,
    enable,
    disable,
    setNameTag,
};
