'use strict';

var inNode      = typeof(module) !== 'undefined' && module.parent;
var inAMD       = typeof(define) !== 'undefined';



// If you modify this, make sure ALL this is the last & highest
var GkLogLevel  =
{
    NONE    :   0,
    ERROR   :   1,
    WARN    :   2,
    DEBUG   :   3,
    INFO    :   4,
    ALL     :   99
}

var GkLogger = function ()
{
    this.logLevel = 0;
}

GkLogger.prototype.setLogLevel = function(level)
{
    this.logLevel = level;
}

GkLogger.prototype.ERROR = function(message)
{
    if(this.logLevel >= GkLogLevel.ERROR)
    {
        console.log("ERROR:", message);
    }
}

GkLogger.prototype.WARN = function(message)
{
    if(this.logLevel >= GkLogLevel.WARN)
    {
        console.log("WARN:", message);
    }
}

GkLogger.prototype.DEBUG = function(message)
{
    if(this.logLevel >= GkLogLevel.DEBUG)
    {
        console.log("DEBUG:", message);
    }
}

GkLogger.prototype.INFO = function(message)
{
    if(this.logLevel >= GkLogLevel.INFO)
    {
        console.log("INFO:", message);
    }
}

if (inNode)
{
    module.exports = GkLogger;
}
else if (inAMD)
{
    define(function () { return GkLogger });
}



