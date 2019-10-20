"use strict";

//require('log-prefix')('[main] %s');

var isWindows = /^win/.test(process.platform);
var isLinux = /^linux/.test(process.platform);

const electron = require('electron');
const {app, BrowserWindow, dialog} = require('electron');
const os = require('os');
var psList = require('ps-list');
var jsonLint = require('jsonlint');
var minimist = require('minimist');
var fs = require('fs');
var util = require('util');
const { shell } = require('electron');
var allowSetForegroundWindow = require('windows-foreground-love').allowSetForegroundWindow;


var mainWindow              = undefined;
var WebSocketClient         = require(__dirname + '/html/websocket_client.js');
var webSocketClient         = undefined;
var hbReceived              = false;
var qasPid                  = undefined;
var logger                  = undefined; // Set up in processCLIArgs()
var configFileFound         = false;
var identity                = 'AGL';
var appIconPath             = __dirname + '/icons/psnow.png';
var appWindowName           = 'PlayStation' + String.fromCharCode(0x2122) /* trademark */ + ' Now';

var appReady                = false;
var httpRe                  = /^https?:\/\//i;
var remoteWindow            = undefined;
var warningWindow           = undefined;
var release_version         = '';
var frontendQueue           = [];
var configFileError         = undefined;
var allowAppExit            = false;

var GkLogger                = require(__dirname + '/html/gk_logger.js');

if (release_version !== '') 
{
    appWindowName += ' [' + release_version + ' release]';
}

//process.env['ELECTRON_ENABLE_LOGGING'] = 'true'; 
process.on('uncaughtException', function(e) 
{
    var stack = new Error().stack
    console.log(e, e.stack.split('\n'));
});


var WindowState  = 
{
    UNKNOWN: -1,
    MINIMIZED: 0,
    NORMAL: 1,
    MAXIMIZED: 2,
    FULL_SCREEN: 3
};

var keyStates = {};

var argv = minimist(process.argv, {
    string: [
        'config',
        'url',
        'devtools',
        'ignore-certificate-errors',
        'window-frame',
        'window-scaling',
        'content-scaling',
        'debug-level',
        'logfile',
        'start-server'
    ],
    boolean: true,
    alias: {
        config: 'c',
        devtools: 'd',
        'debug-level': 'D',
        url: 'u',
        'window-frame': 'f',
        'window-scaling': 's',
        logfile: 'l',
        'start-server': 'S'
    },
    default: {
        config: [''],
        devtools: undefined,
        url: undefined,
        'window-frame': undefined,
        'window-scaling': undefined,
        'debug-level': undefined,
        'content-scaling': undefined,
        'ignore-certificate-errors': undefined,
        'start-server': undefined,
        logfile: undefined
    }
});

var config = 
{
    showDevTools: false,
    windowFrame: false,
    windowScaling: 1.0,
    contentScaling: 1.0,
    startServer: false,
    ignoreCertificateErrors: false,
    debugLevel: 0,
    logFile: undefined
};


app.on('ready', startApp)
app.on('window-all-closed', appQuit)
app.on('quit', function (event) 
{
    logger.INFO('Exiting app.quit handler');
});


// --------------------------------------------- //

function createWebsocketClient()
{
    webSocketClient = new WebSocketClient();
    webSocketClient.onmessage = ipcHandler;
    webSocketClient.connect();
}

function createWindow()
{
    var width = 1280 * config.windowScaling;
    var height = 720 * config.windowScaling;

    mainWindow = new BrowserWindow(
        {
            show: true,
            width: width,
            height: height,
            minWidth: 720,
            minHeight: 405,
            useContentSize: true,
            transparent: false,
            frame: config.windowFrame,
            icon: appIconPath,
            title: appWindowName,
            webPreferences:
                {
                    preload: __dirname + '/html/preload.js',
                    nodeIntegration: true,
                    allowRunningInsecureContent: false
                }
        });

    mainWindow.on('close', function(e) 
    {
        if(allowAppExit)
        {
            if(warningWindow) warningWindow.close();
            if(remoteWindow) remoteWindow.close();
        }
        else
        {
            mainWindow.hide();
            e.preventDefault();
        }
    });

    mainWindow.on('resize', windowEventHandler.bind({}, 'resize'));
    mainWindow.webContents.on('did-finish-load', frontendLoadedHandler);
    mainWindow.on('closed', function () { mainWindow = null;});

    mainWindow.curWindowState = WindowState.NORMAL;
    mainWindow.curWindowSize = mainWindow.getSize();
    mainWindow.webContents.setUserAgent(mainWindow.webContents.getUserAgent() + ' gkApollo');

    mainWindow.loadURL(config.ApolloEndpoint);
}

