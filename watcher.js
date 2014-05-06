var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Async = require('async');
var Path = require('path');

var Watcher = module.exports = function (options) {

  if(!(this instanceof Watcher))
    return new Watcher(options);

  var _itDB;
  var _itDBSwitch;
  var _configDB;
  var _requestQueue;
  var _ready;
  
  if ('undefined' != typeof options) this.configure(options);
};

inherits(Watcher, EventEmitter);

/**
* exposed API
*/
Watcher.prototype.configure = configure;
Watcher.prototype.doWatch = function(iCallback){return this._requestQueue.push(doWatch.bind(this), iCallback)};
Watcher.prototype.doDiff = function(iCallback){return this._requestQueue.push(doDiff.bind(this), iCallback)};
Watcher.prototype.getDB = function(){return this._itDB;};
Watcher.prototype.getSwitchDB = function(){return this._itDBSwitch;};

/**
* methods
*/
function configure(options){
  var self = this;
  
  this._requestQueue = Async.queue(function(iRequestTask, iCallback){
    if(self._ready){
      iRequestTask(iCallback);  
    }else{
      self.once('ready', function(){
        iRequestTask(iCallback)
      });
    }    
  }, 1);

  this._ready = false;
  this.once('ready', function(){
    self._ready = true;
  });

  if('undefined' != typeof options.configDB){
    this._configDB = require('itemTagsDB')({database: options.configDB});
    this._configDB.fetchItemsSharingTags(['watcherConfig'], function(err, items){
      if(!err && items && items.length == 1){
        var watcherConfig = items[0].getTagValue('watcherConfig');
        if(watcherConfig && watcherConfig.database){
          self._itDB = require('itemTagsDB')({database: watcherConfig.database});
          self._itDBSwitch = require('itemTagsDB')({database: watcherConfig.switchDatabase});
          self.emit('ready');
        }else{
          self.emit('error');
        }
      }else{
        self.emit('error');
      }
    });
  }
}

function doDiff(iCallback){
  if(!this._itDB){
    if(iCallback) iCallback('no db');
  }
  if(!this._itDBSwitch){
    if(iCallback) iCallback('no switch db');
  }

  var fileUriMatchFilter = JSON.stringify({"@file":{"uri":"/"}});
  this._itDB.diffDb(this._itDBSwitch,fileUriMatchFilter, function(err, report){
    if(err){
      if(iCallback) iCallback(err);
      return;
    }

    var diffReport = {};

    if(report){
      diffReport['addedItems'] = report['onlyDB1'];
      diffReport['removedItems'] = report['onlyDB2'];
    }
    
    if(iCallback) iCallback(null, diffReport);
  });
}

function doWatch(iCallback){
  var self = this;
  if(!this._configDB){
    iCallback('no configDB');
  }

  switchDatabase(self._itDB, self._itDBSwitch, function(err){
    
    if(err){

      if(iCallback) iCallback(err);

    }else{
      self._configDB.fetchItemsSharingTags(['watchPath'], function(err, items){
        if(!err){
          var watchingQueue = Async.queue(_handleWatchPath_, 1);
          watchingQueue.empty = function(){console.log('queue is empty');};
          watchingQueue.drain = function(){console.log('drain');};
          watchingQueue.saturated = function(){console.log('a task is pending... queueing !');};

          var watchPathReportsProcessed = 0;
          var callbackIfComplete = function (err){
            if((watchPathReportsProcessed == items.length) && iCallback)
            {
              iCallback(err);
            }
              
          };

          for(var watchPathIdx = 0; watchPathIdx<items.length; watchPathIdx++){
                    
            var watchTask = {
              "watchPath": items[watchPathIdx],
              "configDB": self._configDB
            };

            watchingQueue.push(watchTask, function(err, iWatchReport){
              
              if(!err){
                console.log(iWatchReport);
                _handleWatchReport_(iWatchReport, self.getDB(), function(err){
                  watchPathReportsProcessed ++;
                  callbackIfComplete(err);
                });
              }else{
                console.log(err);
                watchPathReportsProcessed ++;
                callbackIfComplete(err);
              }

            });
          }
        
        }
      });
    }
    
  });

}

