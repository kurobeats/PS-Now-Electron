'use strict';

var GKP = function () {
    this._onError = undefined;
    this._onEvent = undefined;
    this._ready   = false;
    this.focus    = false;
    this.isConnected = false;

    this.localPath = typeof(__dirname) !== 'undefined' ? __dirname : undefined;
    this._eventListeners = {};
    this._eventOnceListeners = {};

    this.identity = 'NOTIFIER';
    console.log('Loading as NOTIFIER');

    this._eventQueue = [];
    this._keyStates = {};

    this._loadWebSocketClient(); // calls _setup
}

GKP.prototype._setup = function() {
    this.ipc = new this.WebSocketClient();

    this.ipc.onerror = function (err) {
        console.error(err);
    }

    this.ipc.onmessage = function (message) {

        var data = undefined;
        try {
            data = JSON.parse(message);
        } catch (e) {
            console.error(e);
        }


        if (typeof(data) !== 'undefined') {
            this._ipcHandler(data)
        }
    }.bind(this);

    this.ipc.onconnect = function () {
        console.log('Connected to IPC');
        gaikai.ipc.isConnected = true;
        gaikai.ipc.emit('connected');
        this.ipc.sendHeldMessages();
    }.bind(this);

    this.ipc.connect();
}

GKP.prototype._loadWebSocketClient = function() {
    if (typeof(require) !== 'undefined') {
        this.WebSocketClient = require(__dirname + '/websocket_client.js');
    } else {
        // Assumes already exists in namespace
        this.WebSocketClient = WebSocketClient;
    }
    this._setup();
}

GKP.prototype._resetGamepads = function () {
    for (var type in this._keyStates){
        //console.log('type', type);
        for (var id in this._keyStates[type]) {
            //console.log('id', id);
            for (var name in this._keyStates[type][id]) {
                //console.log('name', name);
                for (var code in this._keyStates[type][id][name]) {
                    //console.log('code', code);
                    if (this._keyStates[type][id][name][code] === 'keyDown') {
                        //console.log('result', this._keyStates[type][id][name][code]);

                        this.emit('event', {type: type, id: id, name: name, code: code, result: 'keyUp'});
                    }
                }
            }
        }
    }
}

GKP.prototype.ready = function(ready) {

    if (typeof(ready) === 'undefined') ready = true;
    this._ready = ready;
    console.log('Ready State:', this._ready);
    if (this._ready) {
        while(this._eventQueue.length) {
            this._ipcHandler(this._eventQueue.shift());
        }
    }
}

GKP.prototype.onFocus = function () {
    this.focus = true;
    this.emit('window-focus');
}

GKP.prototype.onBlur = function () {
    this.focus = false;
    this._clearGamepadEventsFromQueue();
    this._resetGamepads();
    this.emit('window-blur');
}

/**
 * populates:
 * o window.navigator.userLanguage: bcp47 name of current system localization
 * o window.gaikai.localeInfo.uiLanguages: array of bcp47 names of localization, by priority
 */
GKP.prototype.onLocaleInfo = function(uiLanguages) {
    console.log('onLocaleInfo: ' + uiLanguages);
    if (typeof(uiLanguages) !== 'undefined')
    {
        window.navigator.userLanguage = uiLanguages[0];
        if (typeof(window.gaikai.localeInfo) === 'undefined')
            window.gaikai.localeInfo = {};
        window.gaikai.localeInfo.uiLanguages = uiLanguages;
    }
}

