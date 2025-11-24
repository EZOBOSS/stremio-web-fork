// Copyright (C) 2017-2025 Stremio

import { default as Icon } from "@stremio/stremio-icons/react";
import classNames from "classnames";
import PropTypes from "prop-types";
import React, { useEffect, useMemo, useRef, useState } from "react";
import useTranslate from "stremio/common/useTranslate";
import { Button } from "stremio/components";
import MetaRowPlaceholder from "./MetaRowPlaceholder";
import ScrollIndicator from "./ScrollIndicator";
import styles from "./styles";
import useInfiniteScroll from "./useInfiniteScroll";
import useSmoothScroll from "./useSmoothScroll";

const MetaRow = ({
    className = "",
    title,
    catalog,
    message,
    itemComponent: ItemComponent,
    notifications,
    enableInfiniteScroll = false,
    catalogType,
    catalogId,
}) => {
    const t = useTranslate();
    const containerRef = useRef(null);

    const catalogTitle = useMemo(
        () => title ?? t.catalogTitle(catalog),
        [title, catalog, t]
    );

    const initialItems = useMemo(
        () => catalog?.items ?? catalog?.content?.content ?? [],
        [catalog]
    );

    const {
        items: infiniteItems,
        isLoading,
        loadMore,
        hasMore,
    } = useInfiniteScroll(
        enableInfiniteScroll ? catalogType : null,
        catalogId || "top",
        initialItems
    );

    const items = enableInfiniteScroll ? infiniteItems : initialItems;

    const href = useMemo(
        () => catalog?.deepLinks?.discover ?? catalog?.deepLinks?.library,
        [catalog]
    );

    const [scrollPos, setScrollPos] = useState({
        scrollLeft: 0,
        scrollWidth: 0,
        clientWidth: 0,
    });

    // Smooth scroll physics
    useSmoothScroll(containerRef, true);

    // Track scroll for indicator
    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;

        let rafPending = false;

        const updateScrollPos = () => {
            // Throttle updates using RAF
            if (!rafPending) {
                rafPending = true;
                requestAnimationFrame(() => {
                    setScrollPos({
                        scrollLeft: element.scrollLeft,
                        scrollWidth: element.scrollWidth,
                        clientWidth: element.clientWidth,
                    });
                    rafPending = false;
                });
            }
        };

        updateScrollPos();
        element.addEventListener("scroll", updateScrollPos, { passive: true });
        return () => element.removeEventListener("scroll", updateScrollPos);
    }, [items]);

    // Load more as we scroll toward the end
    useEffect(() => {
        if (!enableInfiniteScroll || isLoading || !hasMore) return;

        const element = containerRef.current;
        if (!element) return;

        const handleScroll = () => {
            const threshold = element.clientWidth * 2;
            if (
                element.scrollLeft + element.clientWidth >=
                element.scrollWidth - threshold
            ) {
                loadMore();
            }
        };

        element.addEventListener("scroll", handleScroll, { passive: true });
        return () => element.removeEventListener("scroll", handleScroll);
    }, [enableInfiniteScroll, isLoading, hasMore, loadMore]);

    const showMessage = typeof message === "string" && message.length > 0;

    return (
        <div className={classNames(className, styles["meta-row-container"])}>
            <div className={styles["header-container"]}>
                {catalogTitle && (
                    <div
                        className={styles["title-container"]}
                        title={catalogTitle}
                    >
                        {catalogTitle}
                    </div>
                )}

                {href && (
                    <Button
                        className={styles["see-all-container"]}
                        title={t.string("BUTTON_SEE_ALL")}
                        href={href}
                        tabIndex={-1}
                    >
                        <span className={styles["label"]}>
                            {t.string("BUTTON_SEE_ALL")}
                        </span>
                        <Icon
                            className={styles["icon"]}
                            name="chevron-forward"
                        />
                    </Button>
                )}
            </div>

            {showMessage ? (
                <div className={styles["message-container"]} title={message}>
                    {message}
                </div>
            ) : (
                <div
                    className={styles["meta-items-container"]}
                    ref={containerRef}
                >
                    {ItemComponent &&
                        items.map((item, index) => (
                            <ItemComponent
                                key={item.id ?? index}
                                {...item}
                                className={classNames(
                                    styles["meta-item"],
                                    styles["poster-shape-poster"],
                                    styles[`poster-shape-${item.posterShape}`]
                                )}
                                notifications={notifications}
                            />
                        ))}

                    <ScrollIndicator
                        scrollLeft={scrollPos.scrollLeft}
                        scrollWidth={scrollPos.scrollWidth}
                        clientWidth={scrollPos.clientWidth}
                        totalItems={items.length}
                    />
                </div>
            )}
        </div>
    );
};

MetaRow.Placeholder = MetaRowPlaceholder;

MetaRow.propTypes = {
    className: PropTypes.string,
    title: PropTypes.string,
    message: PropTypes.string,
    catalog: PropTypes.object,
    itemComponent: PropTypes.elementType,
    notifications: PropTypes.object,
    enableInfiniteScroll: PropTypes.bool,
    catalogType: PropTypes.string,
    catalogId: PropTypes.string,
};

export default MetaRow;
