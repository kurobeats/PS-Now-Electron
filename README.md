# PS-Now-Electron
An attempt to create an OSS PS Now Electron App

## How you do this
I downloaded the official PS Now for PC client (https://www.playstation.com/en-us/explore/playstation-now/ps-now-on-pc/), installed it and unpacked the app.asar:

Install asar node module globally
`$ npm install -g asar`
Go into the app’s directory
`$ cd {INSTALL LOCATION}\agl\resources`
Create a directory to unpack the content of the app
`$ mkdir source`
Unpack the app.asar file in the above directory using asar
`$ asar extract app.asar source`

### Note:
I dunno how aggressive Playstation is with this kind of shit, its possible they'll kill this repo. If devs can learn that Windows isn't the only operating system in the world we wouldn't need to do things like this.
