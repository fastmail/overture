import { AbstractEventSource, OPEN } from './AbstractEventSource.js';

/*global XMLHttpRequest */

class LegacyEventSource extends AbstractEventSource {
    _fetchStream() {
        const xhr = new XMLHttpRequest();
        const [options, resetTimeout] = this._didStartFetch(xhr);

        let processedIndex = 0;
        let lastIndex = 0;
        const newLine = /\r\n?|\n/g;
        const processData = (text) => {
            const newLength = text.length;
            if (processedIndex === newLength) {
                return;
            }
            resetTimeout();
            // One leading U+FEFF BYTE ORDER MARK character must be ignored if
            // any are present.
            if (!lastIndex && text.charAt(0) === '\ufeff') {
                lastIndex = 1;
            }
            newLine.lastIndex = processedIndex;
            let match;
            while ((match = newLine.exec(text))) {
                this._processLine(text.slice(lastIndex, match.index));
                lastIndex = newLine.lastIndex;
            }
            processedIndex = newLength;
        };

        xhr.open('GET', this.url, true);
        xhr.withCredentials = options.credentials === 'include';
        xhr.responseType = 'text';
        for (const name in options.headers) {
            xhr.setRequestHeader(name, options.headers[name]);
        }
        let isEventStream = false;
        let status = 0;
        xhr.onreadystatechange = () => {
            const readyState = xhr.readyState;
            if (readyState === 2) {
                status = xhr.status;
                if (
                    status === 200 &&
                    /^text[/]event-stream(?:;|$)/.test(
                        xhr.getResponseHeader('Content-Type'),
                    )
                ) {
                    isEventStream = true;
                    this._reconnectAfter = 0;
                    this.readyState = OPEN;
                    resetTimeout();
                } else {
                    xhr.abort();
                }
            }
            if (isEventStream && readyState === 3) {
                processData(xhr.response);
            }
            if (readyState === 4) {
                if (isEventStream) {
                    processData(xhr.response + '\n\n');
                }
                this._didFinishFetch(xhr, isEventStream || !status, status);
            }
        };
        xhr.send();
    }
}

export { LegacyEventSource as EventSource };
