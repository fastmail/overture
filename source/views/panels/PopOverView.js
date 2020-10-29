import { Class, meta } from '../../core/Core.js';
import /* { on } from */ '../../foundation/Decorators.js';
import { lookupKey } from '../../dom/DOMEvent.js';
import { setStyle, create as el } from '../../dom/Element.js';
import { RootView } from '../RootView.js';
import { View } from '../View.js';
import { ViewEventsController } from '../ViewEventsController.js';

import { ModalEventHandler } from './ModalEventHandler.js';

const PopOverView = Class({
    Name: 'PopOverView',

    Extends: View,

    init: function () {
        this.parentPopOverView = null;
        this.isVisible = false;
        this.options = {};
        this._inResize = false;
        PopOverView.parent.init.apply(this, arguments);
    },

    className: function () {
        const options = this.get('options');
        const positionToThe = (options && options.positionToThe) || 'bottom';
        const alignEdge = (options && options.alignEdge) || 'left';
        const extra = options.className || '';
        return (
            'v-PopOverContainer' +
            ' v-PopOverContainer--p' +
            positionToThe.charAt(0) +
            ' v-PopOverContainer--a' +
            alignEdge.charAt(0) +
            (extra ? ' ' + extra : '')
        );
    }.property('options'),

    positioning: 'absolute',

    ariaAttributes: {
        modal: 'true',
    },

    draw(/* layer */) {
        const children = [
            (this._aFlex = el('div')),
            (this._popOver = el('div.v-PopOver', [
                (this._callout = el('b.v-PopOver-callout', [
                    el('b.v-PopOver-triangle'),
                ])),
            ])),
            (this._bFlex = el('div')),
        ];
        this.redrawLayer();
        return children;
    },

    redrawLayer() {
        const options = this.get('options');
        if (!options) {
            return;
        }
        const alignWithView = options.alignWithView;
        if (!alignWithView.get('isInDocument')) {
            this.hide();
            return;
        }
        const atNode =
            options.atNode ||
            (alignWithView === this.get('parentPopOverView')
                ? alignWithView._popOver
                : alignWithView.get('layer'));
        const positionToThe = options.positionToThe || 'bottom';
        const positionToTheLeftOrRight =
            positionToThe === 'left' || positionToThe === 'right';
        const alignEdge = options.alignEdge || 'left';
        const offsetTop = options.offsetTop || 0;
        const offsetLeft = options.offsetLeft || 0;
        const rootView = alignWithView.getParent(RootView);
        const position = atNode.getBoundingClientRect();
        const posTop = position.top;
        const posLeft = position.left;
        const posWidth = position.width;
        const posHeight = position.height;
        const aFlexEl = this._aFlex;
        const bFlexEl = this._bFlex;
        const popOverEl = this._popOver;
        const calloutEl = this._callout;
        const safeAreaInsetBottom = rootView.get('safeAreaInsetBottom');
        const layout = {};
        let calloutStyle = '';

        this.insertView(options.view, this._popOver);

        if (safeAreaInsetBottom) {
            layout.paddingBottom = safeAreaInsetBottom;
        }
        switch (positionToThe) {
            case 'top':
                layout.paddingBottom = Math.max(
                    safeAreaInsetBottom,
                    rootView.get('pxHeight') - posTop - offsetTop,
                );
                break;
            case 'right':
                layout.paddingLeft = posLeft + posWidth + offsetLeft;
                break;
            case 'bottom':
                layout.paddingTop = posTop + posHeight + offsetTop;
                break;
            case 'left':
                layout.paddingRight =
                    rootView.get('pxWidth') - posLeft - offsetLeft;
                break;
        }

        let aFlex;
        let bFlex;
        let startDistance;
        let endDistance;
        // 0% rather than 0 for IE11 compatibility due to Bug #4
        // in https://github.com/philipwalton/flexbugs
        switch (alignEdge) {
            case 'top':
                aFlex = '0 1 ' + (posTop + offsetTop) + 'px';
                bFlex = '1 0 0%';
                break;
            case 'middle':
                startDistance = Math.round(posTop + offsetTop + posHeight / 2);
                endDistance =
                    rootView.get('pxHeight') -
                    safeAreaInsetBottom -
                    startDistance;
                aFlex = startDistance + ' 0 0%';
                bFlex = endDistance + ' 0 0%';
                calloutStyle =
                    'top:' +
                    (100 * startDistance) / (startDistance + endDistance) +
                    '%';
                break;
            case 'bottom':
                aFlex = '1 0 0%';
                bFlex =
                    '0 1 ' +
                    (rootView.get('pxHeight') -
                        (posTop + posHeight + offsetTop)) +
                    'px';
                break;
            case 'left':
                aFlex = '0 1 ' + (posLeft + offsetLeft) + 'px';
                bFlex = '1 0 0%';
                break;
            case 'centre':
                startDistance = Math.round(posLeft + offsetLeft + posWidth / 2);
                endDistance = rootView.get('pxWidth') - startDistance;
                aFlex = startDistance + ' 0 0%';
                bFlex = endDistance + ' 0 0%';
                calloutStyle =
                    'left:' +
                    (100 * startDistance) / (startDistance + endDistance) +
                    '%';
                break;
            case 'right':
                aFlex = '1 0 0%';
                bFlex =
                    '0 1 ' +
                    (rootView.get('pxWidth') -
                        (posLeft + posWidth + offsetLeft)) +
                    'px';
                break;
        }

        if (!options.showCallout) {
            calloutStyle = 'display:none';
        }

        aFlexEl.className = positionToTheLeftOrRight
            ? 'v-PopOverContainer-top'
            : 'v-PopOverContainer-left';
        aFlexEl.style.cssText = 'flex:' + aFlex;
        bFlexEl.className = positionToTheLeftOrRight
            ? 'v-PopOverContainer-bottom'
            : 'v-PopOverContainer-right';
        bFlexEl.style.cssText = 'flex:' + bFlex;
        popOverEl.style.cssText = '';
        calloutEl.style.cssText = calloutStyle;

        this.set('layout', layout).redraw().keepInBounds();
    },

    /**
        Property: O.PopOverView#parentMargin
        Type: {top: number, left: number, right: number, bottom: number}

        The popover will ensure that it is at least N pixels away from each edge
        of the parent view.
    */
    parentMargin: {
        top: 10,
        left: 10,
        right: 10,
        bottom: 10,
    },

    keepInBounds: function () {
        if (!this.get('isInDocument')) {
            return;
        }
        const rootView = this.get('parentView');
        const popOverEl = this._popOver;
        const options = this.get('options');
        const positionToThe = options.positionToThe;
        const positionToTheLeftOrRight =
            positionToThe === 'left' || positionToThe === 'right';
        const parentMargin = this.get('parentMargin');
        let keepInVerticalBounds = options.keepInVerticalBounds;
        let keepInHorizontalBounds = options.keepInHorizontalBounds;
        let deltaLeft = 0;
        let deltaTop = 0;

        if (keepInHorizontalBounds === undefined) {
            keepInHorizontalBounds = !positionToTheLeftOrRight;
        }
        if (keepInVerticalBounds === undefined) {
            keepInVerticalBounds = positionToTheLeftOrRight;
        }

        // Check not run off screen. We only move it on the axis the pop over
        // has been positioned along. It is up to the contents to ensure the
        // pop over is not too long in the other direction.
        const position = popOverEl.getBoundingClientRect();
        let gap;

        if (keepInHorizontalBounds) {
            // Check right edge
            if (!rootView.get('showScrollbarX')) {
                gap = rootView.get('pxWidth') - position.right;
                // If gap is negative, move the view.
                if (gap < 0) {
                    deltaLeft += gap;
                    deltaLeft -= parentMargin.right;
                }
            }

            // Check left edge
            gap = position.left + deltaLeft;
            if (gap < 0) {
                deltaLeft -= gap;
                deltaLeft += parentMargin.left;
            }
        }
        if (keepInVerticalBounds) {
            // Check bottom edge
            if (!rootView.get('showScrollbarY')) {
                gap = rootView.get('pxHeight') - position.bottom;
                if (gap < 0) {
                    deltaTop += gap;
                    deltaTop -= parentMargin.bottom;
                }
            }

            // Check top edge
            gap = position.top + deltaTop;
            if (gap < 0) {
                deltaTop -= gap;
                deltaTop += parentMargin.top;
            }
        }

        setStyle(
            this._popOver,
            'transform',
            'translate(' + deltaLeft + 'px,' + deltaTop + 'px)',
        );
        setStyle(
            this._callout,
            'transform',
            'translate(' +
                (positionToTheLeftOrRight ? 0 : -deltaLeft) +
                'px,' +
                (positionToTheLeftOrRight ? -deltaTop : 0) +
                'px)',
        );
    }.queue('after'),

    viewNeedsRedraw: function () {
        this.propertyNeedsRedraw(this, 'layer');
    }.observes('options'),

    didResize() {
        if (!this._inResize) {
            // We redraw layer styles as part of redrawing layer; don't get
            // stuck in infinite call stack!
            this._inResize = true;
            if (this.get('options').alignWithView.get('isInDocument')) {
                this.redrawLayer();
            } else {
                this.hide();
            }
            this._inResize = false;
        }
    },

    /*
        Options
        - view -> The view to append to the pop over
        - alignWithView -> the view to align to
        - atNode -> the node within the view to align to
        - positionToThe -> 'bottom'/'top'/'left'/'right'
        - alignEdge -> 'left'/'centre'/'right'/'top'/'middle'/'bottom'
        - showCallout -> true/false
        - offsetLeft
        - offsetTop
        - resistHiding -> true to stop clicking outside or pressing Esc closing
          the popover, false for normal behaviour; may also be a function
          returning true or false
          (incidental note: this would be nicer if options was an O.Object)
        - onHide: fn
    */
    show(options) {
        const alignWithView = options.alignWithView;
        if (alignWithView === this) {
            return this.get('subPopOverView').show(options);
        }

        this.hide();
        this.set('options', options);
        alignWithView.getParent(RootView).insertView(this);

        const eventHandler = this.get('eventHandler');
        ViewEventsController.addEventTarget(eventHandler, 10);
        this.set('isVisible', true);

        return this;
    },

    didEnterDocument() {
        PopOverView.parent.didEnterDocument.call(this);
        this.getParent(RootView).addObserverForKey(
            'safeAreaInsetBottom',
            this,
            'viewNeedsRedraw',
        );
        return this;
    },

    willLeaveDocument() {
        this.getParent(RootView).removeObserverForKey(
            'safeAreaInsetBottom',
            this,
            'viewNeedsRedraw',
        );
        return PopOverView.parent.willLeaveDocument.call(this);
    },

    didLeaveDocument() {
        PopOverView.parent.didLeaveDocument.call(this);
        this.hide();
        return this;
    },

    hide() {
        if (this.get('isVisible')) {
            const subPopOverView = this.hasSubView()
                ? this.get('subPopOverView')
                : null;
            const eventHandler = this.get('eventHandler');
            const options = this.get('options');
            let onHide;
            if (subPopOverView) {
                subPopOverView.hide();
            }
            this.set('isVisible', false)
                .detach()
                .removeView(this.get('childViews')[0]);
            ViewEventsController.removeEventTarget(eventHandler);
            eventHandler._seenMouseDown = false;
            this.set('options', null);
            if ((onHide = options.onHide)) {
                onHide(options, this);
            }
        }
        return this;
    },

    hasSubView() {
        return (
            !!meta(this).cache.subPopOverView &&
            this.get('subPopOverView').get('isVisible')
        );
    },

    subPopOverView: function () {
        return new PopOverView({ parentPopOverView: this });
    }.property(),

    eventHandler: function () {
        return new ModalEventHandler({ view: this });
    }.property(),

    softHide() {
        const options = this.get('options');
        if (
            this.get('isVisible') &&
            (!options.resistHiding ||
                (typeof options.resistHiding === 'function' &&
                    !options.resistHiding()))
        ) {
            this.hide();
        }
    },

    clickedOutside() {
        let view = this;
        let parent;
        while ((parent = view.get('parentPopOverView'))) {
            view = parent;
        }
        view.softHide();
    },

    keyOutside(event) {
        this.get('childViews')[0].fire(event.type, event);
    },

    closeOnEsc: function (event) {
        if (lookupKey(event) === 'Escape') {
            this.softHide();
        }
    }.on('keydown'),

    stopEvents: function (event) {
        event.stopPropagation();
    }.on(
        'click',
        'mousedown',
        'mouseup',
        'keypress',
        'keydown',
        'keyup',
        'tap',
    ),
});

export { PopOverView };
