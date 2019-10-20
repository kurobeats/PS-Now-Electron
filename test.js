

console.log('running electron version', process.versions.electron);
console.log('before require');
var gkp = require('gkp-ipc');
console.log('after require');
console.log('before ipc');
global.gkpIpc = new gkp.GaikaiIpc(); // global is required to prevent garbage collection
console.log('after ipc');
var gkpIpcOk = global.gkpIpc.CreateIpc(true);
