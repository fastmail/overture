import { EventSource } from '../io/ModernEventSource.js';

/*global Response, ReadableStream, TextEncoder */

class EventSourceProxy {
    constructor(url) {
        this.eventSource = new EventSource(url, {
            fireEvent: (event) => {
                this.dispatch(event);
            },
        });
        this.streams = new Map();
        this._lastEventId = '';
        this._lastChunk = null;
    }

    connect() {
        this.eventSource.open();
    }

    disconnect() {
        this.eventSource.close();
    }

    dispatch({ type, data, lastEventId }) {
        const lines = [];
        if (type !== 'message') {
            lines.push(`event:${type}`);
        }
        if (lastEventId) {
            lines.push(`id:${lastEventId}`);
        }
        if (data) {
            data.split('\n').forEach((datum) => {
                lines.push(`data:${datum}`);
            });
        }
        const chunk = new TextEncoder().encode(lines.join('\n') + '\n\n');
        if (lastEventId && lastEventId !== this._lastEventId) {
            this._lastEventId = lastEventId;
            this._lastChunk = chunk;
        }
        this.streams.forEach((streamController) =>
            streamController.enqueue(chunk),
        );
    }

    register(stream, streamController, lastEventId) {
        if (!this.streams.size) {
            this.connect();
        }
        this.streams.set(stream, streamController);
        // Firefox doesn't resolve fetch promise until first chunk, so make
        // sure we always send something immediately.
        const chunk =
            (lastEventId !== this._lastEventId && this._lastChunk) ||
            new TextEncoder().encode(':\n');
        streamController.enqueue(chunk);
    }

    deregister(stream) {
        this.streams.delete(stream);
        if (!this.streams.size) {
            this.disconnect();
        }
    }

    getResponseStream(request) {
        const proxy = this;
        const controller = {
            start(streamController) {
                proxy.register(
                    this,
                    streamController,
                    request.headers.get('Last-Event-ID'),
                );
            },
            cancel() {
                proxy.deregister(this);
            },
        };
        const stream = new ReadableStream(controller);
        // Not supported in any browser yet, but will be I hope!
        request.signal.addEventListener('abort', () => stream.cancel(), false);
        return new Response(stream, {
            status: 200,
            headers: {
                'Cache-Control': 'max-age=0, no-store',
                'Connection': 'keep-alive',
                'Content-Type': 'text/event-stream',
                'Transfer-Encoding': 'chunked',
            },
        });
    }
}

// ---

export { EventSourceProxy };
