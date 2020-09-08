import { isApple } from '../ua/UA.js';

export const DEFAULT_IN_INPUT = 0;
export const ACTIVE_IN_INPUT = 1;
export const DISABLE_IN_INPUT = 2;

export const DELETE_ITEM = isApple ? 'Cmd-Backspace' : 'Delete';
