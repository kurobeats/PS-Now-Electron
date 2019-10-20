
var tn = '#output_terminal';
$(document).ready( function() {
    $(tn).terminal(
        function(command, term) {
            if (command !== '') {
                try {
                    var result = window.eval(command);
                    if (result !== undefined) {
                        term.echo(new String(result));
                    }
                } catch(e) {
                    term.error(new String(e));
                }
            } else {
                term.echo('');
            }
        }, {
            greetings: '',
            name: 'js_demo',
            //height: 200,
            prompt: '> ',
            outputLimit: 10000,
            onInit: function(term) {
                $(document).data('terminal', term);
                doResize();
            }
        }
    );

    $(window).resize(doResize);

    $('.spinner').each( function(index, item) {
        var spinner = $(item);
        console.log('got spinner', item);
        spinner.spinner();
    });


});

function stopSplashScreen()
{
    window.gaikaiPlayer.showSplashScreen(false);
}

function logit() {
    $(document).data('terminal').echo.call(undefined, Array.prototype.slice.call(arguments).join());
}



function doResize(){
    var win = $(window);
    var term = $(document).data('terminal');
    var termDiv = $(tn);
    var controlDiv = $('#control');
    var body = $('body');

    var h = win.innerHeight();
    var w = win.innerWidth();
    var vMargin = parseInt(body.css('margin-top')) + parseInt(body.css('margin-bottom'));
    var hMargin = parseInt(body.css('margin-left')) + parseInt(body.css('margin-right'));
    termDiv.outerHeight(h - vMargin - 33);
    termDiv.outerWidth(w / 2 - hMargin - 3);
    controlDiv.outerHeight(h - vMargin - 33);
    controlDiv.outerWidth(w / 2 - hMargin - 3);


    term.resize();
}

function setSettings() { 
    console.log("inside setsettings");
    var settings = document.getElementById("settings").value;
    try 
    {
        window.gaikai.ipc.setSettings(JSON.parse(settings));
    }
    catch(err)
    {
        console.error(err);
    }
}

function testConnection()
{
    window.gaikai.ipc.testConnection();
}

function stop()
{
    window.gaikai.ipc.stop();
}

function requestGame()
{
    var forceLogout = document.getElementById("forceLogout").checked;
    window.gaikai.ipc.requestGame(forceLogout);
}

function startGame()
{
    window.gaikai.ipc.startGame();
}

function requestClientId()
{
    window.gaikai.ipc.requestClientId();
}

function windowControl(cmd) {
    var qasCB = document.getElementById('qas');
    var qas = qasCB && qasCB.checked;
    gaikai.ipc.windowControl(cmd, qas ? 'QAS' : 'AGL')
}

function getWindowPos()
{
  //QAS not implemented 
  var qasCB = document.getElementById('qas');
  var qas = qasCB && qasCB.checked;
  gaikai.ipc.getWindowPosition(qas ? 'QAS' : 'AGL')
}

function setWindowPosition(xpos, ypos)
{
    var qasCB = document.getElementById('qas');
    var qas = qasCB && qasCB.checked;
    gaikai.ipc.setWindowPosition(xpos, ypos, qas ? 'QAS' : 'AGL');
}

function setUrl(url) {
    var qasCB = document.getElementById('qas');
    var qas = qasCB && qasCB.checked;
    gaikai.ipc.setUrl(url, qas ? 'QAS' : 'AGL')
}

function setUrlDefaultBrowser(url) {
    gaikai.ipc.setUrlDefaultBrowser(url);
}

function sendMessage(message) {
    var qasCB = document.getElementById('qas');
    var qas = qasCB && qasCB.checked;
    gaikai.ipc.sendMessage(message, qas ? 'QAS' : 'AGL')
}
function sendRaw(message) {
    gaikai.ipc.send(message);
}

var ipc = window.gaikai.ipc;

ipc.on('window-focus', function() { logit('focus');} );
ipc.on('window-blur', function() { logit('blur');} );
ipc.on('window-maximize', function() { logit('maximize');} );
ipc.on('window-minimize', function() { logit('minimize');} );
ipc.on('window-restore', function() { logit('restore');} );
ipc.on('window-full-screen', function() { logit('fullscreen');} );
ipc.on('event', function (data) { logit('event ' + JSON.stringify(data));} );
ipc.on('error', function (data) { logit('error ' + JSON.stringify(data));} );
ipc.on('message', function(data) { logit('message ' + JSON.stringify(data));} );

ipc.on('event', function(pos) { windowPosListener(pos);} );

function windowPosListener(pos)
{
    if(pos.name === "getWindowPositionResponse")
    {
      console.log("got the event back, position: " + pos.result);
    }
}




