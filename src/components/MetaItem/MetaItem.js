// Copyright (C) 2017-2023 Smart code 203358507

import { default as Icon } from "@stremio/stremio-icons/react";
import classnames from "classnames";
import filterInvalidDOMProps from "filter-invalid-dom-props";
import {
    array,
    bool,
    func,
    number,
    object,
    oneOf,
    shape,
    string,
} from "prop-types";
import React, { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ICON_FOR_TYPE } from "stremio/common/CONSTANTS";
import useBinaryState from "stremio/common/useBinaryState";
import { default as Button } from "stremio/components/Button";
import { useHero } from "stremio/components/Hero/HeroContext";
import { default as Image } from "stremio/components/Image";
import Multiselect from "stremio/components/Multiselect";
import styles from "./styles";

const MetaItem = memo(
    ({
        className,
        type,
        name,
        poster,
        background,
        logo,
        posterShape,
        posterChangeCursor,
        progress,
        newVideos,
        options,
        deepLinks,
        dataset,
        optionOnSelect,
        onDismissClick,
        onPlayClick,
        watched,
        trailerStreams,
        ...props
    }) => {
        const { t } = useTranslation();
        const [menuOpen, onMenuOpen, onMenuClose] = useBinaryState(false);
        const { setActiveItem } = useHero();
        const hoverTimeoutRef = useRef(null);

        const href = useMemo(() => {
            return deepLinks
                ? typeof deepLinks.player === "string"
                    ? deepLinks.player
                    : typeof deepLinks.metaDetailsStreams === "string"
                    ? deepLinks.metaDetailsStreams
                    : typeof deepLinks.metaDetailsVideos === "string"
                    ? deepLinks.metaDetailsVideos
                    : null
                : null;
        }, [deepLinks]);
        const metaItemOnClick = useCallback(
            (event) => {
                if (event.nativeEvent.selectPrevented) {
                    event.preventDefault();
                } else if (typeof props.onClick === "function") {
                    props.onClick(event);
                }
            },
            [props.onClick]
        );
        const menuOnClick = useCallback((event) => {
            event.nativeEvent.selectPrevented = true;
        }, []);
        const menuOnSelect = useCallback(
            (event) => {
                if (typeof optionOnSelect === "function") {
                    optionOnSelect({
                        type: "select-option",
                        value: event.value,
                        dataset: dataset,
                        reactEvent: event.reactEvent,
                        nativeEvent: event.nativeEvent,
                    });
                }
            },
            [dataset, optionOnSelect]
        );
        const renderPosterFallback = useCallback(
            () => (
                <Icon
                    className={styles["placeholder-icon"]}
                    name={
                        ICON_FOR_TYPE.has(type)
                            ? ICON_FOR_TYPE.get(type)
                            : ICON_FOR_TYPE.get("other")
                    }
                />
            ),
            [type]
        );
        const renderMenuLabelContent = useCallback(
            () => <Icon className={styles["icon"]} name={"more-vertical"} />,
            []
        );

        const handleMouseEnter = useCallback(() => {
            hoverTimeoutRef.current = setTimeout(() => {
                const trailerStream = Array.isArray(trailerStreams)
                    ? trailerStreams.find((s) => s.ytId)
                    : null;

                setActiveItem({
                    id: props.id || (dataset && dataset.id),
                    type,
                    title: name,
                    background,
                    logo,
                    description: props.description, // Assuming description is passed or available
                    year: props.year || (dataset && dataset.year),
                    trailerVideoId: trailerStream
                        ? trailerStream.ytId
                        : props.trailer
                        ? props.trailer
                        : null,
                    // Add other metadata if available in props
                });
            }, 1000);
        }, [
            name,
            background,
            logo,
            type,
            props,
            dataset,
            trailerStreams,
            setActiveItem,
        ]);

        const handleMouseLeave = useCallback(() => {
            if (hoverTimeoutRef.current) {
                clearTimeout(hoverTimeoutRef.current);
            }
            setActiveItem(null);
        }, [setActiveItem]);

        useEffect(() => {
            return () => {
                if (hoverTimeoutRef.current) {
                    clearTimeout(hoverTimeoutRef.current);
                }
            };
        }, []);

        return (
            <Button
                title={name}
                href={href}
                {...filterInvalidDOMProps(props)}
                className={classnames(
                    className,
                    styles["meta-item-container"],
                    styles["poster-shape-poster"],
                    styles[`poster-shape-${posterShape}`],
                    { active: menuOpen }
                )}
                onClick={metaItemOnClick}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <div
                    className={classnames(styles["poster-container"], {
                        "poster-change-cursor": posterChangeCursor,
                    })}
                >
                    {onDismissClick ? (
                        <div
                            title={t("LIBRARY_RESUME_DISMISS")}
                            className={styles["dismiss-icon-layer"]}
                            onClick={onDismissClick}
                        >
                            <Icon
                                className={styles["dismiss-icon"]}
                                name={"close"}
                            />
                            <div className={styles["dismiss-icon-backdrop"]} />
                        </div>
                    ) : null}
                    {watched ? (
                        <div className={styles["watched-icon-layer"]}>
                            <Icon
                                className={styles["watched-icon"]}
                                name={"checkmark"}
                            />
                        </div>
                    ) : null}
                    <div className={styles["poster-image-layer"]}>
                        <Image
                            className={styles["poster-image"]}
                            src={background}
                            alt={" "}
                            renderFallback={renderPosterFallback}
                        />
                    </div>
                    <div className={styles["logo-layer"]}>
                        <Image
                            className={styles["logo-image"]}
                            src={logo}
                            alt={" "}
                            renderFallback={renderPosterFallback}
                        />
                    </div>
                    {onPlayClick ? (
                        <div
                            title={t("CONTINUE_WATCHING")}
                            className={styles["play-icon-layer"]}
                            onClick={onPlayClick}
                        >
                            <Icon
                                className={styles["play-icon"]}
                                name={"play"}
                            />
                            <div className={styles["play-icon-outer"]} />
                            <div className={styles["play-icon-background"]} />
                        </div>
                    ) : null}
                    {progress > 0 ? (
                        <div className={styles["progress-bar-layer"]}>
                            <div
                                className={styles["progress-bar"]}
                                style={{ width: `${progress}%` }}
                            />
                            <div
                                className={styles["progress-bar-background"]}
                            />
                        </div>
                    ) : null}
                    {newVideos > 0 ? (
                        <div className={styles["new-videos"]}>
                            <div className={styles["layer"]} />
                            <div className={styles["layer"]} />
                            <div className={styles["layer"]}>
                                <Icon className={styles["icon"]} name={"add"} />
                                <div className={styles["label"]}>
                                    {newVideos}
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>
                {!logo &&
                ((typeof name === "string" && name.length > 0) ||
                    (Array.isArray(options) && options.length > 0)) ? (
                    <div className={styles["title-bar-container"]}>
                        <div className={styles["title-label"]}>
                            {typeof name === "string" && name.length > 0
                                ? name
                                : ""}
                        </div>
                        {Array.isArray(options) && options.length > 0 ? (
                            <Multiselect
                                className={styles["menu-label-container"]}
                                renderLabelContent={renderMenuLabelContent}
                                options={options}
                                onOpen={onMenuOpen}
                                onClose={onMenuClose}
                                onSelect={menuOnSelect}
                                tabIndex={-1}
                                onClick={menuOnClick}
                            />
                        ) : null}
                    </div>
                ) : null}
            </Button>
        );
    }
);

MetaItem.displayName = "MetaItem";

MetaItem.propTypes = {
    className: string,
    type: string,
    name: string,
    poster: string,
    background: string,
    logo: string,
    posterShape: oneOf(["poster", "landscape", "square"]),
    posterChangeCursor: bool,
    progress: number,
    newVideos: number,
    options: array,
    deepLinks: shape({
        metaDetailsVideos: string,
        metaDetailsStreams: string,
        player: string,
    }),
    dataset: object,
    optionOnSelect: func,
    onDismissClick: func,
    onPlayClick: func,
    onClick: func,
    watched: bool,
    trailerStreams: array,
};

export default MetaItem;
