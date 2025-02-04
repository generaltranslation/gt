import { hashString } from "./hashJsxChildren";
import stringify from "fast-json-stable-stringify";

export default function hashTemplate(
    template: {
        [key: string]: string
    }
): string {
    return hashString(
        stringify(
            template
        )
    );
}