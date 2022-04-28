/* { property } from */
import '../../foundation/Decorators.js';

/**
    Mixin: O.TrueVisibleRect

    The TrueVisibleRect mixin can be added to view classes to make the
    <O.View#visibleRect> property take into account clipping by the parent view.
    This is more expensive, so should only be used in classes where this is
    absolutely necessary, for example in <O.ProgressiveListView>, where it is
    used to only render the visible portion of a potentially very long list.
*/
const TrueVisibleRect = {
    visibleRect: function () {
        // Ignore any changes whilst not in the DOM
        if (!this.get('isInDocument')) {
            return { x: 0, y: 0, width: 0, height: 0 };
        }
        // Calculate current visible rect.
        const x = this.get('pxLeft');
        const y = this.get('pxTop');
        const width = this.get('pxWidth');
        const height = this.get('pxHeight');
        const parent = this.get('parentView').get('visibleRect');

        const left = Math.max(x, parent.x);
        const right = Math.min(x + width, parent.x + parent.width);
        const top = Math.max(y, parent.y);
        const bottom = Math.min(y + height, parent.y + parent.height);
        const across = Math.max(right - left, 0);
        const down = Math.max(bottom - top, 0);

        return {
            x: left - x + this.get('scrollLeft'),
            y: top - y + this.get('scrollTop'),
            width: across,
            height: down,
        };
    }.property(
        'scrollTop',
        'scrollLeft',
        'pxLayout',
        'parentView.visibleRect',
        'isInDocument',
    ),
};

export { TrueVisibleRect };
