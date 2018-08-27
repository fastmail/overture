import { guid, Class } from '../../core/Core';
import { bind } from '../../foundation/Binding';
import { DESTROYED } from '../../datastore/record/Status';
import ListView from './ListView';
import ScrollView from '../containers/ScrollView';

const OptionsListView = Class({

    Extends: ListView,

    init () {
        this._focusedOption = null;
        this._selectedOption = null;
        this._views = {};

        OptionsListView.parent.constructor.apply( this, arguments );
    },

    layerTag: 'ul',

    itemHeightDidChange: function () {
        const itemHeight = this.get( 'itemHeight' );
        const views = this._views;
        for ( const id in views ) {
            views[ id ].set( 'itemHeight', itemHeight );
        }
    }.observes( 'itemHeight' ),

    // ---

    focusedOption: bind( 'controller*focused' ),
    selectedOption: bind( 'controller*selected' ),

    createItemView ( item, index, list ) {
        const itemHeight = this.get( 'itemHeight' );
        const id = guid( item );
        const View = this.getViewTypeForItem( item );
        let view = this._views[ id ];

        if ( view ) {
            view.set( 'index', index )
                .set( 'list', list )
                .set( 'parentView', this );
        } else {
            const isFocused = ( item === this.get( 'focusedOption' ) );
            const isSelected = ( item === this.get( 'selectedOption' ) );
            view = this._views[ id ] = new View({
                controller: this.get( 'controller' ),
                parentView: this,
                content: item,
                index,
                list,
                itemHeight,
                isFocused,
                isSelected,
            });
            if ( isFocused ) {
                this._focusedOption = view;
            }
            if ( isSelected ) {
                this._selectedOption = view;
            }
        }
        return view;
    },

    destroyItemView ( view ) {
        const item = view.get( 'content' );
        if ( item.isDestroyed || ( item.is && item.is( DESTROYED ) ) ) {
            view.destroy();
            delete this._views[ guid( item ) ];
        }
    },

    getView ( item ) {
        return this._views[ guid( item ) ] || null;
    },

    redrawFocused: function () {
        const item = this.get( 'focusedOption' );
        const oldView = this._focusedOption;
        const newView = item && this.getView( item );
        if ( oldView !== newView ) {
            if ( oldView ) {
                oldView.set( 'isFocused', false );
            }
            if ( newView ) {
                newView.set( 'isFocused', true );
                this.scrollIntoView( newView );
            }
            this._focusedOption = newView;
        }
    }.observes( 'focusedOption' ),

    redrawSelected: function () {
        const item = this.get( 'selectedOption' );
        const oldView = this._selectedOption;
        const newView = item && this.getView( item );
        if ( oldView !== newView ) {
            if ( oldView ) {
                oldView.set( 'isSelected', false );
            }
            if ( newView ) {
                newView.set( 'isSelected', true );
                this.scrollIntoView( newView );
            }
            this._selectedOption = newView;
        }
    }.observes( 'selectedOption' ),

    scrollIntoView ( view ) {
        const scrollView = this.getParent( ScrollView );
        if ( !scrollView || !this.get( 'isInDocument' ) ) {
            return;
        }
        const scrollHeight = scrollView.get( 'pxHeight' );
        const scrollTop = scrollView.get( 'scrollTop' );
        const top = view.getPositionRelativeTo( scrollView ).top;
        const height = view.get( 'pxHeight' );

        if ( top < scrollTop ) {
            scrollView.scrollTo( 0, top - ( height >> 1 ), true );
        } else if ( top + height > scrollTop + scrollHeight ) {
            scrollView.scrollTo( 0,
                top + height - scrollHeight + ( height >> 1 ), true );
        }
    },
});

export default OptionsListView;
