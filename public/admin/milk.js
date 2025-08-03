



// Import CSS for bundling
import '@milkdown/theme-nord/lib/theme.css';
import '@milkdown-lab/plugin-menu/style.css'; // Headless menu styles (customize as needed)

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
  const undoBtn = document.getElementById('undo-btn');
  const redoBtn = document.getElementById('redo-btn');
  const aiCheck = document.getElementById('ai-check-btn');

  if (h1) h1.addEventListener('click', () => editor.action(toggleHeading({ level: 1 })));
  if (h2) h2.addEventListener('click', () => editor.action(toggleHeading({ level: 2 })));
  if (h3) h3.addEventListener('click', () => editor.action(toggleHeading({ level: 3 })));
  if (bold) bold.addEventListener('click', () => editor.action(toggleStrong()));
  if (italic) italic.addEventListener('click', () => editor.action(toggleEmphasis()));
  // Underline is not supported in GFM; keep disabled or implement custom command
  if (underline) underline.disabled = true;
  if (link) {
    link.addEventListener('click', () => {
      const url = prompt('Enter URL:');
      if (url) {
        editor.action(toggleLink({ href: url }));
      }
    });
  }
  if (undoBtn) undoBtn.addEventListener('click', () => editor.action(undo()));
  if (redoBtn) redoBtn.addEventListener('click', () => editor.action(redo()));
  if (aiCheck && aiCheckHandler) {
    aiCheck.addEventListener('click', aiCheckHandler);
  }
}

export function getMarkdown() {
  if (!editorInstance) return '';
  return editorInstance.action(getMarkdown()); // Use Milkdown's utility for proper Markdown serialization
}

export function setMarkdown(markdown) {
  if (!editorInstance) return;
  editorInstance.action((ctx) => {
    ctx.set(defaultValueCtx, markdown);
    editorInstance.action((ctx) => {
      const view = ctx.get(rootCtx).querySelector('#editor');
      if (view) {
        editorInstance.destroy();
        editorInstance.create();
      }
    });
  });
}

export function onChange(callback) {
  onChangeCallback = callback;
}