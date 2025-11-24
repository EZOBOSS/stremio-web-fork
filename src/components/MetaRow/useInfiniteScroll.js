// Copyright (C) 2017-2023 Smart code 203358507

import { useCallback, useRef, useState } from "react";

const CACHE_PREFIX = "scroll_cache_";
const CACHE_TTL = 1000 * 60 * 60 * 12; // 12 hours
const FETCH_TIMEOUT = 5000;

const useInfiniteScroll = (type, catalog = "top", initialItems = []) => {
    const [items, setItems] = useState(initialItems);
    const [isLoading, setIsLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const seenIdsRef = useRef(new Set(initialItems.map((i) => i.id || i._id)));
    const cacheKeyRef = useRef(`catalog_${type}_${catalog}`);

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
            _id: m.id,
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
        };
    }, []);

    // Main fetch function - loads cache in batches or fetches from API
    const loadMore = useCallback(
        async (limit = 15) => {
            if (isLoading || !hasMore || !type) return;

            setIsLoading(true);

            try {
                const cachedData = getCachedData() || [];

                // Calculate how many items we've already loaded beyond initial items
                const cacheOffset = items.length - initialItems.length;

                // Try to get next batch from cache
                const availableCacheItems = cachedData.slice(
                    cacheOffset,
                    cacheOffset + limit
                );

                // Filter out duplicates from cache
                const newCachedItems = availableCacheItems.filter(
                    (item) => !seenIdsRef.current.has(item.id || item._id)
                );

                if (newCachedItems.length > 0) {
                    // Serve from cache
                    console.log(
                        `[useInfiniteScroll] Loading ${newCachedItems.length} items from cache`
                    );

                    newCachedItems.forEach((item) => {
                        seenIdsRef.current.add(item.id || item._id);
                    });

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

                setItems((prev) => [...prev, ...newItems]);

                console.log(
                    `[useInfiniteScroll] Added ${
                        newItems.length
                    } new items from API (total items now: ${
                        items.length + newItems.length
                    })`
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
