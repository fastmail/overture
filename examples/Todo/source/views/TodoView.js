import { AnimatableView } from '/overture/animation';
import { Class } from '/overture/core';
import { el, lookupKey } from '/overture/dom';
import { Draggable } from '/overture/drag';
import { bind, bindTwoWay } from '/overture/foundation';
import { CheckboxView, ListItemView, TextInputView, when } from '/overture/views';

import { actions, selectedTodo, state, store } from '../app';

/* The TodoView is used to render a Todo. The content property (set
   automatically by the ListView) is expected to be an instance of Todo.
*/
const TodoView = Class({
    Name: 'TodoView',

    Extends: ListItemView,

    /* By mixing in AnimatableView, any changes to the "layout" property will
       automatically be animated. Mixing in Draggable allows a drag to be
       initiated on the view.
    */
    Mixin: [ AnimatableView, Draggable ],

    /* Turn off animation by default (it's just enabled while dragging)
       Also make the duration shorter than the default.
    */
    animateLayer: false,
    animateLayerDuration: 200,

    isComplete: bind( 'content.isComplete' ),

    /* Inside a binding transform, `this` is the binding itself. We want to
       compare the object with Todo of this view, which can be found as the
       content property on the binding's toObject.
    */
    isEditing: bind( state, 'editTodo', function ( editTodo ) {
        return this.toObject.get( 'content' ) === editTodo;
    }),

    isSelected: bind( selectedTodo, 'record', function ( record ) {
        return this.toObject.get( 'content' ) === record;
    }),

    /* We define what the classname should be; Overture handles redrawing the
       DOM node to keep it in sync.
    */
    className: function () {
        return 'v-Todo ' +
            ( this.get( 'isComplete' ) ? ' is-complete' : '' ) +
            ( this.get( 'isSelected' ) ? ' is-selected' : '' ) +
            ( this.get( 'isEditing' )  ? ' is-editing'  : '' );
    }.property('isComplete', 'isSelected', 'isEditing' ),

    /* Position the view absolutely to make it easy to animate.
    */
    itemHeight: 48,

    /* When dragging, we'll set the layout manually from the drag handlers.
       Otherwise, the layout purely depends on how far down the list we are.
    */
    layout: function ( y ) {
        if ( y === undefined ) {
            y = ( this.get( 'index' ) * this.get( 'itemHeight' ) );
        }
        return {
            zIndex: this.get( 'isDragging' ) ? '1' : 'auto',
            transform: 'translate3d(0,' + y + 'px,0)'
        };
    }.property( 'isDragging' ),

    /* We would normally make index one of the computed property dependencies
       of layout, but because we don't want it to reset while dragging, we
       do it manually in this observer instead (automatically triggered
       whenever the index property chagnes).
    */
    invalidateLayout: function () {
        if ( !this.get( 'isDragging' ) ) {
            this.computedPropertyDidChange( 'layout' );
        }
    }.observes( 'index' ),

    /* Draw the view. Since it's such a common pattern, we can just return an
       array of children to be appended to the layer (the root node of the
       view).

       Note, we can append other view instances as well as DOM nodes.
    */
    draw (/* layer */) {
        const todo = this.get( 'content' );
        return [
            new CheckboxView({
                positioning: 'absolute',
                /* Two-way bindings are rarely needed, but here we use one to
                   keep the checkbox in sync with the todo state, but also allow
                   you to use the checkbox to update the todo.
                */
                value: bindTwoWay( todo, 'isComplete' )
            }),
            /* when is a shortcut for creating an SwitchView
               instance; essentially a live-updating if/else.
            */
            when( this, 'isEditing' ).show([
                el( 'div.v-Todo-summary', [
                    new TextInputView({
                        value: bindTwoWay( todo, 'summary' ),
                        autoFocus: function () {
                            if ( this.get( 'isInDocument' ) ) {
                                this.focus();
                            }
                        }.observes( 'isInDocument' )
                    })
                ])
            ]).otherwise([
                el( 'div.v-Todo-summary', {
                    /* You can bind directly to DOM properties (text is a
                       special case to save you having to write textContent
                       every time)
                    */
                    text: bind( todo, 'summary' )
                })
            ]).end()
            // el( 'div.v-Todo-date', {
            //     text: bind( todo, 'start', function ( date ) {
            //         return date ? i18n.date( date, 'date', true ) : '';
            //     })
            // })
        ];
    },

    /* This method will trigger whenever you click on the View (or any of its
       child elements/views). Events are handled via delegation, and actual
       setup of the handler is done on class definition, so there is zero
       overhead when instantiating instances of TodoView.
    */
    select: function ( event ) {
        if ( !this.get( 'isSelected' ) ) {
            state.set( 'editTodo', null );
            selectedTodo.set( 'record', this.get( 'content' ) );
        }
        /* Stop propagation so the click handler on the root view isn't
           triggered.
        */
        event.stopPropagation();
    }.on( 'click' ),

    edit: function ( event ) {
        if ( !this.get( 'isEditing' ) ) {
            selectedTodo.set( 'record', this.get( 'content' ) );
            actions.edit();
        }
        event.stopPropagation();
    }.on( 'dblclick' ),

    stopEditing: function ( event ) {
        if ( this.get( 'isEditing' ) ) {
            const key = lookupKey( event );
            if ( key === 'Enter' || key === 'Escape' ) {
                state.set( 'editTodo', null );
                event.stopPropagation();
            }
        }
    }.on( 'keydown' ),

    /* Handle dragging. When the user first starts to drag the view, this
       method is called. We'll record the initial position of the view, and
       pre-calculate the height. Then we turn animation on for all *other*
       instances of TodoView (we don't want to animate this one, as it's going
       to track the cursor).
    */
    dragStarted ( drag ) {
        const itemHeight = this.get( 'itemHeight' );
        drag.startY = this.get( 'index' ) * itemHeight;
        drag.maxY = ( this.getFromPath( 'list.length' ) - 1 ) * itemHeight;
        this.animateLayer = false;
        TodoView.prototype.animateLayer = true;
    },

    /* On move, update the position of this view, and work out if we have moved
       it to a new index in the list. If so, call the action to update the
       store. This will automatically update any affected views, and because
       animation is enabled, they will animate to their new positions.
    */
    dragMoved ( drag ) {
        const cursorPosition = drag.get( 'cursorPosition' );
            const startPosition = drag.get( 'startPosition' );
            const y = Math.max( 0, Math.min( drag.maxY,
                    drag.startY + ( cursorPosition.y - startPosition.y ) ) );
            const currentIndex = this.get( 'index' );
            const newIndex = Math.round( y / this.get( 'itemHeight' ) );
        if ( newIndex !== currentIndex ) {
            actions.reorderTodo(
                this.get( 'list' ), this.get( 'content' ), newIndex
            );
        }
        this.set( 'layout', y );
    },

    /* Cleanup on drag end */
    dragEnded () {
        delete this.animateLayer;
        TodoView.prototype.animateLayer = false;
        store.commitChanges();
    }
});

export { TodoView };