function startApp()
{
    processCLIArgs(app);

    try 
    {
        logger.INFO('Locale:' + app.getLocale());
    } 
    catch (e) 
    {
        // noop
    }


    if (configFileError) 
    {
        var response = dialog.showMessageBox ({
            title:   appWindowName + ': Error parsing config file',
            message: configFileError.toString(),
            detail:  configFileError.filename,
            buttons: ['Continue', 'Exit']
        });

        if (response == 1)  
        {
            app.quit();
        }
    }

    createWebsocketClient();
    createWindow();

    appReady = true;

    if(config.showDevTools) 
    {
        mainWindow.openDevTools();
    }

    if(isWindows) 
    {
        app.setUserTasks([]);
    }

    hbReceived = true;
    setInterval(hbMonitor, 12000);

    if(config.ignoreCertificateErrors) 
    {
        warningWindow = new BrowserWindow (
            {
                width: 640, 
                height: 200, 
                transparent: false, 
                icon: appIconPath, 
                alwaysOnTop: true, 
                title: appWindowName, 
                useContentSize: true, 
                webPreferences:
                    {
                        preload: __dirname + '/html/browser_window_preload.js',
                        zoomFactor: 1
                    }
            });
        warningWindow.loadURL('file://' + __dirname + '/html/certificate_warning.html');
        warningWindow.on('close', function () { warningWindow = undefined; });
    }
}

function appQuit()
{
    app.quit();
}

function createPidfile(pidFile) 
{
    // delete any stale pidfile
    try 
    { 
        fs.unlinkSync(pidFile) 
    }
    catch (e)
    { 
        /* noop */ 
    }

    try
    {
        var fd = fs.openSync(pidFile, 'w');
        fs.writeSync(fd, process.pid.toString());
        fs.close(fd);
        return true;
    }
    catch (e)
    {
        logger.ERROR('Unable to create pidfile');
        logger.ERROR(e);
        return false;
    }
}

function getMachineGuid() 
{
    return new Promise(function(resolve, reject) {
        var resolved = false;

        if (isWindows) {
            const k = 'HKLM\\SOFTWARE\\Microsoft\\Cryptography';
            require('regedit').arch.list64(k, function(err, data) {
                if (!err && (k in data) && ('values' in data[k]) && ('MachineGuid' in data[k].values)) {
                    logger.INFO('Got MachineGuid');
                    resolve(data[k].values.MachineGuid.value);
                    resolved = true;
                } else {
                    require('macaddress').one(function(err, mac) { if (err) { reject(err); } else { resolve(mac); } });
                }
            });
        } else {
            logger.INFO('Using MAC as GUID');
            require('macaddress').one(function(err, mac) { if (err) { reject(err); } else { resolve(mac); } });
        }
    });
}

function isProcessRunning(pid) 
{
    return new Promise(function(resolve, reject) {
        psList(function (err, data) {
            if(err) {
                logger.ERROR(err);
                resolve(false);
            } else {
                for(var i = 0; i < data.length; i++) {
                    var item = data[i];
                    if (item.pid == pid) {
                        if (/(?:electron|agl)(?:.exe)?$/i.test(item.name)) {
                            resolve(true);
                        }
                    }
                }
            }
            resolve(false);
        });
    });
}

function isQasRunning() 
{
    return new Promise(function(resolve, reject) {
        psList(function (err, data) {
            if(err) {
                logger.ERROR(err);
                resolve(false);
            } else {
                for(var i = 0; i < data.length; i++) {
                    if (/^(?:qas|psnowlauncher)(?:.exe)?$/i.test(data[i].name)) {
                        qasPid = data[i].pid;
                        resolve(true);
                    }
                }
            }
            resolve(false);
        });
    });
}

