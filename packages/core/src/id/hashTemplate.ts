import { JsxChildren } from "../types";
import { hashJsxChildren, hashString } from "./hashJsxChildren";
import stringify from "fast-json-stable-stringify";

export default function hashTemplate(
    template: {
        [key: string]: { source: JsxChildren, [prop: string]: any }
    }
): string {
    return hashString(
        stringify(
            Object.fromEntries(
                Object.entries(template).map(([key, data]) => {
                    return [key, hashJsxChildren(data)]
                })
            )
        )
    );
}