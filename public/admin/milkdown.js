import { Editor, rootCtx, defaultValueCtx } from 'https://cdn.jsdelivr.net/npm/@milkdown/core@7.3.3/+esm';
import { nord } from 'https://cdn.jsdelivr.net/npm/@milkdown/theme-nord@7.3.3/+esm';
import { gfm } from 'https://cdn.jsdelivr.net/npm/@milkdown/preset-gfm@7.3.3/+esm';
import { history } from 'https://cdn.jsdelivr.net/npm/@milkdown/plugin-history@7.3.3/+esm';
import { listener, listenerCtx } from 'https://cdn.jsdelivr.net/npm/@milkdown/plugin-listener@7.3.3/+esm';
import { menu } from 'https://cdn.jsdelivr.net/npm/@milkdown/plugin-menu@7.3.3/+esm';
import { commands } from 'https://cdn.jsdelivr.net/npm/@milkdown/core@7.3.3/+esm';

let editorInstance = null;
let onChangeCallback = () => {};

export async function createMilkdownEditor(aiCheckHandler) {
    const editor = await Editor.make()
        .config((ctx) => {
            ctx.set(rootCtx, document.querySelector('#editor'));
            ctx.set(defaultValueCtx, ''); // Initial content
            ctx.get(listenerCtx).markdownUpdated((ctx, markdown, prevMarkdown) => {
                onChangeCallback(markdown);
            });
        })
        .use(nord)
        .use(gfm)
        .use(history)
        .use(listener)
        .use(menu)
        .create();

    editorInstance = editor;
    setupToolbar(aiCheckHandler);
    return editor;
}

function setupToolbar(aiCheckHandler) {
    const editor = editorInstance;
    if (!editor) return;

    const h1 = document.getElementById('h1-btn');
    const h2 = document.getElementById('h2-btn');
    const h3 = document.getElementById('h3-btn');
    const bold = document.getElementById('bold-btn');
    const italic = document.getElementById('italic-btn');
    const underline = document.getElementById('underline-btn');
    const link = document.getElementById('link-btn');
    const undo = document.getElementById('undo-btn');
    const redo = document.getElementById('redo-btn');
    const aiCheck = document.getElementById('ai-check-btn');

    h1.addEventListener('click', () => editor.action(commands.toggleHeading({ level: 1 })));
    h2.addEventListener('click', () => editor.action(commands.toggleHeading({ level: 2 })));
    h3.addEventListener('click', () => editor.action(commands.toggleHeading({ level: 3 })));
    bold.addEventListener('click', () => editor.action(commands.toggleStrong()));
    italic.addEventListener('click', () => editor.action(commands.toggleEmphasis()));
    // Underline is not standard in GFM, so we'll use a custom command or skip for now.
    // For simplicity, we'll skip the underline button's functionality for now.
    underline.disabled = true; 

    link.addEventListener('click', () => {
        const url = prompt('Enter URL:');
        if (url) {
            editor.action(commands.toggleLink({ href: url }));
        }
    });

    undo.addEventListener('click', () => editor.action(commands.undo()));
    redo.addEventListener('click', () => editor.action(commands.redo()));
    
    if (aiCheckHandler) {
        aiCheck.addEventListener('click', aiCheckHandler);
    }
}

export function getMarkdown() {
    if (!editorInstance) return '';
    let markdown = '';
    editorInstance.action((ctx) => {
        const editorView = ctx.get(commands.EditorView);
        markdown = editorView.state.doc.textContent; // This is a simplification
    });
    // A more robust way to get markdown would be needed, potentially with a plugin
    // For now, we'll rely on a workaround or a dedicated plugin later.
    // This is a known complexity with Milkdown/Prosemirror vs Markdown-native editors.
    // Let's assume we have a way to get it, for now we'll use a placeholder.
    // This part will need to be replaced with a proper markdown serializer.
    console.warn("getMarkdown is not fully implemented and using a placeholder logic.");
    return editorInstance.action(commands.getMarkdown());
}

export function setMarkdown(markdown) {
    if (!editorInstance) return;
    editorInstance.action(commands.replaceA(markdown));
}

export function onChange(callback) {
    onChangeCallback = callback;
}