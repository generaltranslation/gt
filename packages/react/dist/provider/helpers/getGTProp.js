export default function getGTProp(child) {
    if (child && child.props && child.props["data-_gt"]) {
        return child.props["data-_gt"];
    }
    return null;
}
