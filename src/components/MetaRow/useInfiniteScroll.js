// Copyright (C) 2017-2023 Smart code 203358507

import { useCallback, useRef, useState } from "react";

const CACHE_PREFIX = "scroll_cache_";
const CACHE_TTL = 1000 * 60 * 60 * 12; // 12 hours
const FETCH_TIMEOUT = 5000;

const useInfiniteScroll = (type, catalog = "top", initialItems = []) => {
    // Ensure initialItems is always an array
    const safeInitialItems = Array.isArray(initialItems) ? initialItems : [];

    const [items, setItems] = useState(safeInitialItems);
    const [isLoading, setIsLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const seenIdsRef = useRef(
        new Set(safeInitialItems.map((i) => i.id || i._id))
    );
    const cacheKeyRef = useRef(`catalog_${type}_${catalog}`);
    const cacheOffsetRef = useRef(0); // Track how many items loaded from cache/API

    // Cache helpers
    const getCachedData = useCallback(() => {
        try {
            const raw = localStorage.getItem(
                CACHE_PREFIX + cacheKeyRef.current
            );
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (Date.now() - data.timestamp > CACHE_TTL) {
                localStorage.removeItem(CACHE_PREFIX + cacheKeyRef.current);
                return null;
            }
            return data.value;
        } catch {
            return null;
        }
    }, []);

    const setCachedData = useCallback((data) => {
        try {
            const entry = { value: data, timestamp: Date.now() };
            localStorage.setItem(
                CACHE_PREFIX + cacheKeyRef.current,
                JSON.stringify(entry)
            );
        } catch (e) {
            console.warn("Cache quota exceeded");
        }
    }, []);

    // Fetch with timeout
    const safeFetch = useCallback(async (url, timeout = FETCH_TIMEOUT) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(id);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        } catch (err) {
            clearTimeout(id);
            throw err;
        }
    }, []);

    // Map API response to item format
    const mapToListItem = useCallback((m, itemType) => {
        return {
            id: m.id,
            type: m.type || itemType,
            name: m.name,
            poster:
                m.poster ||
                `https://images.metahub.space/background/medium/${m.id}/img`,
            background:
                m.background ||
                `https://images.metahub.space/background/medium/${m.id}/img`,
            logo: m.logo,
            posterShape: m.posterShape || "poster",
            deepLinks: {
                metaDetailsStream:
                    itemType === "movie"
                        ? `#/detail/${itemType}/${m.id}/${m.id}`
                        : `#/detail/${itemType}/${m.id}`,
                metaDetailsVideos:
                    itemType === "movie"
                        ? `#/detail/${itemType}/${m.id}/${m.id}`
                        : `#/detail/${itemType}/${m.id}`,
            },
            trailer: m?.trailers?.[0]?.source,
            imdbRating: m?.imdbRating,
            released: m?.released,
            description: m?.description,
            year: m?.year || m?.releaseInfo,
            runtime: m?.runtime,
            genres: m?.genres,
        };
    }, []);

    const loadMore = useCallback(
        async (limit = 15) => {
            // Only work on the board/home screen
            const isOnBoard =
                !window.location.hash ||
                window.location.hash === "#/" ||
                window.location.hash.startsWith("#/board");

            if (!isOnBoard || isLoading || !hasMore || !type) return;

            setIsLoading(true);

            try {
                const cachedData = getCachedData() || [];

                // Try to get next batch from cache using our tracked offset
                const availableCacheItems = cachedData.slice(
                    cacheOffsetRef.current,
                    cacheOffsetRef.current + limit
                );

                // Filter out duplicates from cache
                const newCachedItems = availableCacheItems.filter(
                    (item) => !seenIdsRef.current.has(item.id || item._id)
                );

                if (newCachedItems.length > 0) {
                    // Serve from cache
                    console.log(
                        `[useInfiniteScroll] Loading ${newCachedItems.length} items from cache (offset: ${cacheOffsetRef.current}, cache size: ${cachedData.length})`
                    );

                    newCachedItems.forEach((item) => {
                        seenIdsRef.current.add(item.id || item._id);
                    });

                    // Increment cache offset by the number of items we attempted to slice (not just new items)
                    // This ensures we move forward in the cache even if some were duplicates
                    cacheOffsetRef.current += limit;

                    setItems((prev) => [...prev, ...newCachedItems]);
                    setIsLoading(false);
                    return;
                }

                // Cache exhausted or empty, fetch from API
                const baseUrl = `https://cinemeta-catalogs.strem.io/top/catalog/${type}/${catalog}`;

                // Skip should be the total number of items we've loaded
                // This includes initial items + any items we've added (cache or API)
                const skip = items.length;
                const fetchUrl =
                    skip > 0
                        ? `${baseUrl}/skip=${skip}.json`
                        : `${baseUrl}.json`;

                console.log(
                    `[useInfiniteScroll] Fetching from ${fetchUrl} (cache exhausted, total loaded: ${skip})`
                );

                const json = await safeFetch(fetchUrl);

                if (!json || !json.metas || json.metas.length === 0) {
                    console.log("[useInfiniteScroll] No more items available");
                    setHasMore(false);
                    setIsLoading(false);
                    return;
                }

                // Filter duplicates
                const newItems = [];
                for (const meta of json.metas) {
                    if (!seenIdsRef.current.has(meta.id)) {
                        seenIdsRef.current.add(meta.id);
                        newItems.push(mapToListItem(meta, type));
                    }
                }

                if (newItems.length === 0) {
                    console.log("[useInfiniteScroll] No new unique items");
                    setHasMore(false);
                    setIsLoading(false);
                    return;
                }

                const updatedData = [...cachedData, ...newItems];
                setCachedData(updatedData);

                // Update cache offset to reflect the new cache size
                cacheOffsetRef.current = updatedData.length;

                setItems((prev) => [...prev, ...newItems]);

                console.log(
                    `[useInfiniteScroll] Added ${
                        newItems.length
                    } new items from API (total items now: ${
                        items.length + newItems.length
                    }, cache offset now: ${cacheOffsetRef.current})`
                );
            } catch (err) {
                console.error("[useInfiniteScroll] Fetch error", err);
                setHasMore(false);
            } finally {
                setIsLoading(false);
            }
        },
        [
            isLoading,
            hasMore,
            type,
            catalog,
            items.length,
            initialItems.length,
            getCachedData,
            setCachedData,
            safeFetch,
            mapToListItem,
        ]
    );

    return { items, isLoading, loadMore, hasMore };
};

export default useInfiniteScroll;
