// Copyright (C) 2017-2023 Smart code 203358507

import React from "react";
import styles from "./styles";

const ScrollIndicator = ({
    scrollLeft,
    scrollWidth,
    clientWidth,
    totalItems,
}) => {
    const maxScroll = scrollWidth - clientWidth;

    // Hide if no scroll
    if (maxScroll <= 0) {
        return null;
    }

    const threshold = 5;
    const atStart = scrollLeft <= threshold;
    const atEnd = scrollLeft >= maxScroll - threshold;

    // Calculate current item
    const itemWidth = totalItems > 0 ? scrollWidth / totalItems : 0;
    const currentItem =
        totalItems > 0 && itemWidth > 0
            ? Math.min(Math.floor(scrollLeft / itemWidth) + 1, totalItems)
            : 1;

    // Hide indicator if at both edges
    if (atStart && atEnd) {
        return null;
    }

    return (
        <div className={styles["scroll-indicator"]}>
            {!atStart && (
                <svg
                    className={styles["scroll-arrow-left"]}
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                >
                    <path
                        d="M15 18L9 12L15 6"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            )}
            {currentItem > 1 && (
                <span className={styles["scroll-count"]}>{currentItem}</span>
            )}
            {!atEnd && (
                <svg
                    className={styles["scroll-arrow-right"]}
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                >
                    <path
                        d="M9 18L15 12L9 6"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            )}
        </div>
    );
};

export default ScrollIndicator;
