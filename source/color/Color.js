class Color {
    constructor(opacity) {
        this.opacity = opacity;
    }

    toJSON() {
        return this.toString();
    }
}

// ---

// LAB helper functions
const rgbToLRGB = function (x) {
    x /= 255;
    return x > 0.04045 ? Math.pow((x + 0.055) / 1.055, 2.4) : x / 12.92;
};

const lrgbToRGB = function (x) {
    x = x > 0.0031308 ? 1.055 * Math.pow(x, 1 / 2.4) - 0.055 : 12.92 * x;
    x *= 255;
    return x < 0 ? 0 : x > 255 ? 255 : x;
};

const fourOverTwentyNine = 4 / 29;
const delta = 6 / 29;
const deltaCubed = delta * delta * delta;
const threeDeltaSquared = 3 * delta * delta;

const f = function (t) {
    return t > deltaCubed
        ? Math.pow(t, 1 / 3)
        : t / threeDeltaSquared + fourOverTwentyNine;
};

const f1 = function (t) {
    return t > delta ? t * t * t : threeDeltaSquared * (t - fourOverTwentyNine);
};

// ---

const printHex = function (number) {
    let string = Math.round(number).toString(16);
    if (number < 16) {
        string = '0' + string;
    }
    return string;
};

class RGB extends Color {
    constructor(r, g, b, opacity) {
        super(opacity);
        this.r = r; // [0,255]
        this.g = g; // [0,255]
        this.b = b; // [0,255]
    }

    toString() {
        const opacity = this.opacity;
        if (opacity < 1) {
            return (
                'rgba(' +
                Math.round(this.r) +
                ', ' +
                Math.round(this.g) +
                ', ' +
                Math.round(this.b) +
                ', ' +
                opacity +
                ')'
            );
        }
        return '#' + printHex(this.r) + printHex(this.g) + printHex(this.b);
    }

    toRGB() {
        return this;
    }

    // Algorithm from
    // http://www.niwa.nu/2013/05/math-behind-colorspace-conversions-rgb-hsl/
    toHSL() {
        const r = this.r / 255;
        const g = this.g / 255;
        const b = this.b / 255;

        const min = Math.min(r, g, b);
        const max = Math.max(r, g, b);

        const l = (min + max) / 2;
        let h = 0;
        let s = 0;

        if (min !== max) {
            const d = max - min;
            s = d / (l <= 0.5 ? max + min : 2 - max - min);
            h =
                r === max
                    ? (g - b) / d
                    : g === max
                    ? (b - r) / d + 2
                    : (r - g) / d + 4;
            if (h < 0) {
                h += 6;
            }
            h = h * 60;
        }
        return new HSL(h, s, l, this.opacity);
    }

    // Algorithm from https://observablehq.com/@mbostock/lab-and-rgb
    toLAB() {
        // 1. Convert to linear-light sRGB.
        const r = rgbToLRGB(this.r);
        const g = rgbToLRGB(this.g);
        const b = rgbToLRGB(this.b);

        // 2. Convert and apply chromatic adaptation to CIEXYZ D50.
        const x = 0.4360747 * r + 0.3850649 * g + 0.1430804 * b;
        const y = 0.2225045 * r + 0.7168786 * g + 0.0606169 * b;
        const z = 0.0139322 * r + 0.0971045 * g + 0.7141733 * b;

        // 3. Convert from CIEXYZ D50 to CIELAB
        const fx = f(x / 0.96422);
        const fy = f(y);
        const fz = f(z / 0.82521);

        return new LAB(
            116 * fy - 16,
            500 * (fx - fy),
            200 * (fy - fz),
            this.opacity,
        );
    }
}

// ---

class HSL extends Color {
    constructor(h, s, l, opacity) {
        super(opacity);
        this.h = h; // [0,360]
        this.s = s; // [0,1]
        this.l = l; // [0,1]
    }

    toString() {
        const hsl = this.h + ', ' + 100 * this.s + '%, ' + 100 * this.l + '%';
        const opacity = this.opacity;
        return opacity < 1
            ? 'hsla(' + hsl + ', ' + opacity + ')'
            : 'hsl(' + hsl + ')';
    }