GKP.prototype._ipcHandler = function(data) {
    var isError = data.type === 'error';
    var isEvent = ['event',
                   'gamepadEvent',
                   'psHomeButton',
                   'versionInfo',
                   'gamepadMgrEvent',
                   'localeInfo',
                   'privacySetting',
                   'isStreaming',
                   'isQueued',
                   'isShuttingDown'
                   ].indexOf(data.type) != -1;
    var isWindowEvent = !isEvent && (data.type === 'windowEvent');
    var isMessage = data.command === 'sendMessage';

    //console.log('error:', isError, 'event:', isEvent, 'window:', isWindowEvent, 'message:', isMessage);

    if (!this._ready && !isWindowEvent) {
        if (typeof(data) !== 'undefined') {
            if (!this._handleGamepadData(data)) {
                if (data.type === 'localeInfo')
                {
                    this.onLocaleInfo(data.uiLanguages);
                }
                else
                {
                    this._eventQueue.push(data);
                }
            }
        }
    } else if (isError) { 
        if (typeof(this._onError) === 'function') {
            this._onError(data);
        }
        this.emit('error', data);
    } else if (isWindowEvent) {
        if (data.name === 'focus') {
            this.onFocus();
        } else if (data.name === 'blur') {
            this.onBlur();
        } else {
          this.emit('window-' + data.name, data);
        }
    } else if (isEvent) {
        if (!this._handleGamepadData(data)) {
            if (data.type === 'localeInfo')
            {
                this.onLocaleInfo(data.uiLanguages);
            }
            else if (typeof(this._onEvent) === 'function') {
                this._onEvent(data);
            }
            this.emit('event', data);
        } 
    } else if (isMessage) {
        if (typeof(data.params) != 'object' || typeof(data.params.message) != 'string') {
            console.error('malformed sendMessage packet');
        } else if ((typeof(data.target) === 'undefined') || (data.target === '') || (data.target === this.identity)) {
            this.emit('message', data.params.message);
        }
    }  else {
        //console.error('Unhandled ipc message:', data);
    }
}

GKP.prototype._clearGamepadEventsFromQueue = function() {
    this._eventQueue = this._eventQueue.filter(function (i) { 
        var keep = !(i.type === 'gamepadEvent' || i.type === 'psHomeButton');
        if (!keep) {
            console.log('deleting from queue', i);
        }
        return keep;
    } );
}

// Returns 'true' if it was handled here
GKP.prototype._handleGamepadData = function(obj) {
    if (obj.type === 'gamepadEvent' || obj.type === 'psHomeButton') {
        //console.log('focus', this.focus, '_ready', this._ready);   
        if (!this.focus || !this._ready) {
            //console.log('dropped gamepad event, not', !this.focus ? 'focused' : '', !this._ready ? 'ready' : '');
            return true;  // Drop it on the floor ...
        }

        var type = (obj.type in this._keyStates)    ? this._keyStates[obj.type]  : this._keyStates[obj.type] = {};
        var id   = (obj.id   in type)               ? type[obj.id]               : type[obj.id]              = {};
        var name = (obj.name in id)                 ? id[obj.name]               : id[obj.name]              = {};
        name[obj.code] = obj.result;
    }
    return false;
}


GKP.prototype.addListener = GKP.prototype.on = function(eventName, listener) {
    this.emit('newListener', eventName, listener);
    if (!(eventName in this._eventListeners)) {
        this._eventListeners[eventName] = [];
    }
    this._eventListeners[eventName].push(listener);
}

GKP.prototype.once = function(eventName, listener) {
    if (!(eventName in this._eventOnceListeners)) {
        this._eventOnceListeners[eventName] = [];
    }
    this._eventOnceListeners[eventName].push(listener);
}

GKP.prototype.removeListener = function(eventName, listener) { 
    if (eventName in this._eventListeners) {
        this._eventListeners[eventName] = this._eventListeners[eventName].filter(function (i) { return i !== listener } );
    }
    if (eventName in this._eventOnceListeners) {
        this._eventOnceListeners[eventName] = this._eventOnceListeners[eventName].filter(function (i) { return i !== listener } );
    }
    this.emit('removeListener', eventName, listener);
}

GKP.prototype.removeAllListeners = function(eventName) {
    delete this._eventListeners[eventName];
    delete this._eventOnceListeners[eventName];
}

GKP.prototype.emit = function() {
    var eventName = arguments[0];
    var args = Array.prototype.slice.call(arguments, 1);
    if (eventName in this._eventListeners) {
        for(var i = 0; i < this._eventListeners[eventName].length; i++){
            this._eventListeners[eventName][i].apply(null, args);
        }
    }

    if (eventName in this._eventOnceListeners) {
        for(var i = 0; i < this._eventOnceListeners[eventName].length; i++){
            this._eventOnceListeners[eventName][i].apply(args);
        }
        delete this._eventOnceListeners[eventName];
    }
}

GKP.prototype.listeners = function(eventName) {
    return this._eventListeners[eventName];
}


function LoadWebSocketClient() {
}

GKP.prototype.getDuid = function() {
    return require('electron').remote.getGlobal('duid');
}

// deprecated
GKP.prototype.getLocale = function() {
    return navigator.userLanguage;
}

GKP.prototype._genPromise = function() {
    return new Promise( function (fulfill, reject) { fulfill(); } );
}

