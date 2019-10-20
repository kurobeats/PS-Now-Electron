#!/usr/bin/env node

const WebSocketServer   = require('websocket').server;
const http              = require('http');
const https             = require('https');
const util              = require('util');

var logger              = require('caterpillar').createLogger();
var human               = require('caterpillar-human').createHuman({color: !/^win/.test(process.platform) });
var stream              = require('stream');

logger.error            = logger.log.bind(logger, 'error');
logger.warn             = logger.log.bind(logger, 'warn');
logger.dir              = function (i) {
    this.log(util.inspect(i, false, null));
}.bind(logger);

var key = "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAv8ntgGvYFJ3PW1t86E8XHgteyt/cFhyaUHiDIxWSfgLRkyuL\nEFnI2mEB5h06WVuzcnahMi6USFs85P0Sl+h6AIeK3EH5rro+lRM2VawcrJ/mFnnl\n088I51+gQJ1c9lPWwHbTKTuvzPnMtlbMMBuE9tEY6hFIszZD6jUTP8mJ8pmvV82n\n1GtaPpuO6CpL7AW+s6om25UbBJXOSRW2/tBQZ/M9H8A0vkp1/OWOzpAs0BZHO/Gj\nSlNojj5ayzyZpPAYkKYzR/OWD/KP9pbb/bZHHC20EUtcz81m3ktNMoTMTXjUWV7S\nXLo2+ALKU4bVwVc4ZQLZd/suP9EDIfW0i2xh4QIDAQABAoIBAFVtlKUHZJCKWrrO\n3ax8zkdLuUWUwWv4AaSmiYMvMLmAd+meE6uM0rKzUy01B7CV8DCkNtkrdlFkkpNN\nRuLzYqSpu2iw2o7B1u6ASEuRBpS+BLcuRPk71zN4nOErNyVh4t6IDzbmp0AeZNkz\ngHBNUcS/DuH0IPXyzf2c9p4LH683kDtHa0n6nPjh1LXRiw9GWPpTaQo/EQ47BWyM\nT7HLgHbtLyOON0gnoDsSnLGYCqZ+oYSlsomnf+I5+qilZfyArHEgo4JFnUAGbh7t\nkjkS1rTMF8Q4mWoKt0crQuplCsDfSKSdfph7NcDISKQkvJ+GQ6fBueNlakN+0p9r\nE6avAYECgYEA4ez1IXhGYbE4lwVS8yemix7sKT+5jWHGlgObp9y4FuFZpAbDEesZ\ngxLsgWGSsczRKCK6J+0leKlJGiU7PEh9IVNxhrzYDDzDWhyK4ntLIEnhqd/lIC1y\nkLbc7gzaoy330D62NNhq4p/GrulOf86h2ax/83QgqEcaKe0TqrnktR0CgYEA2VGp\nrE1cH3VVYQ2m3HFvVc+0fXQ364dXtjSfxBUoaTXw46rL7oCydDAsnorD2FVXbqB8\nGhAhS6S/rjWdVXypm/M3cIjIVlnaIIwkGSlqha0FAHBBkN5fUKFXIbX59Ah5kPGQ\nPjE6phyehhVsmGs2Jh8+M34kWSI8uRcoKuqxWJUCgYAI73ZCfJ9L/dZfIrbFJyxP\nFEoC16JfFR7lj/74BKLDROZmtl3At6uqo3T3KQTEQ3WCQN1b9uUkgI2DmzVcjQFl\n8AbtbUqeMUkIp1hW3Ml73XAvZ8uIGkQNtS3HvHppOcgzVEegj26qx+bzxAZ2x5Vf\nJpNo7Y7dGPLP9bBxcCi7gQKBgBt2gHSvygaHs2RybzXIeANmHi8EctSm4+S4vb/v\n1I2HLYv315GqXeLk+56Fdr5t+oCWc1hv1WVTyo1fZSSafmygzc7A2mBfNnuKej1b\nyIRgGxO1G/QMxgrQeMxfzNiUAZjZjhrt6bV4RGg5aOHSGqOyqw+iz0EcXIQfcwoJ\nYqQJAoGBAK2vKNXsNalntHFBVcoNbncV91ktVn18o2iwMuLIxpbrQXETpV6FWHcY\nTjNJJNsCyqCsCYCAwaMTg23x3G6DSfd3GIhQL6TdpE6WEs5oLEbQ/ngsbX8cSnuP\nIpG9Tg64F/pGsW7qZFoAsmrim/PgXD36KD3JT/S3kBYmErCui0/b\n-----END RSA PRIVATE KEY-----\n"

