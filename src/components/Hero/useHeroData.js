import { useEffect, useState } from "react";

const FALLBACK_TITLES = [
    {
        id: "tt0903747",
        title: "Breaking Bad",
        background:
            "https://images.metahub.space/background/large/tt0903747/img",
        logo: "https://images.metahub.space/logo/medium/tt0903747/img",
        description:
            "A chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine with a former student in order to secure his family's future.",
        year: "2008",
        duration: "45 min",
        seasons: "5 seasons",
        rating: "9.5",
        numericRating: 9.5,
        type: "series",
    },
    {
        id: "tt1375666",
        title: "Inception",
        background:
            "https://images.metahub.space/background/large/tt1375666/img",
        logo: "https://images.metahub.space/logo/medium/tt1375666/img",
        description:
            "A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.",
        year: "2010",
        duration: "148 min",
        seasons: "Movie",
        rating: "8.8",
        numericRating: 8.8,
        type: "movie",
    },
    {
        id: "tt0468569",
        title: "The Dark Knight",
        background:
            "https://images.metahub.space/background/large/tt0468569/img",
        logo: "https://images.metahub.space/logo/medium/tt0468569/img",
        description:
            "When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice.",
        year: "2008",
        duration: "152 min",
        seasons: "Movie",
        rating: "9.0",
        numericRating: 9.0,
        type: "movie",
    },
];

const safeFetch = async (url, { timeout = 10000, retries = 1 } = {}) => {
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
};

const fetchCatalogTitles = async (type, limit = 10) => {
    const url = `https://cinemeta-catalogs.strem.io/top/catalog/${type}/top.json`;
    try {
        const json = await safeFetch(url, { timeout: 10000, retries: 1 });
        return (json.metas || []).slice(0, limit).map((m) => ({
            id: m.id,
            title: m.name,
            background: `https://images.metahub.space/background/large/${m.id}/img`,
            logo: `https://images.metahub.space/logo/medium/${m.id}/img`,
            description: m.description || `Discover ${m.name}`,
            year: m.year ? String(m.year) : "2024",
            runtime: m.runtime || null,
            type,
        }));
    } catch (e) {
        console.warn("fetchCatalogTitles failed", e);
        return [];
    }
};

const getDetailedMetaData = async (id, type) => {
    try {
        const json = await safeFetch(
            `https://v3-cinemeta.strem.io/meta/${type}/${id}.json`,
            { timeout: 5000, retries: 1 }
        );
        const meta = json.meta;
        if (!meta) return null;

        const actualType =
            meta.type || (meta.videos && meta.videos.length ? "series" : type);
        const duration = meta.runtime
            ? `${meta.runtime}`
            : actualType === "series"
            ? "45 min per episode"
            : "Unknown";

        const seasons =
            actualType === "movie"
                ? "Movie"
                : meta.videos && meta.videos.length
                ? new Set(meta.videos.map((v) => v.season).filter(Boolean))
                      .size > 1
                    ? `${
                          new Set(
                              meta.videos.map((v) => v.season).filter(Boolean)
                          ).size
                      } seasons`
                    : `${meta.videos.length} episodes`
                : "Series";

        return {
            year: meta.year ? String(meta.year) : "2024",
            duration,
            rating: meta.imdbRating || "na",
            numericRating: parseFloat(meta.imdbRating) || 0,
            seasons,
            description: meta.description || `Discover ${meta.name}`,
            type: actualType,
            genres: meta.genre || meta.genres || [],
            cast: meta.cast || [],
            director: Array.isArray(meta.director)
                ? meta.director.join(", ")
                : meta.director || "",
            awards: meta.awards || "",
        };
    } catch (e) {
        console.warn("getDetailedMetaData failed", id, e);
        return null;
    }
};

const enrichTitles = async (titles) => {
    const enriched = [];
    for (const t of titles) {
        const details = await getDetailedMetaData(t.id, t.type);
        if (details) Object.assign(t, details);
        enriched.push(t);
    }
    return enriched;
};

export const useHeroData = () => {
    const [heroTitles, setHeroTitles] = useState([]);

    useEffect(() => {
        const initializeTitles = async () => {
            try {
                const [movies, series] = await Promise.all([
                    fetchCatalogTitles("movie", 8),
                    fetchCatalogTitles("series", 8),
                ]);

                const result = [];
                let m = 0,
                    s = 0,
                    expectMovie = true;
                while (
                    result.length < 10 &&
                    (m < movies.length || s < series.length)
                ) {
                    let pick = null;
                    if (expectMovie && m < movies.length) pick = movies[m++];
                    else if (!expectMovie && s < series.length)
                        pick = series[s++];
                    else if (m < movies.length) pick = movies[m++];
                    else if (s < series.length) pick = series[s++];
                    expectMovie = !expectMovie;
                    if (pick) result.push(pick);
                }

                const enriched = await enrichTitles(result);
                if (enriched.length > 0) {
                    setHeroTitles(enriched);
                } else {
                    setHeroTitles(FALLBACK_TITLES);
                }
            } catch (e) {
                console.warn("initializeTitles error", e);
                setHeroTitles(FALLBACK_TITLES);
            }
        };

        initializeTitles();
    }, []);

    return heroTitles;
};
