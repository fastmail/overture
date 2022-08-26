// Opt into updates via HMR
if (import.meta.hot) {
    import.meta.hot.accept(() => {});
}

export { AppView } from './AppView.js';
export { TodoView } from './TodoView.js';