function launchRemote() 
{
    if (typeof(remoteWindow) === 'undefined') {
        remoteWindow = new BrowserWindow ({
            'width': 640,
            'height': 200,
            'use-content-size': true,
            transparent: false,
            frame: true,
            title: 'AGL Remote',
            'node-integration': true,
            'web-preferences': {
                'allow-displaying-insecure-content': true,
                'allow-running-insecure-content': true,
                'web-security': false
            },
            preload: __dirname + '/html/preload.js'
        });
        remoteWindow.on('close', function() { remoteWindow = undefined; });
        remoteWindow.loadUrl('file://' + __dirname + '/html/remote.html');
    }
}

function alreadyRunning() 
{
    // This runs very early, before 'start app', so we need the logger created
    logger = new GkLogger();

    var pidFile = os.tmpdir() + '/gkp-pid';
    var fd = -1;
    var pid = -1;
    var pidFileExists = false;

    //    // probable race condition here ...

    try {
        var data = fs.readFileSync(pidFile, { encoding: 'utf8'} );
        pid = parseInt(data);
        pidFileExists = true;
    }
    catch(e) {
        logger.ERROR(e);
    }

    logger.INFO('Pidfile: ' + pidFile + ' My PID: ' + process.pid);
    return new Promise(function(resolve, reject) {
        isProcessRunning(pid).then(function(isRunning) {
            if (isRunning) {
                resolve(true);
            }
            else {
                if (!createPidfile(pidFile)) {
                    throw new Error('Unable to create pidfile: ' + pidFile);
                }
                resolve(false);
            }
        });
    });
}

function update(obj) 
{
    for (var i=1; i<arguments.length; i++) {
        for (var prop in arguments[i]) {
            var val = arguments[i][prop];
            if(!obj || obj.hasOwnProperty(arguments[i]))
            {
                console.log("null or nested obj, ignoring entry..");
                continue;
            }
            if (typeof val == "object") // this also applies to arrays or null!
                update(obj[prop], val);
            else
                obj[prop] = val;
        }
    }
    return obj;
}

function loadConfig(configFn) 
{
    if(!Array.isArray(configFn))
    {
        configFn = [ configFn ];
    }

    for(var i = 0; i < configFn.length; i++) {
        var fn = configFn[i];
        try {
            var data = fs.readFileSync(fn).toString();
            var json = jsonLint.parse(data);
            // use console, since logger isn't set up yet.
            console.log('successfully read config file "' + fn + '"');
            configFileFound = true;
            return json;
        }
        catch (e) 
        {
            if (e.code !== 'ENOENT')  
            {
                // bad JSON, pass the error up
                e.filename = fn;
                throw e;
            }

            // use console, since logger isn't set up yet.
            console.error('Error reading config file "' + fn + '": ' + e);
        }
    }
    return {};
}

function windowControl(cmd) 
{
    if (cmd === 'minimize') {
        mainWindow.minimize();
    } else if (cmd === 'maximize' && !mainWindow.isFullScreen()) {
        mainWindow.maximize();
    } else if (cmd === 'focus') {
        mainWindow.focus();
    } else if (cmd === 'focusSelf') {
        mainWindow.focus();
    } else if (cmd === 'normal' || cmd === 'restore') {
        if (mainWindow.isFullScreen()) {
            mainWindow.setFullScreen(false);
        } else if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        }
        if (mainWindow.isMinimized()) {
            mainWindow.restore();
        }
    } else if (cmd === 'close') {
        allowAppExit = true;
        mainWindow.close();
    } else if (cmd === 'fullscreen') {
        if (mainWindow.isMinimized()) {
            mainWindow.restore();
        }
        mainWindow.setFullScreen(true);
    } else if (cmd === 'hide') {
        mainWindow.hide();
        sendEvent('windowEvent', 0, 'hide', '', '', 'AGL'); //QAS needs to know so it can show the 'app still running' msg
    } else if (cmd === 'show') {
        mainWindow.show();
    } else if (cmd === 'query') {
        mainWindow.curWindowState = WindowState.UNKNOWN; // forces re-sending of event
        mainWindow.emit('resize');
    }
}

function frontendLoadedHandler() 
{
    logger.INFO("frontend load complete");
}

