'use strict';

/* Typical usage:
 *
 *  var client = new WebSocketClient();
 *  client.onmessage = function (message) { ... }; // set this before connect, usually 
 *  client.connect();
 *
 *  ...
 *
 *  client.send(message); // Objects will be sent with JSON.stringify
 *
 * Constructor:
 *
 *  WebSocketClient();
 *
 * Connecting:
 *
 *  WebSocketClient.connect(host, port, keepConnected);
 *  WebSocketClient.connect(options);
 *
 * where:
 *
 * options = { host: <string>, port = <integer>, keepConnected = <boolean> }
 *
 * defaults: 
 *  host:          localhost
 *  port:          1235
 *  keepConnected: true
 *
 * Methods:
 *  send(message);
 *  close();          // cancels keepConnected
 *  connect(options); // see above
 *  reconnect();      // re-uses options from connect()
 *
 * Event handlers:
 *  
 *  onerror
 *  onopen / onconnect // 'onopen' has priority
 *  onclose            // Not called for 'keepConnected' unless close() explicitly called 
 *
 */

var inNode      = typeof(module) !== 'undefined' && module.parent;
var inAMD       = typeof(define) !== 'undefined';

var WebSocketClient = function () {

    if (!(this instanceof WebSocketClient)) {
        throw "WebSocketClient called without `new`.";
    }

    this._eventQueue = [];

    this.onerror = undefined;
    this.onconnect = undefined;
    this.onopen = undefined;
    this.onmessage = undefined;
    this.intentionallyClosed = false;
    this.WebSocket = inNode ? require('websocket').w3cwebsocket : WebSocket;
}


WebSocketClient.prototype.connect = function() {
    var host, port, keepConnected, args;
    if (typeof(arguments[0]) === 'object') {
        args             = arguments[0];
        host             = args.host;
        port             = args.port;
        keepConnected    = args.keepConnected;
    } else {
        args = arguments;
        host             = args[0];
        port             = args[1];
        keepConnected    = args[2];
    }

    if (typeof(host) === 'undefined') {
        host = 'localhost';
    }

    if (typeof(port) === 'undefined') {
        port = 1235;
    }

    if (typeof(keepConnected) === 'undefined') {
        keepConnected = true;
    }


    this.host           = host;
    this.port           = port;
    this.keepConnected  = keepConnected;


    this.intentionallyClosed = false;
    this.connectCalled = true;
    this.reconnect(); // First connect in this case
}


WebSocketClient.prototype.send = function(message) {
    if (this.client && this.client.readyState == 1 /* 'OPEN' */) {
        if (typeof(message) === 'object') {
            this.client.send(JSON.stringify(message));
        } else {
            this.client.send(message);
        }
    } else {
        if (typeof(message) === 'object') {
            console.error("Sending message BEFORE the websocket is available: " + JSON.stringify(message));
            this._eventQueue.push(JSON.stringify(message));
        } else {
            console.error("Sending message BEFORE the websocket is available: " + message);
            this._eventQueue.push(message);
        }
    }
}

WebSocketClient.prototype.reconnect = function() {

    if (!this.connectCalled) {
        return;
    }

    var url = 'ws://' + this.host + ':' + this.port + '/';
    if (!this.client || this.client.readyState == 3 /* 'CLOSED' */) {
        console.log('(Re)connecting to', url);

        //                              URL, protocols,  origin,    headers,   requestOptions
        if (typeof(process) !== 'undefined') { // inside Node
            this.client = new this.WebSocket(url, undefined, undefined, undefined, {rejectUnauthorized: false});
        } else {
            this.client = new this.WebSocket(url);
        }
        this.client.onerror     = this.onerror;
        this.client.onopen      = this.onopen || this.onconnect;
        this.client.onmessage   = function (message) { this.onmessage && this.onmessage(message.data) }.bind(this);
        this.client.onclose     = this.closeHandler.bind(this);
    }
}

WebSocketClient.prototype.sendHeldMessages = function () {
    while(this._eventQueue.length) {
        this.send(this._eventQueue.shift());
    }
}

WebSocketClient.prototype.closeHandler = function () {
    if (this.intentionallyClosed) {
        if (this.onclose) {
            this.onclose.apply(arguments);
        }
        return;
    } else if (this.keepConnected) {
        setTimeout(this.reconnect.bind(this), 1000);
    }
}


WebSocketClient.prototype.close = function() {
    this.intentionallyClosed = true;
    this.client && this.client.close();
}

if (inNode) {
    module.exports = WebSocketClient;
} else if (inAMD) {
    define(function () { return WebSocketClient });
}