GKP.prototype.send = function(obj, target) {
    obj.source = this.identity;
    if (typeof(target) !== 'undefined' && typeof(target) !== 'string') {
        throw 'TARGET parameter must be a string, or undefined';
    }
    if (typeof(target) !== 'undefined') {
        obj.target = target;
    }
    this.ipc.send(JSON.stringify(obj));
}

GKP.prototype.launchRemote = function () {
    this.send({command: 'launchRemote', params: {}}, this.identity);

}

GKP.prototype.setSettings = function(settings) {
    if (typeof(settings) !== 'object') {
        settings = JSON.parse(settings);
    }
    this.send({
        command: 'setSettings',
        params: { settings: settings } 
    }, 'QAS');
    return this._genPromise();
}

GKP.prototype.requestClientId = function () {
    this.send({ command: 'requestClientId', params: {} }, 'QAS');
    return this._genPromise();
}

GKP.prototype.requestGame = function(forceLogout) {
    this.send({ command: 'requestGame', params: { forceLogout: forceLogout === true } }, 'QAS');
    return this._genPromise();
}

GKP.prototype.startGame = function() {
    this.send({ command: 'startGame', params: {} }, 'QAS');
    return this._genPromise();
}

GKP.prototype.sendXmbCommand = function(command, playerid) {
    if (playerid === undefined) {
        playerid = 0;
    }
    this.send({ command: 'sendXmbCommand', params: { command: command, playerid: playerid } }, 'QAS');
    return this._genPromise();
}

GKP.prototype.stop = function() {
    this.send({ command: 'stop', params: {} }, 'QAS');
    return this._genPromise();
}

GKP.prototype.setAvailable = function(available) {
    this.send({ command: 'setAvailable', params: { available: available } }, 'QAS');
    return this._genPromise();
}

GKP.prototype.testConnection = function() {
    this.send({ command: 'testConnection', params: {} }, 'QAS');
    return this._genPromise();
}

GKP.prototype.getVersion = function() {
    this.send({ command: 'getVersion', params: {} }, 'QAS');
    return this._genPromise();
}

GKP.prototype.getPrivacySetting = function() {
    this.send({ command: 'getPrivacySetting', params: {} }, 'QAS');
    return this._genPromise();
}

GKP.prototype.routeInputToPlayer = function() {
    this.send({ command: 'routeInputToPlayer', params: {} }, 'QAS');
    return this._genPromise();
}

GKP.prototype.routeInputToClient = function() {
    this.send({ command: 'routeInputToClient', params: {} }, 'QAS');
    return this._genPromise();
}

GKP.prototype.gamepadSetRumbleEnabled = function(playerId, enabled) {
    this.send({ command: 'gamepadSetRumbleEnabled', params: { playerId: playerId, enabled: enabled } }, 'QAS');
    return this._genPromise();
}

GKP.prototype.gamepadSwap = function(playerId1, playerId2) {
    this.send({ command: 'gamepadSwap', params: { playerId1: playerId1, playerId2: playerId2 } }, 'QAS');
    return this._genPromise();
}

GKP.prototype.gamepadDisconnect = function(playerId) {
    this.send({ command: 'gamepadDisconnect', params: { playerId: playerId } }, 'QAS');
    return this._genPromise();
}

GKP.prototype.setCallbacks = function(onEvent, onError) {
    this._onEvent = onEvent;
    this._onError = onError;
    return this._genPromise();
}

GKP.prototype.getWindowPosition = function(target)
{
    this.send({ command: 'getWindowPosition', params:{}},  target || this.identity);
    return this._genPromise();
}

GKP.prototype.windowControl = function (command, target) {
    this.send({'command': 'windowControl', 'params': {command: command}}, target || this.identity);
    return this._genPromise();
}

GKP.prototype.setWindowPosition = function (xpos, ypos, target) {
  this.send({ command: 'setWindowPosition', params: { xpos: xpos, ypos: ypos }}, target || this.identity);
  return this._genPromise();
}

GKP.prototype.showDevTools = function (show) {
    this.send({
        command: 'showDevTools',
        params: { show: show } 
    }, this.identity);
}

GKP.prototype.setUrl = function(url, target) {
    this.send({ command: 'setUrl', params: { url: url}}, target || this.identity);
}

GKP.prototype.setUrlDefaultBrowser = function(url) {
    this.send({ command: 'setUrlDefaultBrowser', params: { url: url}}, 'AGL');
}

