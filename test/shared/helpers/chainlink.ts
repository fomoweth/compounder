import { ethers } from "hardhat";
import { BigNumber, constants } from "ethers";

import {
    FEED_REGISTRY,
    NATIVE_ADDRESS,
    WBTC_ADDRESS,
} from "../constants/addresses";
import { isSameAddress, isWrappedNative } from "../utils/addresses";
import { parseUnits } from "../utils/units";

import {
    IAggregator,
    IAggregator__factory,
    IFeedRegistry__factory,
} from "../../../typechain-types";

const { Zero, WeiPerEther: Ether } = constants;

const BTC_QUOTE = "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB";
const USD_QUOTE = "0x0000000000000000000000000000000000000348";

export const getLatestAnswerETH = async (
    tokenAddress: string
): Promise<BigNumber> => {
    if (!!isWrappedNative(tokenAddress)) return Ether;

    if (!!isSameAddress(tokenAddress, WBTC_ADDRESS)) {
        const wbtcBtcFeedAddress = await fetchAggregator(WBTC_ADDRESS, "BTC");
        const wbtcBtcFeed = getAggregator(wbtcBtcFeedAddress!);
        const btcEthFeedAddress = await fetchAggregator(BTC_QUOTE, "ETH");
        const btcEthFeed = getAggregator(btcEthFeedAddress!);

        const [wbtcBtcAnswer, btcEthAnswer] = await Promise.all([
            wbtcBtcFeed.latestAnswer(),
            btcEthFeed.latestAnswer(),
        ]);

        if (wbtcBtcAnswer.lte(Zero) || btcEthAnswer.lte(Zero)) return Zero;

        return wbtcBtcAnswer.mul(btcEthAnswer).div(parseUnits(1, 8));
    } else {
        let aggregatorAddress = await fetchAggregator(tokenAddress, "ETH");

        if (!!aggregatorAddress) {
            const aggregator = getAggregator(aggregatorAddress);

            const answer = await aggregator.latestAnswer();

            return answer.lte(Zero) ? Zero : answer;
        } else {
            aggregatorAddress = await fetchAggregator(tokenAddress, "USD");

            if (!aggregatorAddress) {
                throw new Error(`ChainLink Aggregator does not exist`);
            }

            const ethUsdFeedAddress = await fetchAggregator(
                NATIVE_ADDRESS,
                "USD"
            );
            const ethUsdFeed = getAggregator(ethUsdFeedAddress!);
            const aggregator = getAggregator(aggregatorAddress);

            const [ethAnswer, tokenAnswer] = await Promise.all([
                ethUsdFeed.latestAnswer(),
                aggregator.latestAnswer(),
            ]);

            if (ethAnswer.lte(Zero) || tokenAnswer.lte(Zero)) return Zero;

            return tokenAnswer.mul(Ether).div(ethAnswer);
        }
    }
};

const fetchAggregator = async (
    tokenAddress: string,
    quoteType: "BTC" | "ETH" | "USD"
): Promise<string | undefined> => {
    const feedRegistry = IFeedRegistry__factory.connect(
        FEED_REGISTRY,
        ethers.provider
    );

    let quote: string;

    switch (quoteType) {
        case "BTC":
            quote = BTC_QUOTE;
            break;

        case "ETH":
            quote = NATIVE_ADDRESS;
            break;

        case "USD":
            quote = USD_QUOTE;
            break;
    }

    try {
        const aggregatorAddress = await feedRegistry.getFeed(
            tokenAddress,
            quote
        );

        return aggregatorAddress;
    } catch (e) {}
};

const getAggregator = (aggregatorAddress: string): IAggregator => {
    const aggregator = IAggregator__factory.connect(
        aggregatorAddress,
        ethers.provider
    );

    return aggregator;
};
