import React, { createContext, useContext, useState } from "react";

const HeroContext = createContext(null);

export const HeroProvider = ({ children }) => {
    const [activeItem, setActiveItem] = useState(null);

    return (
        <HeroContext.Provider value={{ activeItem, setActiveItem }}>
            {children}
        </HeroContext.Provider>
    );
};

export const useHero = () => {
    const context = useContext(HeroContext);
    if (!context) {
        // Return safe defaults when used outside HeroProvider
        return {
            activeItem: null,
            setActiveItem: () => {}, // noop
        };
    }
    return context;
};

export default HeroContext;
