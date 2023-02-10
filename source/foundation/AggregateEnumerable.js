import { Class } from '../core/Core.js';
import { Enumerable } from './Enumerable.js';
import { Obj } from './Object.js';

/* { property } from */
import './Decorators.js';

// ---

// The data is immutable, so no need for observability.
const AggregateEnumerable = Class({
    Name: 'AggregateEnumerable',

    Extends: Obj,

    Mixin: [Enumerable],

    init: function (sources, ...args) {
        this._sources = sources;
        AggregateEnumerable.parent.init.apply(this, args);
    },

    length: function () {
        return this._sources.reduce(
            (length, source) => length + source.get('length'),
            0,
        );
    }.property(),

    getObjectAt(i) {
        const sources = this._sources;
        for (let j = 0, l = sources.get('length'); j < l; j += 1) {
            const source = sources.getObjectAt(j);
            const sourceLength = source.get('length');
            if (sourceLength - 1 < i) {
                i -= sourceLength;
                continue;
            }
            return source.getObjectAt(i);
        }
        return undefined;
    },
});

// ---

export { AggregateEnumerable };