var cert = "-----BEGIN CERTIFICATE-----\nMIIDRDCCAiwCCQCOEEfi4gh2eDANBgkqhkiG9w0BAQsFADBkMQswCQYDVQQGEwJV\nUzETMBEGA1UECAwKQ2FsaWZvcm5pYTEUMBIGA1UEBwwLQWxpc28gVmllam8xFTAT\nBgNVBAoMDEdhaWthaSwgSW5jLjETMBEGA1UEAwwKZ2Fpa2FpLmNvbTAeFw0xNTEw\nMjMxNzQ4MzNaFw00MzAzMDkxNzQ4MzNaMGQxCzAJBgNVBAYTAlVTMRMwEQYDVQQI\nDApDYWxpZm9ybmlhMRQwEgYDVQQHDAtBbGlzbyBWaWVqbzEVMBMGA1UECgwMR2Fp\na2FpLCBJbmMuMRMwEQYDVQQDDApnYWlrYWkuY29tMIIBIjANBgkqhkiG9w0BAQEF\nAAOCAQ8AMIIBCgKCAQEAv8ntgGvYFJ3PW1t86E8XHgteyt/cFhyaUHiDIxWSfgLR\nkyuLEFnI2mEB5h06WVuzcnahMi6USFs85P0Sl+h6AIeK3EH5rro+lRM2VawcrJ/m\nFnnl088I51+gQJ1c9lPWwHbTKTuvzPnMtlbMMBuE9tEY6hFIszZD6jUTP8mJ8pmv\nV82n1GtaPpuO6CpL7AW+s6om25UbBJXOSRW2/tBQZ/M9H8A0vkp1/OWOzpAs0BZH\nO/GjSlNojj5ayzyZpPAYkKYzR/OWD/KP9pbb/bZHHC20EUtcz81m3ktNMoTMTXjU\nWV7SXLo2+ALKU4bVwVc4ZQLZd/suP9EDIfW0i2xh4QIDAQABMA0GCSqGSIb3DQEB\nCwUAA4IBAQB/fGZjoZc6qeRFO3Tm8YajK/pEyujK3lNSKaUarQeeQPE3J3EWneRQ\nSDepWAcQZb6iEso2rYPW7A+PQTDfCJdsosCOpbiBmCzwJQyjJz+60Mpv25OQZ9Iy\nU6dxnOSoSToF0A2EPWlznwNJXKHzyjVfLdd56sOTPltZWEy8o+oKvIW9zP5WMchc\nIj3aARjIweEs9omVTZ13hiVTz2ptHtomgsbe3TV+ll2u2Fkp/x1GWuAyoZg9+xFJ\n/3qof8DGmuwGD9UYXbEE+ZoEolXl0l1uaIV3L3jCDL8fIk+CdU05vlX90eSrUA/0\nbKY7D5HZyLeDIc7cRxRYp2dSsmZd4O9E\n-----END CERTIFICATE-----\n";

function ElectronFix () { stream.Writable.call(this); }
util.inherits(ElectronFix, stream.Writable);
ElectronFix.prototype._write = function(chunk, encoding, done) {
    process.stdout.write(chunk.toString());
    done();
}

logger.pipe(human).pipe(new ElectronFix());

var GaikaiWebSocketServer = function(port, allowRemoteOrigin) {

    const useHttps = false;
    if (typeof (port) === 'undefined') port = 1235;
    if (typeof (allowRemoteOrigin) === 'undefined') allowRemoteOrigin = false;



    this.allowRemoteOrigin = allowRemoteOrigin;
    if (useHttps) {
        this.server = https.createServer( {
            key: key,
            cert: cert
        },function(request, response) {
            logger.log('Received request for ' + request.url);
            response.writeHead(404);
            response.end();
        });
    } else {
        this.server = http.createServer(function(request, response) {
            logger.log('Received request for ' + request.url);
            response.writeHead(404);
            response.end();
        });
    }


    this.server.listen(port, function() {
        logger.log('Server is listening on port', port);
    });



    this.port = port;
    this.connectionId = 0;
    this.connections = {};

    this.wsServer = new WebSocketServer({
        httpServer: this.server,
        autoAcceptConnections: false
    });
    this.wsServer.on('request', this.onRequest.bind(this));
}

GaikaiWebSocketServer.prototype.onRequest = function(request) {


    if (!this.originIsAllowed(request.remoteAddress)) {
        // Make sure we only accept requests from an allowed origin 
        request.reject();
        logger.log('Connection from origin ' + request.origin + ' rejected.');
        return;
    }


    var connection = request.accept('', request.origin);
    var server = this;

    connection.on('message', function(message) {
        if (message.type === 'utf8') {
            server.broadcast(message.utf8Data, this.__id);
        }
        else if (message.type === 'binary') {
            logger.log('Received Binary Message of ' + message.binaryData.length + ' bytes, dropped');
        }
    });

    connection.on('close', function(reasonCode, description) {
        server.deleteConnection(this);
    });

    this.addConnection(connection);
}

GaikaiWebSocketServer.prototype.broadcast = function(utf8Data, skipId) {
    for (id in this.connections) {
        if (id == skipId)
            continue;
        var connection = this.connections[id];
        connection.sendUTF(utf8Data);
    }
}

GaikaiWebSocketServer.prototype.dumpConnections = function () {
    for (id in this.connections) {
        logger.log('connection', id);
    }
}


GaikaiWebSocketServer.prototype.addConnection = function(connection) {
    connection.__id = this.connectionId;
    this.connections[connection.__id] = connection;
    logger.log('Connected [id:', connection.__id + ']', connection.remoteAddress)
    this.connectionId = this.connectionId + 1;
}

GaikaiWebSocketServer.prototype.deleteConnection = function(connection) {
    delete this.connections[connection.__id];
    logger.log('Disconnected [id:', connection.__id + ']', connection.remoteAddress);
}


GaikaiWebSocketServer.prototype.originIsAllowed = function(remoteAddress) {
    return this.allowRemoteOrigin || remoteAddress == '::ffff:127.0.0.1' || remoteAddress == '127.0.0.1';
}

module.exports = GaikaiWebSocketServer;