function ipcHandler(message) 
{
    var data = undefined;
    try {
        data = JSON.parse(message);
    } catch (e) {
        console.trace(e);
    }
    logger.INFO('Received' + message);

    if (typeof(data) !== 'undefined') {
        var command = data.command;
        var params  = data.params;
        var target  = data.target;
        if (typeof(command) !== 'undefined' && target == identity) {
            commandHandler(command, params);
        }
    }
}

function commandHandler(command, params)
{
    var action = "";

    if (command === 'launchRemote') {
        launchRemote();
        action = "Launched Remote";
    } else if (command == 'showDevTools') {
        mainWindow && (params.show ? mainWindow.openDevTools() : mainWindow.closeDevTools());
        action = params.show ? 'Devtools made visible' : 'Devtools made invisible';
    } else if (command == 'windowControl') {
        var target = params.target;
        action = 'Updated window state';
        windowControl(params.command);
    } else if (command === 'setWindowPosition') {
        var target = params.target;
        mainWindow.setPosition(Number(params.xpos), Number(params.ypos));
        action = 'set window position to: ' + params;
    } else if (command === 'getWindowPosition') {
        var winPos = mainWindow.getPosition();
        sendEvent("event", "", "getWindowPositionResponse", "", winPos, "AGL");
        action = 'got and sent window position to AGL: ' + winPos;
    } else if (command === 'setUrl') {
        if ( typeof(params) === 'object' && typeof(params.url) === 'string') {
            loadUrl(params.url);
            action = 'loaded URL: ' + params.url;
        } else {
            logger.ERROR('Malformed setUrl command');
        }
    } else if (command === 'setUrlDefaultBrowser'){
        if ( typeof(params) === 'object' && typeof(params.url) === 'string') {
            loadUrlDefaultBrowser(params.url);
            action = 'loaded URL in default browser: ' + params.url;
        }
    } else if (command === 'sendMessage') {
        if(params.message === 'qasHeartbeat')
        {
            hbReceived = true;
            action = 'hb set to true';
        }
    } else if (command === 'allowSetFGW') {
        fireASFGW();
    } else {
        action = 'Ignored';
    }

    logger.INFO("Action:" + action);
}

function fireASFGW()
{
    // w/ no param this defaults to ASFW_ANY
    // see: https://msdn.microsoft.com/en-us/library/windows/desktop/ms632668(v=vs.85).aspx
    logger.INFO(allowSetForegroundWindow());
}

function hbMonitor()
{
    if(hbReceived)
    {
        hbReceived = false;
    }
    else
    {
        logger.ERROR("Heartbeat not received, killing now");
        allowAppExit = true;
        terminateAppEarly();
    }
}


function loadUrl(url)
{
    logger.INFO('inside loadUrl');
    if(typeof(mainWindow) !== 'undefined') 
    {
        if (!httpRe.test(url)) 
        {
            var oldUrl = url;
            url = 'file://' + __dirname + '/html/' + url;
            logger.ERROR('URL w/o protocol sent (' + oldUrl + ') mapping to', url);
        }
        mainWindow.loadURL(url);
    }
}

function loadUrlDefaultBrowser(url)
{
    logger.INFO('Using node-open to launch default browser, url: ' + url);
    shell.openExternal(url);
}

function processCLIArgs(app)
{
    var logLevelChanged = false;
    var configFileInfo = {};
    try 
    {
        var configFileInfo = loadConfig(argv.config);
    } 
    catch (e) 
    {
        configFileError = e;
    }

    update(config, configFileInfo);
    logger.setLogLevel(0);

    logger.DEBUG(' >>> AGL Startup <<< ');

    // Other options

    if (typeof(argv.url) !== 'undefined') 
    {
        logger.DEBUG('command line URL override: ' + argv.url);
        config.ApolloEndpoint = argv.url;
    }

    logger.INFO('Current config:');
}

function sendEvent(type, id, name, code, result, target)
{
    var data = { type: type, id: id, name: name, code: code, result: result };
    if (typeof(target) !== 'undefined') 
    {
        data.target = target;
    }

    webSocketClient && webSocketClient.send(JSON.stringify(data));
}

