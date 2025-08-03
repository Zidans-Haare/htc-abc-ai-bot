
// npm install @milkdown/core @milkdown/theme-nord @milkdown/kit
//    @milkdown/kit includes presets and plugins like gfm, history, listener, etc.
//    https://milkdown.dev/docs/plugin/using-plugins



// src/milkdown-entry.js
import { Editor, rootCtx, defaultValueCtx, commands } from '@milkdown/core';
import { nord } from '@milkdown/theme-nord';
import { gfm } from '@milkdown/kit/preset/gfm';
import { history } from '@milkdown/kit/plugin/history';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { SlashProvider, slashFactory } from '@milkdown/kit/plugin/slash'
import { TooltipProvider, tooltipFactory } from '@milkdown/kit/plugin/tooltip'
import { commonmark } from '@milkdown/kit/preset/commonmark'

import '@milkdown/theme-nord/style.css';

// Expose to global scope for <script> usage
window.Milkdown = {
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
};

