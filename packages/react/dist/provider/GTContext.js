import { createContext, useContext } from 'react';
export const GTContext = createContext(undefined);
export default function useGTContext(errorString = 'useGTContext() must be used within a <GTProvider>!') {
    const context = useContext(GTContext);
    if (typeof context === 'undefined') {
        throw new Error(errorString);
    }
    return context;
}
