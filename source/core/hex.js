const HEX_TO_4_BITS = {
    0: 0,
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
    7: 7,
    8: 8,
    9: 9,
    a: 10,
    b: 11,
    c: 12,
    d: 13,
    e: 14,
    f: 15,
};

const HEX_CHARS = '0123456789abcdef'.split('');
const BYTE_TO_HEX = new Array(256);
for (let i = 0; i < 256; i += 1) {
    BYTE_TO_HEX[i] = HEX_CHARS[i >> 4] + HEX_CHARS[i & 15];
}

// ---

export { HEX_TO_4_BITS, BYTE_TO_HEX };