    // Algorithm from https://en.wikipedia.org/wiki/HSL_and_HSV#HSL_to_RGB
    toRGB() {
        const h = this.h;
        const s = this.s;
        const l = this.l;
        const x = s * Math.min(l, 1 - l);
        const f = (n) => {
            const k = (n + h / 30) % 12;
            return 255 * (l - x * Math.max(Math.min(k - 3, 9 - k, 1), -1));
        };
        return new RGB(f(0), f(8), f(4), this.opacity);
    }

    toHSL() {
        return this;
    }

    toLAB() {
        return this.toRGB().toLAB();
    }
}

// ---

class LAB extends Color {
    constructor(l, a, b, opacity) {
        super(opacity);
        this.l = l; // [0, 100]
        this.a = a; // [-160, 160]
        this.b = b; // [-160, 160]
    }

    // Algorithm from https://observablehq.com/@mbostock/lab-and-rgb
    toRGB() {
        // 1. Convert from CIELAB to CIEXYZ D50
        const dl = (this.l + 16) / 116;
        const da = this.a / 500;
        const db = this.b / 200;

        const x = 0.96422 * f1(dl + da);
        const y = f1(dl);
        const z = 0.82521 * f1(dl - db);

        // 2. Convert to linear-light sRGB.
        const r = 3.1338561 * x - 1.6168667 * y - 0.4906146 * z;
        const g = -0.9787684 * x + 1.9161415 * y + 0.033454 * z;
        const b = 0.0719453 * x - 0.2289914 * y + 1.4052427 * z;

        // 3. Convert to sRGB
        return new RGB(lrgbToRGB(r), lrgbToRGB(g), lrgbToRGB(b), this.opacity);
    }

    toHSL() {
        return this.toRGB().toHSL();
    }

    toLAB() {
        return this;
    }
}

// ---

const getByteDoubled = function (number, offsetFromEnd) {
    offsetFromEnd <<= 2;
    const byte = (number >> offsetFromEnd) & 0xf;
    return (byte << 4) | byte;
};

const getDoubleByte = function (number, offsetFromEnd) {
    offsetFromEnd <<= 3;
    return (number >> offsetFromEnd) & 0xff;
};

const splitColor = function (color) {
    const first = color.indexOf('(') + 1;
    const last = color.lastIndexOf(')');
    const parts = color
        .slice(first, last)
        .trim()
        .split(/[, /]+/);
    return parts.length >= 3 ? parts : null;
};

const parseNumber = function (string, max) {
    let number = parseFloat(string);
    if (string.charAt(string.length - 1) === '%') {
        number = (number * max) / 100;
    }
    return number < 0 ? 0 : number > max ? max : number || 0;
};

