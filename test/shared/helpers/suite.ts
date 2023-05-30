import tracer from "./tracer";

interface Config {
    title: string;
    tracer?: boolean;
    delay?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const makeSuite = (config: Config, tests: () => void): void => {
    if (!!config.tracer) {
        tracer.enable();
    }

    describe(config.title, () => {
        afterEach(async () => {
            await sleep(config.delay || 2000);
        });

        tests();
    });
};
