// Copyright (C) 2017-2023 Smart code 203358507

import { useCallback, useEffect, useRef } from "react";

// Physics constants from infinite-scroll.plugin.js
const SCROLL_CONFIG = {
    FRICTION: 0.98,
    EASE: 0.02,
    WHEEL_FORCE: 0.35,
    MIN_VELOCITY: 0.05,
    THRESHOLD: 0.4,
    MAX_VELOCITY: 120,
};

/**
 * Custom hook for smooth, physics-based horizontal scrolling
 * Ported from infinite-scroll.plugin.js globalTick implementation
 *
 * @param {React.RefObject} containerRef - Ref to the scrollable container
 * @param {boolean} enabled - Whether smooth scroll is enabled
 */
const useSmoothScroll = (containerRef, enabled = true) => {
    // State refs for physics simulation
    const velocityRef = useRef(0);
    const scrollTargetRef = useRef(0);
    const currentScrollRef = useRef(0);
    const isAnimatingRef = useRef(false);
    const widthCacheRef = useRef({ scrollWidth: 0, clientWidth: 0 });
    const rafIdRef = useRef(null);

    // Animation loop - equivalent to globalTick
    const animate = useCallback(() => {
        if (!isAnimatingRef.current) return;

        const element = containerRef.current;
        if (!element) {
            isAnimatingRef.current = false;
            return;
        }

        const { FRICTION, EASE, MIN_VELOCITY, THRESHOLD } = SCROLL_CONFIG;
        const { scrollWidth, clientWidth } = widthCacheRef.current;

        // Phase 1: Read & Calculate
        const maxScroll = scrollWidth - clientWidth;
        const currentLeft = currentScrollRef.current;
        const diff = scrollTargetRef.current - currentLeft;

        // Apply friction to velocity
        let newVelocity = velocityRef.current * FRICTION;
        let newTarget = scrollTargetRef.current + newVelocity;

        // Calculate next position with easing
        const nextPos = Math.max(
            0,
            Math.min(currentLeft + diff * EASE, maxScroll)
        );

        // Check if we should stop
        const isStopped =
            Math.abs(diff) <= THRESHOLD &&
            Math.abs(newVelocity) <= MIN_VELOCITY;

        // Phase 2: Write
        element.scrollLeft = nextPos;
        currentScrollRef.current = nextPos;
        velocityRef.current = newVelocity;
        scrollTargetRef.current = newTarget;

        if (isStopped) {
            // Stop animation
            isAnimatingRef.current = false;
            velocityRef.current = 0;
            scrollTargetRef.current = element.scrollLeft;
            currentScrollRef.current = element.scrollLeft;
        } else {
            // Continue animation
            rafIdRef.current = requestAnimationFrame(animate);
        }
    }, [containerRef]);

    // Start animation loop
    const startAnimation = useCallback(() => {
        if (!isAnimatingRef.current) {
            isAnimatingRef.current = true;
            rafIdRef.current = requestAnimationFrame(animate);
        }
    }, [animate]);

    // Wheel event handler
    useEffect(() => {
        if (!enabled) return;

        const element = containerRef.current;
        if (!element) return;

        const handleWheel = (e) => {
            e.preventDefault();

            // Check boundaries
            const atStart = element.scrollLeft <= 0 && e.deltaY < 0;
            const atEnd =
                element.scrollLeft + widthCacheRef.current.clientWidth >=
                    widthCacheRef.current.scrollWidth && e.deltaY > 0;

            if (atStart || atEnd) return;

            const { WHEEL_FORCE, MAX_VELOCITY } = SCROLL_CONFIG;

            // Add to velocity
            velocityRef.current += e.deltaY * WHEEL_FORCE;
            velocityRef.current = Math.max(
                -MAX_VELOCITY,
                Math.min(velocityRef.current, MAX_VELOCITY)
            );

            // Start or sync animation
            if (!isAnimatingRef.current) {
                // Reset target to current position to avoid jumps
                scrollTargetRef.current = element.scrollLeft;
                currentScrollRef.current = element.scrollLeft;
                startAnimation();
            }
        };

        element.addEventListener("wheel", handleWheel, { passive: false });

        return () => {
            element.removeEventListener("wheel", handleWheel);
        };
    }, [enabled, containerRef, startAnimation]);

    // Track dimension changes with ResizeObserver
    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;

        const updateDimensions = () => {
            widthCacheRef.current = {
                scrollWidth: element.scrollWidth,
                clientWidth: element.clientWidth,
            };
        };

        // Initial update
        updateDimensions();

        const resizeObserver = new ResizeObserver(updateDimensions);
        resizeObserver.observe(element);

        return () => {
            resizeObserver.disconnect();
        };
    }, [containerRef]);

    // Sync with manual scrolls (e.g., from scrollbar drag)
    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;

        const handleScroll = () => {
            // If animation is running, check for user interference
            if (isAnimatingRef.current) {
                const diff = Math.abs(
                    element.scrollLeft - currentScrollRef.current
                );
                if (diff > 5) {
                    // User likely dragged the scrollbar - stop animation
                    scrollTargetRef.current = element.scrollLeft;
                    currentScrollRef.current = element.scrollLeft;
                    velocityRef.current = 0;
                    isAnimatingRef.current = false;
                    if (rafIdRef.current) {
                        cancelAnimationFrame(rafIdRef.current);
                        rafIdRef.current = null;
                    }
                }
            } else {
                // Not animating, just sync position
                scrollTargetRef.current = element.scrollLeft;
                currentScrollRef.current = element.scrollLeft;
            }
        };

        // Use capture phase to ensure we don't block other scroll listeners
        element.addEventListener("scroll", handleScroll, {
            passive: true,
            capture: false,
        });

        return () => {
            element.removeEventListener("scroll", handleScroll);
        };
    }, [containerRef]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (rafIdRef.current) {
                cancelAnimationFrame(rafIdRef.current);
            }
            isAnimatingRef.current = false;
        };
    }, []);
};

export default useSmoothScroll;
