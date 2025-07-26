export function renderMarkup(text) {
    if (typeof text !== 'string') {
        return '';
    }
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1<\/strong>')
        .replace(/\n/g, '<br>');
}