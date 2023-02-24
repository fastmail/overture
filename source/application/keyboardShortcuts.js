import { isApple } from '../ua/UA.js';

// Use the default behavior.
export const DEFAULT_IN_INPUT = 0;
// Active when input is focused.
export const ACTIVE_IN_INPUT = 1;
// Not active when input is focused.
export const DISABLE_IN_INPUT = 2;

// Platform-specific key combination to delete an item.
export const DELETE_ITEM = isApple ? 'Cmd-Backspace' : 'Delete';