GKP.prototype.sendMessage = function(message, target) {
    if (typeof(message) !== 'string') {
        console.warn('sendMessage called with argument type of \'' + typeof(message) + '\', attempting to auto-stringify');
        message = typeof(message) === 'object' ? JSON.stringify(message) : message.toString();
    }

    this.send({ command: 'sendMessage', params: { message: message }}, typeof(target) !== 'undefined' ? target : this.identity);
}

GKP.prototype.updater = function (command) {
    this.send({ command: 'updater', params: { command: command }}, 'QAS');
}

GKP.prototype.notificationWindowSetVisible = function (visible) {
    this.send({ command: 'notificationWindow', params: { command: visible ? 'show' : 'hide' }}, 'QAS'); 
}

GKP.prototype.notificationWindowSetSize = function (width, height) {
    this.send({ command: 'notificationWindow', params: { command: 'setSize', width: parseInt(width), height: parseInt(height) }}, 'QAS');
}

GKP.prototype.notificationWindowSetUrl = function (url) {
    this.send({ command: 'notificationWindow', params: { command: 'setContent', content: url }}, 'QAS');
}

GKP.prototype.notificationWindowSetFadeDuration = function (fadeDuration) {
    // Same value because we dont support scrolling, and when we do its the same thing anyways!
    this.send({ command: 'notificationWindow', params: { command: 'setAnimDurations', fadeDuration: parseInt(fadeDuration), scrollDuration: parseInt(fadeDuration) }}, 'QAS');
}

GKP.prototype.qasTrayMenu = function (params) {
    this.send({ command: 'qasTrayMenu', params: params}, 'QAS');
}

GKP.prototype.qasTooltip = function (params) {
    this.send({ command: 'qasTooltip', params: params}, 'QAS');
}

GKP.prototype.trayNotification = function (title, message, iconType) {
   this.send({ command: 'trayNotification', params: { 'title': title, 'message': message, 'iconType': iconType }}, 'QAS');
}

GKP.prototype.qasTrayIcon = function (nameoficon) {
   this.send({ command: 'qasTrayIcon', params: nameoficon}, 'QAS');
}

GKP.prototype.showSplashScreen = function (show) {
    this.send({ command: 'qasSplashScreen', params: { show: show }}, 'QAS');
}

GKP.prototype.localRumbleEvent = function (playerID, largeMotor, smallMotor, durationMS) {
   this.send({ command: 'localRumbleEvent', params: { 'playerID': playerID, 'largeMotor': largeMotor, 'smallMotor': smallMotor, 'durationMS':  durationMS }}, 'QAS');
}

GKP.prototype.isStreaming = function () {
   this.send({ command: 'isStreaming', params: {} }, 'QAS');
   return this._genPromise();
}

GKP.prototype.isQueued = function () {
   this.send({ command: 'isQueued', params: {} }, 'QAS');
   return this._genPromise();
}

GKP.prototype.sendConnectedControllerEvent = function () {
   this.send({ command: 'sendConnectedControllerEvent', params: {} }, 'QAS');
   return this._genPromise();
}

GKP.prototype.isShuttingDown = function () {
   this.send({ command: 'isShuttingDown', params: {} }, 'QAS');
   return this._genPromise();
}

GKP.prototype.applicationCommand = function(command) {
   this.send({ command: 'applicationCommand', params: {'command': command}});
}

GKP.prototype.setTopmostWindow = function(topmostWindowName) {
   this.send({ command: 'setTopmostWindow', params: {'topmost': topmostWindowName}});
}

GKP.prototype.initializeLib = function () {
    // NOOP
}

GKP.prototype.shutdownLib = function () {
    // NOOP
}

GKP.prototype.setAnalogStickRateLimit = function(limit) //0-INT16_MAX in milliseconds
{
    this.send({ command: 'setAnalogStickRateLimit', params: {'limit': limit}});
}

window.gaikaiPlayer = new GKP();
window.gaikai = {
    ipc:       window.gaikaiPlayer,
    localPath: window.gaikaiPlayer.localPath
};

window.addEventListener('focus', window.gaikaiPlayer.onFocus.bind(window.gaikaiPlayer));
window.addEventListener('blur',  window.gaikaiPlayer.onBlur.bind(window.gaikaiPlayer));

window.addEventListener('dragover', function(event) {
   event.preventDefault();
   return false;
 }, false); 

window.addEventListener('drop', function(event) {
   event.preventDefault();
   return false;
 }, false);

// synonyms
window.gaikai.localPath = window.gaikaiPlayer.localPath;
