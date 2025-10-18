import { marked } from 'marked';
import DOMPurify from 'dompurify';

function renderMarkup(text) {
    if (typeof text !== 'string') {
        return '';
    }
    // Configure marked to add <br> on single line breaks
    const options = {
        breaks: true
    };
    try {
        // Parse the markdown
        const dirty = marked.parse(text, options);
        // Sanitize the HTML
        return DOMPurify.sanitize(dirty);
    } catch (error) {
        console.warn('Failed to parse markdown, falling back to plain text:', error);
        // Fall back to plain text if markdown parsing fails
        return DOMPurify.sanitize(text.replace(/\n/g, '<br>'));
    }
}

export { renderMarkup };