function windowEventHandler()
{
    if(typeof(mainWindow) !== 'undefined') {
        var event = arguments[0];
        var isMaximized = mainWindow.isMaximized();
        var isMinimized = mainWindow.isMinimized();
        var isFullScreen = mainWindow.isFullScreen();
        var sendState = function(state) {
            logger.INFO('##### >> Window State: ' + state);
            sendEvent('windowEvent', 0, state, '', '', 'AGL');
        };

        // Tell frontend all the keys are up
        //
        // Javascripts object iteration is _awful_
        //
        if (event === 'blur') {
            for (var type in keyStates){
                for (var id in keyStates[type]) {
                    for (var name in keyStates[type][id]) {
                        for (var code in keyStates[type][id][name]) {
                            if (keyStates[type][id][name][code] === 'keyDown') {
                                sendFrontend({type: type, id: id, name: name, code: code, result: 'keyUp'});
                            }
                        }
                    }
                }
            }
        }


        if (event === 'resize') {
            //logger.log('Resize: max: ' + (isMaximized ? 'Yes' : 'No') + ' | min: ' + (isMinimized ? 'Yes' : 'No') + ' | fs: ' + (isFullScreen ? 'Yes' : 'No') + ' ' + mainWindow.curWindowState);

            // Because of the Aero Snap Windows bug:https://github.com/atom/electron/issues/1381
            //
            // Yes, this logic is correct, no, you can't improve it.

            // Yes, double-if works, and using && won't b/c of side-effects
            if (isMinimized) {
                if (mainWindow.curWindowState !== WindowState.MINIMIZED) {
                    mainWindow.curWindowState = WindowState.MINIMIZED;
                    sendState('minimize');
                }
            } else if (isFullScreen) {
                if (mainWindow.curWindowState !== WindowState.FULL_SCREEN) {
                    mainWindow.curWindowState = WindowState.FULL_SCREEN;
                    sendState('full-screen');
                }
            } else if (isMaximized){
                if (mainWindow.curWindowState !== WindowState.MAXIMIZED) {
                    mainWindow.curWindowState = WindowState.MAXIMIZED;
                    sendState('maximize');
                }
            } else if (mainWindow.curWindowState !== WindowState.NORMAL) {
                mainWindow.curWindowState = WindowState.NORMAL;
                sendState('restore');
                mainWindow.setSize.apply(mainWindow,mainWindow.curWindowSize);
            } else if (!isMaximized && !isMinimized && !isFullScreen) {
                mainWindow.curWindowSize = mainWindow.getSize();
            }

        } else  {
            sendState(event);
        }
    }
}

function startAppNormally () 
{
    waitForApp(false);
}

function terminateAppEarly() 
{
    waitForApp(true);
}

function waitForApp(terminate) 
{
    var duidReady = typeof(global.duid) !== 'undefined';
    logger.INFO('waitForApp: App: ' + (appReady ? 'Ready' : 'Not ready') + ' | DUID: ' + (duidReady ? global.duid : '<undefined'));
    if (appReady && duidReady) {

        if (terminate) {
            app.quit();
        } else {
            main();
        }
    } else {
        setTimeout(function () { waitForApp (terminate) } , 100);
    }
}

getMachineGuid().then( function(id) {
    global.duid = id;
}, function(err) {
    throw err;
});

alreadyRunning().then(function(isRunning) 
{
    if (isRunning) {
        logger.DEBUG('Already running, will terminate');
        terminateAppEarly();
    } else {
        if (isWindows) {
            isQasRunning().then(function(isRunning) {
                if (isRunning) {
                    startAppNormally();
                } else {
                    logger.DEBUG("QAS NOT RUNNING, TRY TO LAUNCH QAS" );

                    var spawn = require("child_process").spawn;
                    var psnowexe = process.cwd() + "\\..\\psnowlauncher.exe";

                    var child = spawn(psnowexe, [], {detached:true, stdio:'ignore'});
                    child.unref();

                    child.on('error', function(err) {
                        logger.ERROR("error, psnow exe not found at: " + psnowexe);
                        logger.ERROR(err);
                    });

                    logger.INFO('terminating');
                    terminateAppEarly();
                }
            }, function(err) {
                logger.ERROR('isQasRunning .catch called');
                logger.ERROR(err);
                terminateAppEarly();
            });
        } else {
            logger.INFO('Not on Windows, skipping QAS check');
            startAppNormally();
        }
    }
}, function(err) {
    logger.ERROR('alreadyRunning failed');
    logger.ERROR(err);
    terminateAppEarly();
});
