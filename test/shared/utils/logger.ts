import chalk from "chalk";
import { BigNumber } from "ethers";

const replacer = (_key: string, value: any) => {
    if (!!value && typeof value === "object") {
        if (!Array.isArray(value)) {
            const obj = Object.assign({}, value);

            Object.entries(value).forEach(([key, val]) =>
                !!BigNumber.isBigNumber(val)
                    ? (obj[key] = val.toString())
                    : (obj[key] = val)
            );

            return obj;
        } else {
            return value.map((val) =>
                !!BigNumber.isBigNumber(val) ? val.toString() : val
            );
        }
    } else {
        return value;
    }
};

const parseArg = (arg: any) => {
    return !!arg && typeof arg === "object"
        ? JSON.stringify(arg, replacer, 4).replace(/"/g, "")
        : arg;
};

export const log = (...args: any[]) => {
    const title = args.shift() as string;
    const parsedArgs = args.map((arg) => parseArg(arg));

    console.log("");
    console.log(chalk.green(title), ...parsedArgs);
    console.log("");
};
