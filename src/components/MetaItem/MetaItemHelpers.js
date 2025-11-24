function getDaysSinceRelease(releaseDateStr) {
    if (!releaseDateStr) return "";
    const oneDay = 86400000;
    const release = Date.parse(releaseDateStr);
    if (isNaN(release)) return "";

    // 1. Calculate difference in milliseconds, then days
    const diffMs = Date.now() - release;
    const diffDays = diffMs / oneDay;

    if (diffDays >= 0) {
        // Past or current day
        const days = Math.trunc(diffDays); // Use Math.trunc for whole days passed
        if (days === 0) return "Today";

        if (days >= 365) {
            const years = Math.trunc(days / 365);
            // 3. FIX: Pluralize based on the calculated number of years
            return `${years} year${years > 1 ? "s" : ""} ago`;
        }
        return `${days} day${days > 1 ? "s" : ""} ago`;
    }

    // Future release
    // 1. FIX: Use Math.ceil on the absolute difference to correctly count days ahead
    const daysAhead = Math.ceil(Math.abs(diffDays));
    return `in ${daysAhead} day${daysAhead > 1 ? "s" : ""}`;
}
const isNewTag = (releaseDate) => {
    if (!releaseDate) return null;

    const release = new Date(releaseDate);
    if (isNaN(release)) return null; // not a valid date

    const now = new Date();
    const diffMs = now - release;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays < 0) return "UPCOMING"; // future release
    if (diffDays <= 14) return "NEW"; // within 14 days old

    return null;
};

export { getDaysSinceRelease, isNewTag };

