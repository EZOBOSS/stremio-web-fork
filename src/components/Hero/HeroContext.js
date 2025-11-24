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
        throw new Error("useHero must be used within a HeroProvider");
    }
    return context;
};

export default HeroContext;
