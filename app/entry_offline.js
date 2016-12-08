'use strict';

const electron = require('electron');
const {app, BrowserWindow, Menu, globalShortcut, ipcMain, webContents} = electron;
const path = require('path');
const fs = require('fs');
const packageJson     = require('./package.json');
const ChildProcess = require('child_process');    

global.sharedObject = {
    roomId: ''
}

var language;

function logger(text) {
    var log_path = path.join(__dirname);
    if(!fs.existsSync(log_path)) {
        fs.mkdirSync(log_path);
    }
    if(!fs.existsSync(path.join(log_path, 'debug.log'))) {
        fs.writeFileSync(path.join(log_path, 'debug.log'), '', 'utf8');
    }
    var data = fs.readFileSync(path.join(log_path, 'debug.log'), 'utf8');
    data += '\n\r' + new Date() + ' : ' + text;
    fs.writeFileSync(path.join(log_path, 'debug.log'), data, 'utf8');
}

var argv = process.argv.slice(1);
var option = { file: null, help: null, version: null, webdriver: null, modules: [] };
for (var i = 0; i < argv.length; i++) {
    if (argv[i] == '--version' || argv[i] == '-v') {
        option.version = true;
        break;
    } else if (argv[i].match(/^--app=/)) {
        option.file = argv[i].split('=')[1];
        break;
    } else if (argv[i] == '--help' || argv[i] == '-h') {
        option.help = true;
        break;
    } else if (argv[i] == '--test-type=webdriver') {
        option.webdriver = true;
    } else if (argv[i] == '--debug' || argv[i] == '-d') {
        option.debug = true;
        continue;
    } else if (argv[i] == '--require' || argv[i] == '-r') {
        option.modules.push(argv[++i]);
        continue;
    } else if (argv[i][0] == '-') {
        continue;
    } else if (argv[i] == 'app') {
        continue;
    } else {
        option.file = argv[i];
        break;
    }
}

var mainWindow = null;
var hardwareWindow = null;
var hardwareWindowReLaunch = false;
var isClose = true;

app.on('window-all-closed', function() {
    app.quit();
    process.exit(0);
});

var shouldQuit = app.makeSingleInstance(function(commandLine, workingDirectory) {
    // 어플리케이션을 중복 실행했습니다. 주 어플리케이션 인스턴스를 활성화 합니다.
    if (mainWindow) {
        if (mainWindow.isMinimized()) 
            mainWindow.restore();
        mainWindow.focus();

        if(Array.isArray(commandLine) && commandLine[1]) {
            mainWindow.webContents.send('loadProject', commandLine[1]);
        }
    }

    return true;
});

if (shouldQuit) {
    app.quit();
    return;
}

app.on('open-file', function(event, pathToOpen) {
    if(process.platform === 'darwin') {
        option.file = pathToOpen;
        if(mainWindow) {
            mainWindow.webContents.send('loadProject', pathToOpen);
        }
    }
});

app.once('ready', function() {
    language = app.getLocale();
    // var title = 'v'+packageJson.version;
    var title = '';
    
    if(language === 'ko') {
        title = '엔트리' + title;
    } else {
        title = 'Entry' + title;
    }

    mainWindow = new BrowserWindow({
        width: 1024, 
        height: 700,
        title: title,
        webPreferences: {
            backgroundThrottling: false
        }
    });

    mainWindow.setMenu(null);

    mainWindow.loadURL('file:///' + path.join(__dirname, 'entry_offline.html'));

    if(option.debug) {
        mainWindow.webContents.openDevTools();
    }

    if(option.file) {
        mainWindow.webContents.startFile = option.file;
    }

    mainWindow.webContents.hpopup = hardwareWindow;
    mainWindow.webContents.name = 'entry';

    mainWindow.on('page-title-updated', function(e) {
        e.preventDefault();
    });
    mainWindow.on('close', function(e) {
        if(hardwareWindow) {
            hardwareWindow.close(true);
        }
        mainWindow.webContents.send('main-close');
    });
    mainWindow.on('closed', function() {
        mainWindow = null;
        app.quit();
        process.exit(0);
    });

    let inspectorShortcut = '';
    if(process.platform == 'darwin') {
        inspectorShortcut = 'Command+Alt+i';
    } else {
        inspectorShortcut = 'Control+Shift+i';
    }
    globalShortcut.register(inspectorShortcut, (e) => {
        webContents.getFocusedWebContents().openDevTools(); 
    });
});


ipcMain.on('reload', function(event, arg) {
    if(event.sender.webContents.name !== 'entry') {
        hardwareWindowReLaunch = true;
        hardwareWindow.close();
    }

    if(event.sender.webContents) {
        event.sender.webContents.reload();
    }
});

ipcMain.on('roomId', function(event, arg) {
    event.returnValue = global.sharedObject.roomId;
});

ipcMain.on('version', function(event, arg) {
    event.returnValue = '99';
});

ipcMain.on('serverMode', function(event, mode) {
    if(event.sender && event.sender.webContents) {
        event.sender.webContents.send('serverMode', mode);
    }
});

ipcMain.on('openHardware', function(event, arg) {
    launchHardware();
});

function launchHardware () {
    if(hardwareWindow == null) {
        var title;
        if(language === 'ko') {
            title = '엔트리 하드웨어';
        } else {
            title = 'Entry HardWare'
        }

        hardwareWindow = new BrowserWindow({
            width: 800, 
            height: 650,
            title: title,
            webPreferences: {
                backgroundThrottling: false
            }
        });

        hardwareWindow.setMenu(null);
        hardwareWindow.setMenuBarVisibility(false);
        hardwareWindow.loadURL('file:///' + path.join(__dirname, 'bower_components', 'entry-hw', 'app', 'index.html'));
        hardwareWindow.on('closed', function() {
            hardwareWindow = null;
            if(hardwareWindowReLaunch) {
                hardwareWindowReLaunch = false;
                launchHardware();
            }
        });

        if(option.debug) {
            hardwareWindow.webContents.openDevTools();
        }

        hardwareWindow.webContents.name = 'hardware';
        hardwareWindow.show();
    } else {
        if (hardwareWindow.isMinimized()) 
            hardwareWindow.restore();
        hardwareWindow.focus();
    }
}
