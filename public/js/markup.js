// This module relies on 'marked' and 'DOMPurify' being available in the global scope,
// loaded from <script> tags in the HTML.

export function renderMarkup(text) {
    if (typeof text !== 'string') {
        return '';
    }
    // Configure marked to add <br> on single line breaks
    const options = {
        breaks: true
    };
    try {
        // Use the global 'marked' object to parse the markdown
        const dirty = window.marked.parse(text, options);
        // Use the global 'DOMPurify' object to sanitize the HTML
        return window.DOMPurify.sanitize(dirty);
    } catch (error) {
        console.warn('Failed to parse markdown, falling back to plain text:', error);
        // Fall back to plain text if markdown parsing fails
        return window.DOMPurify.sanitize(text.replace(/\n/g, '<br>'));
    }
}
