declare function Tx({ children, id, context, variables, variablesOptions, }: {
    children: any;
    id?: string;
    context?: string;
    [key: string]: any;
}): Promise<any>;
declare namespace Tx {
    var gtTransformation: string;
}
export default Tx;
//# sourceMappingURL=_Tx.d.ts.map