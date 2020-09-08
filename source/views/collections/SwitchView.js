import { isDestroyed, Class } from '../../core/Core';
import { bind } from '../../foundation/Binding';
import * as RunLoop from '../../foundation/RunLoop';
import '../../foundation/ComputedProps'; // For Function#property
import '../../foundation/ObservableProps'; // For Function#observes
import View from '../View';
import { forView } from '../../dom/Element';

const forEachView = function (views, method, args) {
    let l = views ? views.length : 0;
    while (l--) {
        const view = views[l];
        if (view instanceof View && !isDestroyed(view)) {
            if (args) {
                view[method].apply(view, args);
            } else {
                view[method]();
            }
        }
    }
};

const flattenAndPrune = function (array, node) {
    if (node instanceof Array) {
        node.reduce(flattenAndPrune, array);
    } else if (node) {
        array.push(node);
    }
    return array;
};

const SwitchView = Class({
    Extends: View,

    syncOnlyInDocument: false,

    init: function (/* ...mixins */) {
        this._oldView = null;
        // -1 => Not added views to parent
        // Otherwise => Index of view(s) currently in parent
        this._index = -1;

        // Index of view that should be in parent.
        this.index = 0;
        this.views = [];
        this.subViews = [];

        SwitchView.parent.constructor.apply(this, arguments);

        this.isRendered = true;

        const views = this.get('views');
        let l = views.length;
        let view;
        while (l--) {
            view = views[l];
            if (view && !(view instanceof Array)) {
                views[l] = [view];
            }
        }
    },

    destroy() {
        let views = this.get('views');
        let l = views.length;
        while (l--) {
            forEachView(views[l], 'destroy');
        }
        views = this.get('subViews');
        l = views.length;
        while (l--) {
            forEachView(views[l], 'destroy');
        }
        SwitchView.parent.destroy.call(this);
    },

    // ---

    layer: function () {
        return document.createComment('SwitchView ' + this.get('id'));
    }.property(),

    willEnterDocument() {
        this.resume();
        this.redraw();
        return this;
    },

    didEnterDocument() {
        this.set('isInDocument', true);
        if (this.get('index') !== this._index) {
            this.switchNeedsRedraw();
        }
        return this;
    },

    willLeaveDocument() {
        return this.set('isInDocument', false);
    },

    didLeaveDocument() {
        return this.suspend();
    },

    // ---

    redraw() {
        const oldIndex = this._index;
        const newIndex = this.get('index');
        // If not yet added to parent, nothing to redraw; _add will be called
        // automatically soon.
        if (oldIndex > -1 && oldIndex !== newIndex && !isDestroyed(this)) {
            if (this._suspendRedraw) {
                this._needsRedraw = [];
            } else {
                this._needsRedraw = null;
                const parentView = this.get('parentView');
                if (parentView) {
                    this._remove(parentView);
                    this._add();
                }
            }
        }
    },

    switchNeedsRedraw: function () {
        if (this.get('isInDocument')) {
            if (this._suspendRedraw) {
                this._needsRedraw = [];
            } else {
                RunLoop.queueFn('render', this.redraw, this);
            }
        }
    }.observes('index'),

    parentViewDidChange: function (_, __, oldParent, newParent) {
        if (oldParent) {
            // May be a NOP, but just in case.
            oldParent.removeObserverForKey('childViews', this, '_add');
            this._remove(oldParent);
        }
        if (newParent) {
            if (newParent.get('childViews').includes(this)) {
                // If we already know where we are in the parent view, we can
                // add our real views immediately.
                this._add();
            } else {
                // Otherwise, we need to wait until we've been inserted to know
                // where our DOM marker has been placed, and where the view is
                // in the list of child views.
                newParent.addObserverForKey('childViews', this, '_add');
            }
        }
    }.observes('parentView'),

    _add() {
        const index = this.get('index');
        const views = this.get('views')[index];
        const subViews = this.get('subViews')[index];
        const parent = this.get('parentView');
        const isInDocument = parent.get('isInDocument');
        const position = this.get('layer');
        const layer = position.parentNode;

        // May be a NOP, but just in case.
        parent.removeObserverForKey('childViews', this, '_add');
        if (this._index !== -1) {
            return;
        }
        this._index = index;

        if (subViews) {
            forEachView(subViews, 'set', ['parentView', parent]);
            if (isInDocument) {
                forEachView(subViews, 'willEnterDocument');
            }
        }

        let l = views ? views.length : 0;
        while (l--) {
            let node = views[l];
            if (node instanceof View) {
                parent.insertView(node, this, 'after');
            } else {
                if (typeof node !== 'object') {
                    node = views[l] = document.createTextNode(node);
                }
                const before = position.nextSibling;
                if (before) {
                    layer.insertBefore(node, before);
                } else {
                    layer.appendChild(node);
                }
            }
        }

        if (subViews) {
            if (isInDocument) {
                forEachView(subViews, 'didEnterDocument');
            }
            Array.prototype.push.apply(parent.get('childViews'), subViews);
            parent.propertyDidChange('childViews');
        }
    },

    _remove(parent) {
        const oldIndex = this._index;
        const views = this.get('views')[oldIndex];
        const subViews = this.get('subViews')[oldIndex];
        const isInDocument = parent.get('isInDocument');

        if (isInDocument && subViews) {
            forEachView(subViews, 'willLeaveDocument');
        }

        let l = views ? views.length : 0;
        while (l--) {
            const node = views[l];
            if (node instanceof View) {
                parent.removeView(node);
            } else {
                node.parentNode.removeChild(node);
            }
        }

        if (subViews) {
            if (isInDocument) {
                forEachView(subViews, 'didLeaveDocument');
            }
            forEachView(subViews, 'set', ['parentView', null]);
            const childViews = parent.get('childViews');
            l = subViews.length;
            while (l--) {
                const view = subViews[l];
                let index = childViews.lastIndexOf(view);
                let numToRemove = 1;
                if (index > -1) {
                    while (
                        l > 0 &&
                        index > 0 &&
                        subViews[l - 1] === childViews[index - 1]
                    ) {
                        l -= 1;
                        index -= 1;
                        numToRemove += 1;
                    }
                    childViews.splice(index, numToRemove);
                }
            }
            parent.propertyDidChange('childViews');
        }
        this._index = -1;
    },

    // ---

    /*
        If views are inside el() methods, they will call this method. Collect
        them up, then pass them as subViews when show() or otherwise() is
        called.
    */
    insertView(view, parentNode) {
        this.childViews.push(view);
        const oldParent = view.get('parentView');
        if (oldParent) {
            oldParent.removeView(view);
        }
        parentNode.appendChild(view.render().get('layer'));
        return this;
    },

    case(index, view) {
        view = view ? (view instanceof Array ? view : [view]) : null;
        this.views[index] = view && view.reduce(flattenAndPrune, []);
        const subViews = this.childViews;
        if (subViews.length) {
            this.subViews[index] = subViews;
            this.childViews = [];
        }
        return this;
    },

    show(view) {
        return this.case(0, view);
    },

    otherwise(view) {
        return this.case(1, view);
    },

    end() {
        forView(this._oldView);
        this._oldView = null;
        return this;
    },
});

const pickViewWhen = function (bool) {
    return bool ? 0 : 1;
};
const pickViewUnless = function (bool) {
    return bool ? 1 : 0;
};

const choose = function (object, property, transform) {
    const switchView = new SwitchView({
        index: bind(object, property, transform),
    });
    switchView._oldView = forView(switchView);
    return switchView;
};

const when = function (object, property, transform) {
    const pickView = transform
        ? function (value, syncForward) {
              return pickViewWhen(transform(value, syncForward));
          }
        : pickViewWhen;
    // (The lint would complain that it expected .case().)
    // eslint-disable-next-line overture/switch-view-usage
    return choose(object, property, pickView);
};
const unless = function (object, property, transform) {
    const pickView = transform
        ? function (value, syncForward) {
              return pickViewUnless(transform(value, syncForward));
          }
        : pickViewUnless;
    // (The lint would complain that it expected .case().)
    // eslint-disable-next-line overture/switch-view-usage
    return choose(object, property, pickView);
};

export default SwitchView;
export { when, unless, choose };
