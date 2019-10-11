import { isApple } from '../ua/UA';

export const DELETE_ITEM = isApple ? 'Cmd-Backspace' : 'Delete';
