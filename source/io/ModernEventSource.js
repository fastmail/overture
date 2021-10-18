import { AbstractEventSource, OPEN } from './AbstractEventSource.js';

/*global AbortController, TextDecoder, URL, fetch */

const readLineFromStream = async function* (reader, resetTimeout) {
    const utf8decoder = new TextDecoder('utf-8');
    let remainder = '';
    let hasSeenFirstByte = false;
    for (;;) {
        const { value, done } = await reader.read();
        // There may be bytes we haven't seen in the decoder,
        // but doesn't matter; we can't do anything with them.
        if (done) {
            return;
        }
        resetTimeout();
        let chunk = utf8decoder.decode(value, { stream: true });
        if (!hasSeenFirstByte && chunk) {
            // One leading U+FEFF BYTE ORDER MARK character must be ignored if
            // present.
            if (chunk.charAt(0) === '\ufeff') {
                chunk = chunk.slice(1);
            }
            hasSeenFirstByte = true;
        }
        let endOfLine;
        while ((endOfLine = /\r\n?|\n/.exec(chunk))) {
            const index = endOfLine.index;
            yield remainder + chunk.slice(0, index);
            chunk = chunk.slice(index + endOfLine[0].length);
            remainder = '';
        }
        remainder += chunk;
    }
};

class ModernEventSource extends AbstractEventSource {
    async _fetchStream() {
        const abortController = new AbortController();
        const [options, resetTimeout] = this._didStartFetch(abortController);

        let response = null;
        let didNetworkError = false;
        try {
            response = await fetch(this.url, options);
        } catch (error) {
            didNetworkError = true;
        }

        const status = response ? response.status : 0;
        if (
            status === 200 &&
            /^text[/]event-stream(?:;|$)/.test(
                response.headers.get('Content-Type'),
            )
        ) {
            this._reconnectAfter = 0;
            this._origin = new URL(response.url).origin;
            this.readyState = OPEN;

            try {
                const reader = response.body.getReader();
                for await (const line of readLineFromStream(
                    reader,
                    resetTimeout,
                )) {
                    this._processLine(line);
                }
            } catch (error) {
                // Stream broke; user aborted or we lost network. If
                // our status is not closed (i.e., the user didn't explicitly
                // close the event source) we'll reconnect.
            }
            // Also reconnect if the server just closed the connection.
            didNetworkError = true;
        } else {
            abortController.abort();
        }
        this._abortController = null;

        this._didFinishFetch(didNetworkError, status, response);
    }
}

export { ModernEventSource as EventSource };
