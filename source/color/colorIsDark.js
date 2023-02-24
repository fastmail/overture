import { Color } from './Color.js';

// Is this color dark?  Used to determine e.g. foreground text color.
const colorIsDark = (color) => Color.fromCSSColorValue(color).toLAB().l < 50;

export { colorIsDark };
