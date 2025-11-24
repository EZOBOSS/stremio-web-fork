import classnames from "classnames";
import React, { useCallback, useEffect, useRef, useState } from "react";
import useTranslate from "stremio/common/useTranslate";
import { useHero } from "./HeroContext";
import styles from "./styles";
import { useHeroData } from "./useHeroData";

const Hero = () => {
    const t = useTranslate();
    const { activeItem } = useHero();
    const heroTitles = useHeroData();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isAutoRotating, setIsAutoRotating] = useState(true);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const rotationIntervalRef = useRef(null);
    const ytPlayerRef = useRef(null);
    const playerContainerRef = useRef(null);

    const ROTATION_INTERVAL = 8000;

    const nextTitle = useCallback(() => {
        setIsTransitioning(true);
        setTimeout(() => {
            setCurrentIndex((prev) => (prev + 1) % heroTitles.length);
            setIsTransitioning(false);
        }, 400); // Sync with CSS transition
    }, [heroTitles.length]);

    const previousTitle = useCallback(() => {
        setIsTransitioning(true);
        setTimeout(() => {
            setCurrentIndex(
                (prev) => (prev - 1 + heroTitles.length) % heroTitles.length
            );
            setIsTransitioning(false);
        }, 400);
    }, [heroTitles.length]);

    const goToTitle = useCallback(
        (index) => {
            if (index === currentIndex) return;
            setIsTransitioning(true);
            setTimeout(() => {
                setCurrentIndex(index);
                setIsTransitioning(false);
            }, 400);
        },
        [currentIndex]
    );

    useEffect(() => {
        if (activeItem) {
            setIsAutoRotating(false);
            return;
        }

        setIsAutoRotating(true);
    }, [activeItem]);

    useEffect(() => {
        if (isAutoRotating && heroTitles.length > 0) {
            rotationIntervalRef.current = setInterval(
                nextTitle,
                ROTATION_INTERVAL
            );
        }
        return () => clearInterval(rotationIntervalRef.current);
    }, [isAutoRotating, heroTitles.length, nextTitle]);

    // YouTube Player Logic
    useEffect(() => {
        if (activeItem && activeItem.trailerVideoId) {
            if (!window.YT) {
                const tag = document.createElement("script");
                tag.src = "https://www.youtube.com/iframe_api";
                document.body.appendChild(tag);
            }

            const initPlayer = () => {
                if (
                    window.YT &&
                    window.YT.Player &&
                    playerContainerRef.current
                ) {
                    // Create a placeholder div inside the container
                    const placeholder = document.createElement("div");
                    playerContainerRef.current.appendChild(placeholder);

                    ytPlayerRef.current = new window.YT.Player(placeholder, {
                        videoId: activeItem.trailerVideoId,
                        width: "100%",
                        height: "100%",
                        playerVars: {
                            autoplay: 1,
                            controls: 0,
                            mute: 0,
                            loop: 1,
                            playlist: activeItem.trailerVideoId,
                            modestbranding: 1,
                            rel: 0,
                            playsinline: 1,
                        },
                        events: {
                            onReady: (event) => {
                                event.target.playVideo();
                                event.target.setVolume(15);
                            },
                        },
                    });
                }
            };

            if (window.YT && window.YT.Player) {
                initPlayer();
            } else {
                window.onYouTubeIframeAPIReady = initPlayer;
            }
        }

        return () => {
            if (ytPlayerRef.current) {
                try {
                    ytPlayerRef.current.destroy();
                } catch (e) {}
                ytPlayerRef.current = null;
            }
            // Clear the container
            if (playerContainerRef.current) {
                playerContainerRef.current.innerHTML = "";
            }
        };
    }, [activeItem]);

    const handleMouseEnter = () => setIsAutoRotating(false);
    const handleMouseLeave = () => !activeItem && setIsAutoRotating(true);

    if (heroTitles.length === 0) return null;

    const currentTitle = activeItem || heroTitles[currentIndex];
    const isTrailerPlaying = activeItem && activeItem.trailerVideoId;

    return (
        <div
            className={classnames(styles["hero-container"], {
                [styles["is-transitioning"]]: isTransitioning && !activeItem,
            })}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <div
                ref={playerContainerRef}
                className={styles["hero-player"]}
                style={{ display: isTrailerPlaying ? "block" : "none" }}
            />

            <img
                className={styles["hero-image"]}
                src={currentTitle.background}
                alt={`${currentTitle.title} background`}
                style={{ opacity: isTrailerPlaying ? 0 : 1 }}
            />
            <div className={styles["hero-overlay"]}>
                <img
                    className={styles["hero-overlay-image"]}
                    src={currentTitle.logo}
                    alt={`${currentTitle.title} logo`}
                />
                <p className={styles["hero-overlay-description"]}>
                    {currentTitle.description}
                </p>
                <div className={styles["hero-overlay-info"]}>
                    <p>{currentTitle.year}</p>
                    <p>{currentTitle.duration}</p>
                    <p>{currentTitle.seasons}</p>
                    {currentTitle.rating && currentTitle.rating !== "na" && (
                        <p className={styles["rating-item"]}>
                            <span className={styles["rating-text"]}>
                                ⭐ {currentTitle.rating}/10
                            </span>
                        </p>
                    )}
                </div>
                <div className={styles["hero-overlay-actions"]}>
                    <button
                        className={styles["hero-overlay-button-watch"]}
                        onClick={() =>
                            (window.location.href = `#/detail/${currentTitle.type}/${currentTitle.id}`)
                        }
                    >
                        ▶ Watch Now
                    </button>
                    <button
                        className={styles["hero-overlay-button"]}
                        onClick={() =>
                            (window.location.href = `#/detail/${currentTitle.type}/${currentTitle.id}`)
                        }
                    >
                        ⓘ More Info
                    </button>
                </div>
            </div>
            {!activeItem && (
                <>
                    <div className={styles["hero-controls"]}>
                        <button
                            onClick={() => setIsAutoRotating(!isAutoRotating)}
                        >
                            {isAutoRotating ? "Pause" : "Play"}
                        </button>
                        <button onClick={previousTitle}>◀</button>
                        <button onClick={nextTitle}>▶</button>
                    </div>
                    <div className={styles["hero-indicators"]}>
                        {heroTitles.map((_, index) => (
                            <div
                                key={index}
                                className={classnames(
                                    styles["hero-indicator"],
                                    {
                                        [styles["active"]]:
                                            index === currentIndex,
                                    }
                                )}
                                onClick={() => goToTitle(index)}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default Hero;
