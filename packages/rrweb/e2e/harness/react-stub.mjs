// Inert react stand-in for the harness import map: the harness calls the
// framework-agnostic createGTReplayer directly, so the React wrapper's imports
// just need to resolve, never run.
export const useEffect = () => {};
export const useRef = () => ({ current: null });
export default {};
