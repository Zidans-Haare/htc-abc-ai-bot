const { DateTime } = require('luxon');

/**
 * German timezone utilities using Luxon
 * Handles all timezone conversions for the German application
 */

const GERMAN_TIMEZONE = 'Europe/Berlin';

/**
 * Get the current date/time in German timezone
 * @returns {DateTime} Luxon DateTime object in German timezone
 */
function getGermanNow() {
    return DateTime.now().setZone(GERMAN_TIMEZONE);
}

/**
 * Convert a JavaScript Date to German timezone DateTime
 * @param {Date} date - JavaScript Date object
 * @returns {DateTime} Luxon DateTime object in German timezone
 */
function toGermanTime(date) {
    return DateTime.fromJSDate(date).setZone(GERMAN_TIMEZONE);
}

/**
 * Get the ISO date string (YYYY-MM-DD) for a date in German timezone
 * @param {Date} date - JavaScript Date object
 * @returns {string} ISO date string in German timezone
 */
function getGermanDateString(date) {
    return toGermanTime(date).toISODate();
}

/**
 * Check if a date is today in German timezone
 * @param {Date} date - JavaScript Date object to check
 * @returns {boolean} True if the date is today in German timezone
 */
function isTodayInGermanTime(date) {
    const germanTime = toGermanTime(date);
    const germanToday = getGermanNow().toISODate();
    return germanTime.toISODate() === germanToday;
}

/**
 * Get the start of today in German timezone as a JavaScript Date
 * @returns {Date} JavaScript Date representing start of today in German timezone
 */
function getGermanTodayStart() {
    return getGermanNow().startOf('day').toJSDate();
}

/**
 * Get a date X days ago in German timezone
 * @param {number} days - Number of days ago
 * @returns {DateTime} Luxon DateTime object for X days ago in German timezone
 */
function getGermanDaysAgo(days) {
    return getGermanNow().minus({ days });
}

/**
 * Group data by date in German timezone
 * @param {Array} data - Array of objects with date fields
 * @param {string} dateField - Name of the date field (e.g., 'started_at')
 * @param {DateTime} sinceDate - Optional: only include data since this date
 * @returns {Array} [{date: '2024-01-01', count: 5}, ...]
 */
function groupByGermanDate(data, dateField, sinceDate = null) {
    const resultMap = {};
    data.forEach(item => {
        if (!item[dateField]) return; // Skip null dates
        const germanTime = toGermanTime(item[dateField]);
        const dateStr = germanTime.toISODate();
        if (!sinceDate || germanTime >= sinceDate) {
            resultMap[dateStr] = (resultMap[dateStr] || 0) + 1;
        }
    });
    return Object.entries(resultMap)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Group data by hour for a specific date in German timezone
 * @param {Array} data - Array of objects with date fields
 * @param {string} dateField - Name of the date field
 * @param {string} targetDate - Target date in YYYY-MM-DD format
 * @returns {Array} [{hour: 14, count: 3}, ...]
 */
function groupByGermanHour(data, dateField, targetDate) {
    const resultMap = {};
    data.forEach(item => {
        if (!item[dateField]) return; // Skip null dates
        const germanTime = toGermanTime(item[dateField]);
        const dateStr = germanTime.toISODate();
        if (dateStr === targetDate) {
            const hour = germanTime.hour;
            resultMap[hour] = (resultMap[hour] || 0) + 1;
        }
    });
    return Object.entries(resultMap)
        .map(([hour, count]) => ({ hour: parseInt(hour), count }));
}

/**
 * Group feedback data by date (handles conversation deduplication)
 * @param {Array} feedback - Feedback array with conversation_id
 * @param {DateTime} sinceDate - Only include data since this date
 * @returns {Array} [{date: '2024-01-01', count: 5}, ...]
 */
function groupFeedbackByGermanDate(feedback, sinceDate = null) {
    const resultMap = {};
    const seenConversations = new Set();
    feedback.forEach(fb => {
        if (!fb.submitted_at) return; // Skip null dates
        const germanTime = toGermanTime(fb.submitted_at);
        const dateStr = germanTime.toISODate();
        if ((!sinceDate || germanTime >= sinceDate) && !seenConversations.has(fb.conversation_id)) {
            seenConversations.add(fb.conversation_id);
            resultMap[dateStr] = (resultMap[dateStr] || 0) + 1;
        }
    });
    return Object.entries(resultMap)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Group feedback data by hour for a specific date (handles conversation deduplication)
 * @param {Array} feedback - Feedback array with conversation_id
 * @param {string} targetDate - Target date in YYYY-MM-DD format
 * @returns {Array} [{hour: 14, count: 3}, ...]
 */
function groupFeedbackByGermanHour(feedback, targetDate) {
    const resultMap = {};
    const seenConversations = new Set();
    feedback.forEach(fb => {
        if (!fb.submitted_at) return; // Skip null dates
        const germanTime = toGermanTime(fb.submitted_at);
        const dateStr = germanTime.toISODate();
        if (dateStr === targetDate && !seenConversations.has(fb.conversation_id)) {
            seenConversations.add(fb.conversation_id);
            const hour = germanTime.hour;
            resultMap[hour] = (resultMap[hour] || 0) + 1;
        }
    });
    return Object.entries(resultMap)
        .map(([hour, count]) => ({ hour: parseInt(hour), count }));
}

module.exports = {
    getGermanNow,
    toGermanTime,
    getGermanDateString,
    isTodayInGermanTime,
    getGermanTodayStart,
    getGermanDaysAgo,
    groupByGermanDate,
    groupByGermanHour,
    groupFeedbackByGermanDate,
    groupFeedbackByGermanHour,
    GERMAN_TIMEZONE
};