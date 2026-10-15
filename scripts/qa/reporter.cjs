const { serializable } = require('./sanitize.cjs');

// Consume objetos del protocolo node:test, no interpreta texto TAP ni consola.
module.exports = async function* reporter(events) {
    for await (const event of events) {
        if (['test:enqueue', 'test:pass', 'test:fail', 'test:summary'].includes(event.type)) {
            yield JSON.stringify({ type: event.type, data: serializable(event.data) }) + '\n';
        }
        // stdout/stderr arbitrarios de la aplicación no se publican como artefactos.
        // Las excepciones y aserciones se conservan en los eventos estructurados.
    }
};
