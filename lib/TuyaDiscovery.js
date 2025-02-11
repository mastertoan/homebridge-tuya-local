const dgram = require('dgram');
const crypto = require('crypto');
const EventEmitter = require('events');

const UDP_KEY = Buffer.from('6c1ec8e2bb9bb59ab50b0daf649b410a', 'hex');

class TuyaDiscovery extends EventEmitter {
    constructor() {
        super();

        this.discovered = new Map();
        this.limitedIds = [];
        this._servers = {};
        this._running = false;
    }

    start(props) {
        this.log = props.log;

        const opts = props || {};

        if (opts.clear) {
            this.removeAllListeners();
            this.discovered.clear();
        }

        this.limitedIds.splice(0);
        if (Array.isArray(opts.ids)) [].push.apply(this.limitedIds, opts.ids);

        this._running = true;
        this._start(6666);
        this._start(6667);

        return this;
    }

    stop() {
        this._running = false;
        this._stop(6666);
        this._stop(6667);

        return this;
    }

    end() {
        this.stop();
        process.nextTick(() => {
            this.removeAllListeners();
            this.discovered.clear();
            this.log.info('Discovery ended.');
            this.emit('end');
        });

        return this;
    }

    _start(port) {
        this._stop(port);

        const server = this._servers[port] = dgram.createSocket({type: 'udp4', reuseAddr: true});
        server.on('error', this._onDgramError.bind(this, port));
        server.on('close', this._onDgramClose.bind(this, port));
        server.on('message', this._onDgramMessage.bind(this, port));

        server.bind(port, () => {
            this.log.info(`Discovery - Discovery started on port ${port}.`);
        });
    }

    _stop(port) {
        if (this._servers[port]) {
            this._servers[port].removeAllListeners();
            this._servers[port].close();
            this._servers[port] = null;
        }
    }

    _onDgramError(port, err) {
        this._stop(port);

        if (err && err.code === 'EADDRINUSE') {
            this.log.warn(`Discovery - Port ${port} is in use. Will retry in 15 seconds.`);

            setTimeout(() => {
                this._start(port);
            }, 15000);
        } else {
            this.log.error(`Discovery - Port ${port} failed:\n${err.stack}`);
        }
    }

    _onDgramClose(port) {
        this._stop(port);

        this.log.info(`Discovery - Port ${port} closed.${this._running ? ' Restarting...' : ''}`);
        if (this._running)
            setTimeout(() => {
                this._start(port);
            }, 1000);
    }

    _onDgramMessage(port, msg, info) {
        const len = msg.length;
        if (len < 16 ||
            msg.readUInt32BE(0) !== 0x000055aa ||
            msg.readUInt32BE(len - 4) !== 0x0000aa55
        ) {
            this.log.error(`Discovery - Invalid message format from ${info.address}:${port}`, {
                length: len,
                header: msg.readUInt32BE(0).toString(16),
                trailer: msg.readUInt32BE(len - 4).toString(16),
                raw: msg.toString('hex')
            });
            return;
        }

        const size = msg.readUInt32BE(12);
        if (len - size < 8) {
            this.log.error(`Discovery - Invalid message size from ${info.address}:${port}`, {
                messageLength: len,
                declaredSize: size,
                difference: len - size
            });
            return;
        }

        const cleanMsg = msg.slice(len - size + 4, len - 8);
        this.log.debug(`Discovery - Clean message: ${cleanMsg.toString('hex')}`);

        let decryptedMsg;
        if (port === 6667) {
            try {
                const decipher = crypto.createDecipheriv('aes-128-ecb', UDP_KEY, '');
                decryptedMsg = decipher.update(cleanMsg, 'utf8', 'utf8');
                decryptedMsg += decipher.final('utf8');
                this.log.debug(`Discovery - Decrypted message: ${decryptedMsg}`);
            } catch (ex) {
                this.log.error(`Discovery - Decryption failed for ${info.address}:${port}`, {
                    error: ex.message,
                    stack: ex.stack,
                    cleanMessage: cleanMsg.toString('hex')
                });
            }
        }

        if (!decryptedMsg) decryptedMsg = cleanMsg.toString('utf8');

        try {
            const result = JSON.parse(decryptedMsg);
            this.log.debug(`Discovery - Parsed result:`, result);
            
            if (result && result.gwId && result.ip) {
                this._onDiscover(result);
            } else {
                this.log.error(`Discovery - Invalid result structure from ${info.address}:${port}`, {
                    result: result,
                    decryptedMessage: decryptedMsg,
                    cleanMessage: cleanMsg.toString('hex')
                });
            }
        } catch (ex) {
            this.log.error(`Discovery - Parse error for ${info.address}:${port}`, {
                error: ex.message,
                stack: ex.stack,
                decryptedMessage: decryptedMsg,
                rawMessage: msg.toString('hex'),
                messageDetails: {
                    length: len,
                    size: size,
                    header: msg.readUInt32BE(0).toString(16),
                    command: msg.readUInt32BE(8).toString(16),
                    trailer: msg.readUInt32BE(len - 4).toString(16)
                }
            });
        }
    }

    _onDiscover(data) {
        if (this.discovered.has(data.gwId)) return;

        data.id = data.gwId;
        delete data.gwId;

        this.discovered.set(data.id, data.ip);

        this.emit('discover', data);

        if (this.limitedIds.length &&
            this.limitedIds.includes(data.id) && // Just to avoid checking the rest unnecessarily
            this.limitedIds.length <= this.discovered.size &&
            this.limitedIds.every(id => this.discovered.has(id))
        ) {
            process.nextTick(() => {
                this.end();
            });
        }
    }
}

module.exports = new TuyaDiscovery();
