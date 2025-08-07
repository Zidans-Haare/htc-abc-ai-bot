// src/milkdown-entry.js
import { Editor, rootCtx, defaultValueCtx, commands } from '@milkdown/kit/core';
import { nord } from '@milkdown/theme-nord';
import { gfm } from '@milkdown/kit/preset/gfm';
import { history } from '@milkdown/kit/plugin/history';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { SlashProvider, slashFactory } from '@milkdown/kit/plugin/slash';
import { TooltipProvider, tooltipFactory } from '@milkdown/kit/plugin/tooltip';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { getMarkdown as getMarkdownUtil } from '@milkdown/utils';

import '@milkdown/theme-nord/style.css';

// Export for other modules to import
export {
  Editor,
  rootCtx,
  defaultValueCtx,
  commands,
  nord,
  gfm,
  history,
  listener,
  listenerCtx,
  SlashProvider,
  slashFactory,
  TooltipProvider,
  tooltipFactory,
  commonmark,
  getMarkdownUtil,
};