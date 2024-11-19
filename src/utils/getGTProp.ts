export default function getGTProp(
    child: any
): { id: number, [key: string]: any } | null {
    if (child && typeof child === 'object' && child.props?.['data-_gt']) {
        return child.props['data-_gt'];
    } 
    return null;
}