function _handleWatchPath_(iWatchTask, iCallback){

  var watchPath = iWatchTask['watchPath'];
  var configDB = iWatchTask['configDB'];

  if(watchPath.xorHasTags(['ftpWatchPath'])){
    
    configDB.fetchOne(watchPath.getTagValue('ftpWatchPath').ftpConfig, (function(iWatchPath){
      return function(err, itemFtpConfig){
        if(!err){
          _handleFtpPaths_(
            itemFtpConfig.getTagValue('ftpConfig'), 
            iWatchPath.getTagValue('ftpWatchPath').path,
            iWatchPath.getTagValue('watchPath').tagWith, 
            function(err, report){
              iCallback(err, report);
            }
          );
        }
      };
    })(watchPath));
  
  }else if(watchPath.xorHasTags(['dummyWatchPath'])){
    
    _handleDummyPaths_(watchPath, function(err, report){
      iCallback(err, report);
    });

  }else if(watchPath.xorHasTags(['dummyWatchPath2'])){
    
    _handleDummyPaths2_(watchPath, function(err, report){
      iCallback(err, report);
    });

  }
}

function _handleFtpPaths_(iFtpConfig, iPath, iTagWith, iCallback){
  var ftp = require('ftp')();
  var Url = require('url');
  var baseFtpUri = Url.format({
    protocol: 'ftp',
    hostname: iFtpConfig.host,
    auth: iFtpConfig.user+':'+iFtpConfig.password
  });
  baseFtpUri = Url.resolve(baseFtpUri, iPath);
  if(baseFtpUri[baseFtpUri.length-1] !== '/'){
    baseFtpUri+='/';
  }
  var report = {};

  ftp.on('ready', function(){
    ftp.list(iPath, function(err, list){
      for(var i in list){
        var fileOrDirName = (list[i].name)? list[i].name : '';
        report[i] = {
          'uri': Url.resolve(baseFtpUri, fileOrDirName),
          'tagWith': iTagWith
        };
      }
      ftp.end();
      iCallback(undefined, report);
    });
  });

  ftp.on('error', function(err){
    iCallback(err);
  });

  ftp.connect(iFtpConfig);
}

function _fileUriFilter_(iUri){
  return JSON.stringify({
    "@file" : {"uri" : iUri}
  });
}

function _handleWatchReport_(iWatchReport, iStoreDB, iCallback){
  if(!iStoreDB){
    if(iCallback)
      iCallback('no store db');
    return;
  }
  if(!iCallback)
    iCallback = function(){};

  var Entries = [];
  for(var iEntry in iWatchReport){
    Entries.push(iWatchReport[iEntry]);
  }

  //Here is items creation !
  function handleNextEntry(iCallback){
    var entry = Entries.shift();
    iStoreDB.fetchOneByFilter(_fileUriFilter_(entry.uri), (function(iEntry){
      return function(err, item){
        if(err){          
          item = iStoreDB.getNewItem(
          {
            "@file" : {
              "uri" : iEntry['uri']
            },
          });
        }
        
        item.addTags(iEntry['tagWith']);
        iStoreDB.save(item, function(err, item){
          if(iCallback)
            iCallback();
        });
        
      };
    })(entry));
  }

  Async.until( function(){return (Entries.length <= 0);}, handleNextEntry, iCallback);
}

function _handleDummyPaths_(iDummyWatchPath, iCallback){
  var watchReport = {
    0:{
      'uri':'ftp://bidule:truc@serveur.fr:21/path/to/heaven.avi',
      'tagWith':['dummyresult1','heaven','ftpFile'],
    },
    
    1:{
      'uri':'ftp://bidule:truc@serveur.fr:21/path/to/hell.avi',
      'tagWith':['dummyresult1','hell','ftpFile'],
    },

  };

  iCallback(undefined, watchReport);

}

function _handleDummyPaths2_(iDummyWatchPath, iCallback){
  var watchReport = {
    0:{
      'uri':'ftp://bidule:truc@serveur.fr:21/path/to/hell.avi',
      'tagWith':['dummyresult2','hell','ftpFile'],
    },

  };

  iCallback(undefined, watchReport);

}

function switchDatabase(iDatabase, iSwitchDatabase, iCallback) {
  if(!iSwitchDatabase || !iDatabase){
    if(iCallback)
      iCallback('bad inputs');
  }

  iSwitchDatabase.cloneDb(iDatabase, function(err){
    if(iCallback) iCallback(err);
  });

}
