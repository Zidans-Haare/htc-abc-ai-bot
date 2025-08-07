
import { Editor, rootCtx, defaultValueCtx, commands, nord, gfm, history, listener, listenerCtx, slashFactory, tooltipFactory, commonmark, getMarkdownUtil } from './milkdown_editor/milkdown.bundle.js';

let editorInstance = null;
let onChangeCallback = () => {};


export async function initEditor(aiCheckHandler) {
  if (editorInstance) {
    setupToolbar(aiCheckHandler);
    return editorInstance;
  }

  const editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, document.querySelector('#editor'));
      ctx.set(defaultValueCtx, '');
      ctx.get(listenerCtx).markdownUpdated((ctx, markdown, prevMarkdown) => {
        if (onChangeCallback) {
          onChangeCallback(markdown);
        }
      });
    })
    .use(nord)
    .use(commonmark)
    .use(gfm)
    .use(history)
    .use(listener)
    .use(slashFactory())
    .use(tooltipFactory())
    .create();

  editorInstance = editor;
  setupToolbar(aiCheckHandler);

  return {
    getMarkdown: () => editorInstance.action(getMarkdownUtil()),
    setMarkdown: (markdown) => {
      editorInstance.action(ctx => {
        const view = ctx.get(rootCtx);
        if (view) {
          editorInstance.action(commands.selectAll);
          editorInstance.action(commands.deleteSelection);
          editorInstance.action(commands.insert(markdown));
        }
      });
    },
    onChange: (callback) => {
      onChangeCallback = callback;
    },
    setupAiCheck: setupToolbar
  };
}

async function setupToolbar(aiCheckHandler) {
    const editor = editorInstance;
    if (!editor) return;


    const h1 = document.getElementById('h1-btn');
    const h2 = document.getElementById('h2-btn');
    const h3 = document.getElementById('h3-btn');
    const bold = document.getElementById('bold-btn');
    const italic = document.getElementById('italic-btn');
    const underline = document.getElementById('underline-btn');
    const link = document.getElementById('link-btn');
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    const aiCheck = document.getElementById('ai-check-btn');

    if (h1) h1.addEventListener('click', () => editor.action(commands.toggleHeading({
        level: 1
    })));
    if (h2) h2.addEventListener('click', () => editor.action(commands.toggleHeading({
        level: 2
    })));
    if (h3) h3.addEventListener('click', () => editor.action(commands.toggleHeading({
        level: 3
    })));
    if (bold) bold.addEventListener('click', () => editor.action(commands.toggleStrong()));
    if (italic) italic.addEventListener('click', () => editor.action(commands.toggleEmphasis()));
    if (underline) underline.disabled = true;
    if (link) {
        link.addEventListener('click', () => {
            const url = prompt('Enter URL:');
            if (url) {
                editor.action(commands.toggleLink({
                    href: url
                }));
            }
        });
    }
    if (undoBtn) undoBtn.addEventListener('click', () => editor.action(commands.undo));
    if (redoBtn) redoBtn.addEventListener('click', () => editor.action(commands.redo));
    if (aiCheck && aiCheckHandler) {
        aiCheck.addEventListener('click', aiCheckHandler);
    }
}



export function getMarkdown() {
    if (!editorInstance) return '';
    return editorInstance.action(getMarkdownUtil());
}

export function setMarkdown(markdown) {
    if (!editorInstance) return;
    editorInstance.action(ctx => {
        const view = ctx.get(rootCtx);
        if (view) {
            editorInstance.action(commands.selectAll);
            editorInstance.action(commands.deleteSelection);
            editorInstance.action(commands.insert(markdown));
        }
    });
}

export function onChange(callback) {
    onChangeCallback = callback;
}