// Source: https://drafts.csswg.org/css-color/
const cssColorNames = {
    aliceblue: 0xf0f8ff,
    antiquewhite: 0xfaebd7,
    aqua: 0x00ffff,
    aquamarine: 0x7fffd4,
    azure: 0xf0ffff,
    beige: 0xf5f5dc,
    bisque: 0xffe4c4,
    black: 0x000000,
    blanchedalmond: 0xffebcd,
    blue: 0x0000ff,
    blueviolet: 0x8a2be2,
    brown: 0xa52a2a,
    burlywood: 0xdeb887,
    cadetblue: 0x5f9ea0,
    chartreuse: 0x7fff00,
    chocolate: 0xd2691e,
    coral: 0xff7f50,
    cornflowerblue: 0x6495ed,
    cornsilk: 0xfff8dc,
    crimson: 0xdc143c,
    cyan: 0x00ffff,
    darkblue: 0x00008b,
    darkcyan: 0x008b8b,
    darkgoldenrod: 0xb8860b,
    darkgray: 0xa9a9a9,
    darkgreen: 0x006400,
    darkgrey: 0xa9a9a9,
    darkkhaki: 0xbdb76b,
    darkmagenta: 0x8b008b,
    darkolivegreen: 0x556b2f,
    darkorange: 0xff8c00,
    darkorchid: 0x9932cc,
    darkred: 0x8b0000,
    darksalmon: 0xe9967a,
    darkseagreen: 0x8fbc8f,
    darkslateblue: 0x483d8b,
    darkslategray: 0x2f4f4f,
    darkslategrey: 0x2f4f4f,
    darkturquoise: 0x00ced1,
    darkviolet: 0x9400d3,
    deeppink: 0xff1493,
    deepskyblue: 0x00bfff,
    dimgray: 0x696969,
    dimgrey: 0x696969,
    dodgerblue: 0x1e90ff,
    firebrick: 0xb22222,
    floralwhite: 0xfffaf0,
    forestgreen: 0x228b22,
    fuchsia: 0xff00ff,
    gainsboro: 0xdcdcdc,
    ghostwhite: 0xf8f8ff,
    gold: 0xffd700,
    goldenrod: 0xdaa520,
    gray: 0x808080,
    green: 0x008000,
    greenyellow: 0xadff2f,
    grey: 0x808080,
    honeydew: 0xf0fff0,
    hotpink: 0xff69b4,
    indianred: 0xcd5c5c,
    indigo: 0x4b0082,
    ivory: 0xfffff0,
    khaki: 0xf0e68c,
    lavender: 0xe6e6fa,
    lavenderblush: 0xfff0f5,
    lawngreen: 0x7cfc00,
    lemonchiffon: 0xfffacd,
    lightblue: 0xadd8e6,
    lightcoral: 0xf08080,
    lightcyan: 0xe0ffff,
    lightgoldenrodyellow: 0xfafad2,
    lightgray: 0xd3d3d3,
    lightgreen: 0x90ee90,
    lightgrey: 0xd3d3d3,
    lightpink: 0xffb6c1,
    lightsalmon: 0xffa07a,
    lightseagreen: 0x20b2aa,
    lightskyblue: 0x87cefa,
    lightslategray: 0x778899,
    lightslategrey: 0x778899,
    lightsteelblue: 0xb0c4de,
    lightyellow: 0xffffe0,
    lime: 0x00ff00,
    limegreen: 0x32cd32,
    linen: 0xfaf0e6,
    magenta: 0xff00ff,
    maroon: 0x800000,
    mediumaquamarine: 0x66cdaa,
    mediumblue: 0x0000cd,
    mediumorchid: 0xba55d3,
    mediumpurple: 0x9370db,
    mediumseagreen: 0x3cb371,
    mediumslateblue: 0x7b68ee,
    mediumspringgreen: 0x00fa9a,
    mediumturquoise: 0x48d1cc,
    mediumvioletred: 0xc71585,
    midnightblue: 0x191970,
    mintcream: 0xf5fffa,
    mistyrose: 0xffe4e1,
    moccasin: 0xffe4b5,
    navajowhite: 0xffdead,
    navy: 0x000080,
    oldlace: 0xfdf5e6,
    olive: 0x808000,
    olivedrab: 0x6b8e23,
    orange: 0xffa500,
    orangered: 0xff4500,
    orchid: 0xda70d6,
    palegoldenrod: 0xeee8aa,
    palegreen: 0x98fb98,
    paleturquoise: 0xafeeee,
    palevioletred: 0xdb7093,
    papayawhip: 0xffefd5,
    peachpuff: 0xffdab9,
    peru: 0xcd853f,
    pink: 0xffc0cb,
    plum: 0xdda0dd,
    powderblue: 0xb0e0e6,
    purple: 0x800080,
    rebeccapurple: 0x663399,
    red: 0xff0000,
    rosybrown: 0xbc8f8f,
    royalblue: 0x4169e1,
    saddlebrown: 0x8b4513,
    salmon: 0xfa8072,
    sandybrown: 0xf4a460,
    seagreen: 0x2e8b57,
    seashell: 0xfff5ee,
    sienna: 0xa0522d,
    silver: 0xc0c0c0,
    skyblue: 0x87ceeb,
    slateblue: 0x6a5acd,
    slategray: 0x708090,
    slategrey: 0x708090,
    snow: 0xfffafa,
    springgreen: 0x00ff7f,
    steelblue: 0x4682b4,
    tan: 0xd2b48c,
    teal: 0x008080,
    thistle: 0xd8bfd8,
    tomato: 0xff6347,
    turquoise: 0x40e0d0,
    violet: 0xee82ee,
    wheat: 0xf5deb3,
    white: 0xffffff,
    whitesmoke: 0xf5f5f5,
    yellow: 0xffff00,
    yellowgreen: 0x9acd32,
    // System colors
    // https://developer.mozilla.org/en-US/docs/Web/CSS/color_value
    // Values taken from Chrome on macOS, but probably pretty standard
    activetext: 0xff0000,
    buttonface: 0xdddddd,
    buttontext: 0x000000,
    canvas: 0xffffff,
    canvastext: 0x000000,
    field: 0xffffff,
    fieldtext: 0x000000,
    graytext: 0x808080,
    highlight: 0xb5d5ff,
    highlighttext: 0x000000,
    linktext: 0x0000ee,
    visitedtext: 0x551a8b,
    // Deprecated system colors
    // https://developer.mozilla.org/en-US/docs/Web/CSS/color_value
    // Values taken from Chrome on macOS, but probably pretty standard
    activeborder: 0xffffff,
    activecaption: 0xcccccc,
    appworkspace: 0xffffff,
    background: 0x6363ce,
    buttonhighlight: 0xdddddd,
    buttonshadow: 0x888888,
    captiontext: 0x000000,
    inactiveborder: 0xffffff,
    inactivecaption: 0xffffff,
    inactivecaptiontext: 0x7f7f7f,
    infobackground: 0xfbfcc5,
    infotext: 0x000000,
    menu: 0xf7f7f7,
    menutext: 0x000000,
    scrollbar: 0xffffff,
    threeddarkshadow: 0x666666,
    threedface: 0xc0c0c0,
    threedhighlight: 0xdddddd,
    threedlightshadow: 0xc0c0c0,
    threedshadow: 0x888888,
    window: 0xffffff,
    windowframe: 0xcccccc,
    windowtext: 0x000000,
};

