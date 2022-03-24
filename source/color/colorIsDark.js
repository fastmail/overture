import { Color } from './Color.js';

const colorIsDark = (color) => Color.fromCSSColorValue(color).toLAB().l < 50;

export { colorIsDark };
