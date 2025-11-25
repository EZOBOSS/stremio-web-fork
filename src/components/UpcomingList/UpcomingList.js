import classnames from "classnames";
import React from "react";
import useSmoothScroll from "../MetaRow/useSmoothScroll";
import styles from "./styles.less";
import useUpcomingList from "./useUpcomingList";

const UpcomingCard = ({ item }) => {
    const {
        id,
        href,
        title,
        poster,
        logo,
        isNewSeason,
        releaseText,
        episodeText,
        videos,
        trailer,
        description,
        rating,
        year,
        runtime,
        genres,
        releaseDate,
    } = item;

    const upcomingSeasonNumber = isNewSeason ? videos[0]?.season : 0;
    const isFuture = new Date(releaseDate) > new Date();

    return (
        <a
            tabIndex="0"
            className={classnames(styles["upcoming-card"], {
                [styles["new-season"]]: isNewSeason,
                [styles["future"]]: isFuture,
            })}
            href={href}
            data-trailer-url={trailer || ""}
            data-description={description || ""}
            id={id}
            data-rating={rating || ""}
            data-year={year || ""}
            data-runtime={runtime || ""}
            data-genres={genres || ""}
        >
            <div className={styles["upcoming-background-container"]}>
                <img src={poster} alt={title} loading="lazy" />
            </div>
            {videos && videos.length > 0 && (
                <div className={styles["upcoming-episodes-container"]}>
                    {videos.map((ep, index) => (
                        <div
                            key={`${ep.season}-${ep.episode}-${index}`}
                            className={classnames(
                                styles["upcoming-episode-card"],
                                styles[ep.stateClass]
                            )}
                        >
                            <div className={styles["upcoming-episode-number"]}>
                                {ep.episode}
                            </div>
                            <div className={styles["upcoming-episode-title"]}>
                                {ep.name || "Untitled"}
                            </div>
                            <div className={styles["upcoming-episode-date"]}>
                                {ep.formattedDate.day}
                                <br />
                                {ep.formattedDate.month}
                            </div>
                            {ep.watched && (
                                <div
                                    className={
                                        styles["upcoming-episode-watched-tag"]
                                    }
                                >
                                    &#x2713;
                                </div>
                            )}
                            <div
                                className={styles["upcoming-episode-thumbnail"]}
                            >
                                {ep.thumbnail ? (
                                    <img
                                        src={ep.thumbnail}
                                        alt=""
                                        loading="lazy"
                                        onError={(e) =>
                                            (e.target.style.display = "none")
                                        }
                                    />
                                ) : (
                                    <div
                                        className={
                                            styles[
                                                "upcoming-episode-placeholder"
                                            ]
                                        }
                                    >
                                        No image
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className={styles["upcoming-info"]}>
                <img
                    className={styles["upcoming-logo"]}
                    src={logo}
                    alt={title}
                    loading="lazy"
                />
                {isNewSeason && (
                    <div className={styles["upcoming-new-season"]}>
                        SEASON {upcomingSeasonNumber} PREMIERE
                    </div>
                )}
                <div className={styles["upcoming-release-date"]}>
                    {releaseText}
                </div>
                <div className={styles["upcoming-episode"]}>{episodeText}</div>
            </div>
        </a>
    );
};

const UpcomingList = () => {
    const { upcoming, loading, mode, setMode } = useUpcomingList();
    const scrollContainerRef = React.useRef(null);
    const indicatorRef = React.useRef(null);
    const groupRefs = React.useRef({});

    // Group upcoming items by releaseText
    const groupedByDate = React.useMemo(() => {
        const groups = {};
        upcoming.forEach((item) => {
            const dateKey = item.releaseText || "Unknown";
            if (!groups[dateKey]) {
                groups[dateKey] = [];
            }
            groups[dateKey].push(item);
        });
        return groups;
    }, [upcoming]);

    // Set initial indicator text
    React.useEffect(() => {
        if (indicatorRef.current && Object.keys(groupedByDate).length > 0) {
            indicatorRef.current.innerText = Object.keys(groupedByDate)[0];
        }
    }, [groupedByDate]);

    // Intersection Observer for updating active group
    React.useEffect(() => {
        const observerOptions = {
            root: scrollContainerRef.current,
            rootMargin: "0px -50% 0px -50%",
            threshold: 0,
        };

        const observerCallback = (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const dateKey = entry.target.dataset.dateKey;
                    if (dateKey && indicatorRef.current) {
                        indicatorRef.current.innerText = dateKey;
                    }
                }
            });
        };

        const observer = new IntersectionObserver(
            observerCallback,
            observerOptions
        );

        Object.values(groupRefs.current).forEach((el) => {
            if (el) observer.observe(el);
        });

        return () => observer.disconnect();
    }, [groupedByDate]);

    // Smooth horizontal scrolling with physics
    useSmoothScroll(scrollContainerRef, upcoming.length > 0);

    if (loading && !upcoming.length) {
        return (
            <div className={styles["upcoming-list"]}>
                <div
                    className={classnames(
                        styles["upcoming-list"],
                        styles[" upcoming-loading"]
                    )}
                >
                    <div className={styles["loading-spinner"]}></div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles["upcoming-wrapper"]}>
            <div className={styles["upcoming-vertical-tab"]}>
                <span>UPCOMING</span>
            </div>
            <div className={styles["upcoming-container"]}>
                {Object.keys(groupedByDate).length > 0 && (
                    <div
                        ref={indicatorRef}
                        className={styles["floating-date-indicator"]}
                    />
                )}
                <div className={styles["upcoming-toggle-bar"]}>
                    <button
                        className={classnames(styles["toggle-btn"], {
                            [styles["active"]]: mode === "all",
                        })}
                        onClick={() => setMode("all")}
                        aria-label="Popular"
                    >
                        <span className={styles["btn-icon"]} aria-hidden="true">
                            <svg
                                viewBox="0 0 24 24"
                                width="18"
                                height="18"
                                fill="currentColor"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                            </svg>
                        </span>
                        <span className={styles["btn-label"]}>Popular</span>
                    </button>
                    <button
                        className={classnames(styles["toggle-btn"], {
                            [styles["active"]]: mode === "library",
                        })}
                        onClick={() => setMode("library")}
                        aria-label="My Library"
                    >
                        <span className={styles["btn-icon"]} aria-hidden="true">
                            <svg
                                viewBox="0 0 24 24"
                                width="18"
                                height="18"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    d="M3 6.5A1.5 1.5 0 014.5 5h3.55l1.2 1.6H19a1 1 0 011 1V18.5A1.5 1.5 0 0118.5 20h-14A1.5 1.5 0 013 18.5v-12z"
                                    fill="currentColor"
                                />
                                <path
                                    d="M10 9.5v5l4-2.5-4-2.5z"
                                    fill="#fff"
                                    opacity="0.95"
                                />
                            </svg>
                        </span>
                        <span className={styles["btn-label"]}>My Library</span>
                    </button>
                </div>

                <div className={styles["upcoming-list"]}>
                    {!upcoming.length ? (
                        <div
                            className={classnames(
                                styles["upcoming-list"],
                                styles["empty"]
                            )}
                        >
                            <p>No upcoming releases found.</p>
                        </div>
                    ) : (
                        <div
                            ref={scrollContainerRef}
                            className={styles["upcoming-groups-container"]}
                        >
                            {Object.entries(groupedByDate).map(
                                ([dateKey, items]) => (
                                    <div
                                        key={dateKey}
                                        data-date-key={dateKey}
                                        ref={(el) =>
                                            (groupRefs.current[dateKey] = el)
                                        }
                                        className={
                                            styles["upcoming-date-group"]
                                        }
                                    >
                                        <h3
                                            className={
                                                styles["date-group-title"]
                                            }
                                        >
                                            {dateKey}
                                        </h3>
                                        <div
                                            className={styles["upcoming-grid"]}
                                        >
                                            {items.map((m) => (
                                                <UpcomingCard
                                                    key={m.id}
                                                    item={m}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UpcomingList;
