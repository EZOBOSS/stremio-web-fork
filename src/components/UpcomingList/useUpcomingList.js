import { useCallback, useEffect, useRef, useState } from "react";

const CONFIG = {
    FETCH_TIMEOUT: 5000,
    CACHE_TTL: 1000 * 60 * 60 * 12, // 12 hours
    CACHE_PREFIX: "upcoming_cache_",
    VIDEO_CACHE_EXPIRY_MS: 14 * 24 * 60 * 60 * 1000, // 14 days
    VIDEO_CACHE_PREFIX: "videos_cache_",
    CACHE_DEBOUNCE_MS: 500,
    DAY_BUFFER: 86400000 * 4, // 4 days
    BATCH_SIZE: 50,
    MAX_CACHE_ENTRIES: 200,
    URLS: {
        CINEMETA_CATALOG: "https://cinemeta-catalogs.strem.io/top/catalog",
        CINEMETA_META: "https://cinemeta-live.strem.io/meta",
        POSTER: "https://images.metahub.space/background/large",
        LOGO: "https://images.metahub.space/logo/medium",
    },
    STORAGE_KEYS: {
        LIBRARY_RECENT: "library_recent",
        UPCOMING_MODE: "upcoming_mode",
    },
};

const useUpcomingList = () => {
    const [upcoming, setUpcoming] = useState([]);
    const [loading, setLoading] = useState(true);
    const [mode, setMode] = useState(() => {
        return localStorage.getItem(CONFIG.STORAGE_KEYS.UPCOMING_MODE) || "all";
    });

    const videoMemoryCache = useRef(null);
    const libraryRecentCache = useRef(null);
    const videoCacheTimeoutId = useRef(null);
    const intlDateTimeFormat = useRef(
        new Intl.DateTimeFormat("en-GB", {
            month: "short",
            timeZone: "UTC",
        })
    );

    // --- Cache Methods ---

    const cacheKey = (key) => CONFIG.CACHE_PREFIX + key;
    const videoCacheKey = CONFIG.VIDEO_CACHE_PREFIX + "all";

    const cacheSet = useCallback((key, value) => {
        const entry = { value, timestamp: Date.now() };
        // In a hook, we might rely on state, but for caching across reloads we need localStorage
        // We can skip memory cache for simplicity or use a ref if needed for this session
        try {
            localStorage.setItem(cacheKey(key), JSON.stringify(entry));
        } catch (e) {
            console.warn("[UpcomingReleases] LocalStorage error:", e);
        }
    }, []);

    const cacheGet = useCallback((key) => {
        const now = Date.now();
        try {
            const raw = localStorage.getItem(cacheKey(key));
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (now - data.timestamp > CONFIG.CACHE_TTL) {
                localStorage.removeItem(cacheKey(key));
                return null;
            }
            return data.value;
        } catch {
            return null;
        }
    }, []);

    const loadVideoCache = useCallback(() => {
        if (videoMemoryCache.current) return videoMemoryCache.current;

        try {
            const raw = localStorage.getItem(videoCacheKey);
            const cache = raw ? JSON.parse(raw) : {};
            const now = Date.now();
            let dirty = false;

            for (const k in cache) {
                if (now - cache[k].timestamp > CONFIG.VIDEO_CACHE_EXPIRY_MS) {
                    delete cache[k];
                    dirty = true;
                }
            }

            const entries = Object.entries(cache);
            if (entries.length > CONFIG.MAX_CACHE_ENTRIES) {
                entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
                const toKeep = entries.slice(-CONFIG.MAX_CACHE_ENTRIES);
                const newCache = {};
                for (const [key, value] of toKeep) {
                    newCache[key] = value;
                }
                videoMemoryCache.current = newCache;
                saveVideoCache(newCache);
                return newCache;
            }

            if (dirty) saveVideoCache(cache);

            videoMemoryCache.current = cache;
            return cache;
        } catch (err) {
            videoMemoryCache.current = {};
            return {};
        }
    }, []);

    const saveVideoCache = useCallback((cache) => {
        if (!cache) return;
        try {
            localStorage.setItem(videoCacheKey, JSON.stringify(cache));
            videoMemoryCache.current = cache;
        } catch (err) {
            console.warn("[UpcomingReleases] Failed to save video cache", err);
        }
    }, []);

    const videoCacheSet = useCallback(
        (key, value) => {
            const cache = loadVideoCache();
            cache[key] = { value, timestamp: Date.now() };

            if (videoCacheTimeoutId.current) {
                clearTimeout(videoCacheTimeoutId.current);
            }
            videoCacheTimeoutId.current = setTimeout(() => {
                saveVideoCache(cache);
                videoCacheTimeoutId.current = null;
            }, CONFIG.CACHE_DEBOUNCE_MS);
        },
        [loadVideoCache, saveVideoCache]
    );

    const videoCacheGet = useCallback(
        (key) => {
            const cache = loadVideoCache();
            const entry = cache[key];
            return entry ? entry.value : null;
        },
        [loadVideoCache]
    );

    // --- Helper Methods ---

    const safeFetch = useCallback(
        async (url, { timeout = CONFIG.FETCH_TIMEOUT, retries = 1 } = {}) => {
            let attempt = 0;
            while (attempt <= retries) {
                attempt++;
                const controller = new AbortController();
                const id = setTimeout(() => controller.abort(), timeout);
                try {
                    const res = await fetch(url, { signal: controller.signal });
                    clearTimeout(id);
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return res.json();
                } catch (err) {
                    clearTimeout(id);
                    if (attempt > retries) throw err;
                    await new Promise((r) => setTimeout(r, 300 * attempt));
                }
            }
        },
        []
    );

    const formatDaysUntil = useCallback((dateMs, now = Date.now()) => {
        const dayMs = 86400000;
        const diff = Math.ceil((dateMs - now) / dayMs);

        if (diff < 0) {
            const absoluteDaysDiff = Math.abs(diff);
            if (absoluteDaysDiff === 1) return "Yesterday";
            return `${absoluteDaysDiff} days ago`;
        }
        if (diff === 0) return "Today";
        if (diff === 1) return "Tomorrow";
        if (diff < 30) return `in ${diff} days`;
        if (diff < 365) {
            const months = Math.round(diff / 30);
            return `in ${months} month${months > 1 ? "s" : ""}`;
        }
        const years = Math.round(diff / 365);
        return `in ${years} year${years > 1 ? "s" : ""}`;
    }, []);

    const formatDate = useCallback((dateString) => {
        const date = new Date(dateString);
        const day = date.getUTCDate();
        const month = intlDateTimeFormat.current.format(date);
        return { day, month };
    }, []);

    const batchPromiseAllSettled = useCallback(
        async (promiseFns, batchSize = CONFIG.BATCH_SIZE) => {
            const results = [];
            for (let i = 0; i < promiseFns.length; i += batchSize) {
                const batch = promiseFns.slice(i, i + batchSize);
                const batchPromises = batch.map((fn) => fn());
                const batchResults = await Promise.allSettled(batchPromises);
                results.push(...batchResults);
            }
            return results;
        },
        []
    );

    // --- Data Logic ---

    const getUserLibrarySeries = useCallback(() => {
        if (libraryRecentCache.current) return libraryRecentCache.current;

        try {
            const raw = localStorage.getItem(
                CONFIG.STORAGE_KEYS.LIBRARY_RECENT
            );
            if (!raw) return [];
            const library = JSON.parse(raw);
            const libraryItems = Object.values(library.items || {});

            const filtered = libraryItems.filter((item) => {
                if (item?.type !== "series") return false;
                if (!item?._id?.startsWith("tt")) return false;

                const watched = item?.state?.watched;
                if (!watched) return false;

                const [, s, e] = watched.split(":");
                return +s > 1 || +e > 1;
            });

            libraryRecentCache.current = filtered;
            return filtered;
        } catch (err) {
            console.warn(
                "[UpcomingReleases] Failed to read library_recent",
                err
            );
            return [];
        }
    }, []);

    const getUserData = useCallback((list) => {
        const recentStr = localStorage.getItem(
            CONFIG.STORAGE_KEYS.LIBRARY_RECENT
        );
        if (!recentStr) return list;

        let recent;
        try {
            recent = JSON.parse(recentStr);
        } catch {
            return list;
        }

        const recentItems = recent.items;
        if (!recentItems) return list;

        for (const item of list) {
            if (item.type !== "series") continue;

            const lib = recentItems[item.id];
            if (!lib) continue;

            const watchedState = lib.state && lib.state.watched;
            if (!watchedState) continue;

            const parts = watchedState.split(":", 3);
            if (parts.length < 3) continue;

            const season = +parts[1];
            const episode = +parts[2];

            item.watched = watchedState;

            const videos = item.videos;
            if (!videos) continue;

            const seasonVideos = videos.filter((v) => v.season === season);
            if (!seasonVideos.length) continue;

            for (const v of seasonVideos) {
                if (v.episode <= episode) {
                    v.watched = true;
                }
            }
        }
        return list;
    }, []);

    const getClosestFutureVideo = useCallback((meta) => {
        const now = Date.now();
        const threshold = now - CONFIG.DAY_BUFFER;
        const futureVideos = [];

        if (meta.released) {
            const d = Date.parse(meta.released);
            if (d > threshold) {
                futureVideos.push({
                    dateMs: d,
                    video: {
                        released: meta.released,
                        season: 0,
                        episode: 0,
                        title: "Series Release",
                    },
                });
            }
        }

        if (Array.isArray(meta.videos)) {
            for (const v of meta.videos) {
                if (v.released) {
                    const vd = Date.parse(v.released);
                    if (vd > threshold && v.watched !== true) {
                        futureVideos.push({ dateMs: vd, video: v });
                    }
                }
            }
        }

        if (!futureVideos.length) return null;
        return futureVideos.reduce((min, curr) =>
            curr.dateMs < min.dateMs ? curr : min
        );
    }, []);

    const refreshWatchedState = useCallback(
        (cache) => {
            if (!Array.isArray(cache)) return [];

            const enriched = getUserData(cache);
            const updated = [];
            const now = Date.now();

            for (const m of enriched) {
                const closest = getClosestFutureVideo(m);
                if (!closest) continue;

                const { dateMs, video } = closest;
                const episodeText =
                    video.season > 0 && video.episode > 0
                        ? `S${video.season} E${video.episode}`
                        : "Movie";

                m.releaseDate = new Date(dateMs);
                m.releaseText = formatDaysUntil(dateMs, now);
                m.isNewSeason = video.episode === 1;
                m.episodeText = episodeText;

                updated.push(m);
            }

            updated.sort((a, b) => a.releaseDate - b.releaseDate);
            return updated;
        },
        [getUserData, getClosestFutureVideo, formatDaysUntil]
    );

    const mapToListItem = useCallback((m, type) => {
        return {
            id: m.id,
            title: m.name,
            imdbRating: m.imdbRating,
            genres: Array.isArray(m.genre)
                ? m.genre
                : Array.isArray(m.genres)
                ? m.genres
                : [],
            description: m.description || `Discover ${m.name}`,
            year: String(m.year || "2024"),
            runtime: m.runtime || null,
            type: m.type || type,
            trailer: m?.trailers?.[0]?.source,
            videos: m.videos || [],
            releaseInfo: m.releaseInfo,
        };
    }, []);

    const processMetasToList = useCallback(
        (metas) => {
            const list = [];
            const posterBase = CONFIG.URLS.POSTER;
            const logoBase = CONFIG.URLS.LOGO;
            const thresholdMs = Date.now() - CONFIG.DAY_BUFFER;

            for (const m of metas) {
                const closest = getClosestFutureVideo(m);
                if (!closest) continue;

                const { dateMs, video } = closest;
                const isSeries = video.season > 0 && video.episode > 0;
                const id = m.id || m._id;

                const episodeText = isSeries
                    ? `S${video.season} E${video.episode}`
                    : "Movie";
                const href = isSeries
                    ? `#/detail/${m.type}/${id}`
                    : `#/detail/${m.type}/${id}/${id}`;
                const isNewSeason = video.episode === 1;

                const latestSeasonVideos = isSeries
                    ? m.videos.filter(
                          (v) =>
                              v.season === video.season ||
                              (v.season === 0 && v.episode === 0)
                      )
                    : [];

                // Format episodes for display
                const formattedVideos = latestSeasonVideos.map((ep) => {
                    const released = Date.parse(ep.released) <= thresholdMs;
                    const isWatched = ep.watched;
                    let stateClass = "released";
                    if (isWatched) stateClass += " watched";

                    let nextUp = null;
                    const match = episodeText?.match(/^S(\d+)\sE(\d+)$/);
                    if (match) {
                        nextUp = { season: +match[1], episode: +match[2] };
                    }

                    if (!released && !isWatched) {
                        if (
                            nextUp &&
                            ep.season === nextUp.season &&
                            ep.episode === nextUp.episode
                        ) {
                            stateClass = "upcoming-next";
                        } else {
                            stateClass = "upcoming";
                        }
                    }

                    return {
                        ...ep,
                        stateClass,
                        formattedDate: formatDate(ep.released),
                    };
                });

                list.push({
                    id,
                    type: m.type,
                    title: m.name,
                    releaseDate: new Date(dateMs),
                    releaseText: formatDaysUntil(dateMs),
                    episodeText,
                    poster: `${posterBase}/${id}/img`,
                    logo: `${logoBase}/${id}/img`,
                    href,
                    trailer:
                        m?.trailer ||
                        m?.trailers?.[0]?.source ||
                        m?.trailers?.[0]?.url ||
                        m?.videos?.[0]?.url ||
                        null,
                    description: m.description,
                    rating: m.imdbRating || "",
                    year: m.year || m.releaseInfo || "",
                    runtime: m.runtime,
                    genres: m.genre || m.genres || [],
                    videos: formattedVideos,
                    isNewSeason,
                });
            }
            return list;
        },
        [getClosestFutureVideo, formatDaysUntil, formatDate]
    );

    const fetchLibraryUpcoming = useCallback(
        async (limit = 6) => {
            const key = `userLibrary_${limit}`;
            const cached = cacheGet(key);

            if (cached) {
                return refreshWatchedState(cached);
            }

            const seriesIds = getUserLibrarySeries();
            if (!seriesIds.length) return [];

            const promiseFns = seriesIds.map((meta) => async () => {
                const id = meta._id;
                const metaCacheKey = `fullmeta:${id}`;
                let cachedMeta = videoCacheGet(metaCacheKey);

                if (!cachedMeta) {
                    try {
                        const data = await safeFetch(
                            `${CONFIG.URLS.CINEMETA_META}/series/${id}.json`
                        );
                        const fetchedMeta = data?.meta;

                        if (fetchedMeta) {
                            videoCacheSet(
                                metaCacheKey,
                                mapToListItem(fetchedMeta, "series")
                            );
                            cachedMeta = fetchedMeta;
                        }
                    } catch (err) {
                        return null;
                    }
                }
                if (cachedMeta) {
                    Object.assign(meta, cachedMeta);
                }
                return meta;
            });

            const results = await batchPromiseAllSettled(promiseFns);

            let metas = results
                .filter((r) => r.status === "fulfilled" && r.value)
                .map((r) => r.value);

            metas = getUserData(metas);
            const list = processMetasToList(metas);

            list.sort((a, b) => a.releaseDate - b.releaseDate);
            const finalList = list.slice(0, limit);

            cacheSet(key, finalList);
            return finalList;
        },
        [
            cacheGet,
            getUserLibrarySeries,
            videoCacheGet,
            safeFetch,
            videoCacheSet,
            mapToListItem,
            batchPromiseAllSettled,
            getUserData,
            processMetasToList,
            refreshWatchedState,
            cacheSet,
        ]
    );

    const fetchUpcomingTitles = useCallback(
        async (type = "movie", catalog = "top", limit = 10) => {
            const key = `${type}_${catalog}_${limit}`;
            const cached = cacheGet(key);

            if (cached) {
                return refreshWatchedState(cached);
            }

            try {
                const types = ["movie", "series"];
                const skipValues = [0, 50];

                const fetchPromises = [];
                for (const t of types) {
                    for (const skip of skipValues) {
                        const url =
                            skip === 0
                                ? `${CONFIG.URLS.CINEMETA_CATALOG}/${t}/${catalog}.json`
                                : `${CONFIG.URLS.CINEMETA_CATALOG}/${t}/${catalog}/skip=${skip}.json`;
                        fetchPromises.push(safeFetch(url));
                    }
                }

                const results = await Promise.allSettled(fetchPromises);

                const all = [];
                const seenIds = new Set();

                for (const res of results) {
                    if (res.status === "fulfilled" && res.value) {
                        const payload = res.value;
                        const metas = Array.isArray(payload.metas)
                            ? payload.metas
                            : Array.isArray(payload)
                            ? payload
                            : [];

                        for (const meta of metas) {
                            if (meta.id && !seenIds.has(meta.id)) {
                                seenIds.add(meta.id);
                                all.push(meta);
                            }
                        }
                    }
                }

                let seriesMetas = all.filter((m) => m.type === "series");
                const movieMetas = all.filter((m) => m.type === "movie");

                const activeSeries = seriesMetas.filter((m) => {
                    const status = m.status?.toLowerCase();
                    return status === "continuing" || status === "upcoming";
                });

                const promiseFns = activeSeries.map((m) => async () => {
                    const metaCacheKey = `fullmeta:${m.id}`;
                    let cachedMeta = videoCacheGet(metaCacheKey);

                    if (!cachedMeta) {
                        try {
                            const data = await safeFetch(
                                `${CONFIG.URLS.CINEMETA_META}/${m.type}/${m.id}.json`
                            );
                            cachedMeta = data?.meta || [];
                            if (cachedMeta) {
                                videoCacheSet(
                                    metaCacheKey,
                                    mapToListItem(cachedMeta)
                                );
                            }
                        } catch (err) {
                            // ignore
                        }
                    }
                    if (cachedMeta) {
                        Object.assign(m, cachedMeta);
                    }
                    return m;
                });

                const seriesEnrichmentResults = await batchPromiseAllSettled(
                    promiseFns
                );

                let allMetasWithVideos = [
                    ...movieMetas,
                    ...seriesEnrichmentResults
                        .filter((r) => r.status === "fulfilled")
                        .map((r) => r.value),
                ];

                allMetasWithVideos = getUserData(allMetasWithVideos);

                const metadataList = processMetasToList(allMetasWithVideos);

                metadataList.sort((a, b) => a.releaseDate - b.releaseDate);
                const finalList = metadataList.slice(0, limit);

                cacheSet(key, finalList);
                return finalList;
            } catch (e) {
                console.warn(
                    "[UpcomingReleases] Failed to fetch upcoming titles",
                    e
                );
                return [];
            }
        },
        [
            cacheGet,
            safeFetch,
            videoCacheGet,
            videoCacheSet,
            mapToListItem,
            batchPromiseAllSettled,
            getUserData,
            processMetasToList,
            refreshWatchedState,
            cacheSet,
        ]
    );

    useEffect(() => {
        let mounted = true;

        const loadData = async () => {
            setLoading(true);
            try {
                const data =
                    mode === "library"
                        ? await fetchLibraryUpcoming(8)
                        : await fetchUpcomingTitles("movie", "top", 8);

                if (mounted) {
                    setUpcoming(data);
                }
            } catch (err) {
                console.error(err);
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        loadData();

        return () => {
            mounted = false;
        };
    }, [mode, fetchLibraryUpcoming, fetchUpcomingTitles]);

    const setModeAndSave = useCallback((newMode) => {
        setMode(newMode);
        localStorage.setItem(CONFIG.STORAGE_KEYS.UPCOMING_MODE, newMode);
    }, []);

    return {
        upcoming,
        loading,
        mode,
        setMode: setModeAndSave,
    };
};

export default useUpcomingList;
