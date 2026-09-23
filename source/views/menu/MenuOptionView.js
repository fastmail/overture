import { Class } from '../../core/Core.js';
import { create as el } from '../../dom/Element.js';
import { cancel, invokeAfterDelay } from '../../foundation/RunLoop.js';
import { PopOverView } from '../panels/PopOverView.js';
import { View } from '../View.js';

/* { property, on, observes } from */
import '../../foundation/Decorators.js';

// ---

const POINTER_LOCATIONS_TRACKED = 3;
const AIM_RECHECK_DELAY = 100;
const AIM_TOLERANCE = 40;

const recentPointerLocations = [];

const cross = (o, a, b) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

const isInTriangle = (p, a, b, c) => {
    const d1 = cross(a, b, p);
    const d2 = cross(b, c, p);
    const d3 = cross(c, a, p);
    const hasNegative = d1 < 0 || d2 < 0 || d3 < 0;
    const hasPositive = d1 > 0 || d2 > 0 || d3 > 0;
    return !(hasNegative && hasPositive);
};

// Is the pointer moving towards the open submenu? True if its current
// location is inside the triangle formed by an earlier location and the near
// edge of the submenu, i.e. it's travelling diagonally across other options
// to get there.
const isAimingAtSubMenu = (optionView, popOverView) => {
    const current = recentPointerLocations.last();
    const previous = recentPointerLocations[0];
    if (!current || current === previous) {
        return false;
    }
    const optionRect = optionView.get('layer').getBoundingClientRect();
    const subMenuRect = popOverView
        .get('subPopOverView')
        .get('options')
        .view.get('layer')
        .getBoundingClientRect();
    const isToTheRight =
        subMenuRect.left + subMenuRect.right >
        optionRect.left + optionRect.right;
    const x = isToTheRight ? subMenuRect.left : subMenuRect.right;
    return isInTriangle(
        current,
        previous,
        { x, y: subMenuRect.top - AIM_TOLERANCE },
        { x, y: subMenuRect.bottom + AIM_TOLERANCE },
    );
};

const MenuOptionView = Class({
    Name: 'MenuOptionView',

    Extends: View,

    isFocused: false,

    layerTag: 'li',

    className: function () {
        return (
            'v-MenuOption' +
            (this.get('content').get('button').get('isLastOfSection') &&
            this.get('index') < this.getFromPath('list.length') - 1
                ? ' v-MenuOption--lastOfSection'
                : '') +
            (this.get('isFocused') ? ' is-focused' : '')
        );
    }.property('isFocused'),

    draw(/* layer */) {
        const button = this.get('content').get('button');
        const title = button.get('sectionTitle');
        return [title ? el('h2.v-MenuOption-title', [title]) : null, button];
    },

    _focusTimeout: null,
    _aimLocation: null,

    takeFocus() {
        if (this.get('isInDocument')) {
            this.get('controller').focus(this.get('content')).expandFocused();
        }
    },

    loseFocus() {
        this.get('controller').focus(null);
    },

    _takeFocusUnlessStillAiming() {
        const location = recentPointerLocations.last();
        if (location !== this._aimLocation) {
            this._aimLocation = location;
            this._focusTimeout = invokeAfterDelay(
                this._takeFocusUnlessStillAiming,
                AIM_RECHECK_DELAY,
                this,
            );
        } else {
            this._focusTimeout = null;
            this._aimLocation = null;
            this.takeFocus();
        }
    },

    mousemove: function (event) {
        if (event.type === 'pointermove' && event.pointerType !== 'mouse') {
            return;
        }
        recentPointerLocations.push({ x: event.clientX, y: event.clientY });
        if (recentPointerLocations.length > POINTER_LOCATIONS_TRACKED) {
            recentPointerLocations.shift();
        }
        if (this.get('isFocused')) {
            return;
        }
        const popOverView = this.getParent(PopOverView);
        if (
            popOverView &&
            popOverView.hasSubView() &&
            isAimingAtSubMenu(this, popOverView)
        ) {
            // Wait until the pointer stops or turns away before taking focus,
            // which would close the submenu.
            if (!this._focusTimeout) {
                this._aimLocation = recentPointerLocations.last();
                this._focusTimeout = invokeAfterDelay(
                    this._takeFocusUnlessStillAiming,
                    AIM_RECHECK_DELAY,
                    this,
                );
            }
        } else {
            if (this._focusTimeout) {
                cancel(this._focusTimeout);
                this._focusTimeout = null;
                this._aimLocation = null;
            }
            this.takeFocus();
        }
    }.on('pointermove'),

    mouseout: function () {
        if (this._focusTimeout) {
            cancel(this._focusTimeout);
            this._focusTimeout = null;
            this._aimLocation = null;
        }
        if (
            this.get('isFocused') &&
            !this.get('childViews')[0].get('isActive')
        ) {
            this.loseFocus();
        }
    }.on('pointerout'),
});

export { MenuOptionView };