const cssColorRegEx = new RegExp(
    '#(?:[0-9a-f]{3,4}){1,2}|(?:rgb|hsl)a?\\(.*?\\)|\\b(?:' +
        Object.keys(cssColorNames).join('|') +
        ')\\b',
    'ig',
);

Object.assign(Color, {
    RGB,
    HSL,
    LAB,

    cssColorRegEx,
    cssColorNames,

    fromCSSColorValue(color) {
        let opacity = 1;
        let r;
        let g;
        let b;
        let parts;
        color = color.toLowerCase();
        if (color in cssColorNames) {
            const number = cssColorNames[color];
            r = getDoubleByte(number, 2);
            g = getDoubleByte(number, 1);
            b = getDoubleByte(number, 0);
        } else if (color.charAt(0) === '#') {
            const number = parseInt(color.slice(1), 16) || 0;
            const size = color.length;
            const getChannel = size < 6 ? getByteDoubled : getDoubleByte;
            let alphaOffset = 0;
            if (size === 5 || size === 9) {
                opacity = getChannel(number, 0) / 255;
                alphaOffset = 1;
            }
            r = getChannel(number, alphaOffset + 2);
            g = getChannel(number, alphaOffset + 1);
            b = getChannel(number, alphaOffset + 0);
        } else if (/^rgb/i.test(color) && (parts = splitColor(color))) {
            r = parseNumber(parts[0], 255);
            g = parseNumber(parts[1], 255);
            b = parseNumber(parts[2], 255);
            if (parts.length > 3) {
                opacity = parseNumber(parts[3], 1);
            }
        } else if (/^hsl/i.test(color) && (parts = splitColor(color))) {
            const h = parseNumber(parts[0], 360);
            const s = parseNumber(parts[1], 1);
            const l = parseNumber(parts[2], 1);
            if (parts.length > 3) {
                opacity = parseNumber(parts[3], 1);
            }
            return new HSL(h, s, l, opacity);
        } else {
            return null;
        }
        return new RGB(r, g, b, opacity);
    },

    fromJSON(color) {
        return color ? Color.fromCSSColorValue(color) : null;
    },
});

export default Color;
