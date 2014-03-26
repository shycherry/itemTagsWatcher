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
  
  if ('undefined' != typeof options) this.configure(options);
};

inherits(Watcher, EventEmitter);

/**
* exposed API
*/
Watcher.prototype.configure = configure;
Watcher.prototype.doWatch = doWatch;
Watcher.prototype.doDiff = doDiff;
Watcher.prototype.getDB = function(){return this._itDB;};
Watcher.prototype.getSwitchDB = function(){return this._itDBSwitch;};

/**
* methods
*/
function configure(options){
  var self = this;
  if('undefined' != typeof options.configDB){
    this._configDB = require('itemTagsDB')({database: options.configDB});
    this._configDB.fetchItemsSharingTags(['@watcherConfig'], function(err, items){
      if(!err){
        var watcherConfig = items[0];
        if(watcherConfig && watcherConfig.database){
          self._itDB = require('itemTagsDB')({database: watcherConfig.database});
          self._itDBSwitch = require('itemTagsDB')({database: watcherConfig.switchDatabase});
          self.emit('ready');
        }
      }
    });
  }
}

function doDiff(iCallback){  
  var diffReport = {};
  var newItems = [];
  var removedItems = [];

  this._itDBSwitch.fetchAll(function(err, items){

  });

}

function doWatch(iCallback){
  var self = this;
  if(!this._configDB){
    iCallback('no configDB');
  }
  this._configDB.fetchItemsSharingTags(['@watchPath'], function(err, items){
    if(!err){
      var watchingQueue = Async.queue(_handleWatchPath_, 3);
      watchingQueue.empty = function(){console.log('queue is empty');};
      watchingQueue.drain = function(){console.log('drain');};
      watchingQueue.saturated = function(){console.log('a task is pending... queueing !');};

      var watchPathReportsProcessed = 0;
      var callbackIfComplete = function (err){
        if((watchPathReportsProcessed == items.length) && iCallback)
        {
          switchDatabase(self._itDB, self._itDBSwitch, function(err){
            iCallback(err);
          });
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

function _handleWatchPath_(iWatchTask, iCallback){

  var watchPath = iWatchTask['watchPath'];
  var configDB = iWatchTask['configDB'];

  if(watchPath.xorHasTags(['@ftpWatchPath'])){
    
    configDB.fetchOne(watchPath.ftpConfig, (function(iWatchPath){
      return function(err, itemFtpConfig){
        if(!err){
          _handleFtpPaths_(itemFtpConfig.config, iWatchPath.path, iWatchPath.tagWith, function(err, report){
            iCallback(err, report);
          });
        }
      };
    })(watchPath));
  
  }else if(watchPath.xorHasTags(['@dummyWatchPath'])){
    
    _handleDummyPaths_(watchPath, function(err, report){
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

function _uriFilter_(iUri){
  return function(item){
    return item.uri == iUri;
  };
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

  function handleNextEntry(iCallback){
    var entry = Entries.shift();
    iStoreDB.fetchOneByFilter(_uriFilter_(entry.uri), (function(iEntry){
      return function(err, item){
        if(err){
          var newItem = {
            'uri':iEntry['uri'],
            'tags':iEntry['tagWith'],
            'name':decodeURI(Path.basename(iEntry['uri']))
          };
          iStoreDB.save(newItem, function(){
            if(iCallback)
              iCallback();
          });
        }else{
          item.addTags(iEntry['tagWith']);
          iStoreDB.save(item, function(err, item){
            if(iCallback)
              iCallback();
          });
        }
      };
    })(entry));
  }

  Async.until( function(){return (Entries.length <= 0);}, handleNextEntry, iCallback);
}

function _handleDummyPaths_(iDummyWatchPath, iCallback){
  var watchReport = {
    0:{
      'uri':'ftp://bidule:truc@serveur.fr:21/path/to/heaven.avi',
      'tagWith':['heaven','ftpFile'],
    },
    
    1:{
      'uri':'ftp://bidule:truc@serveur.fr:21/path/to/hell.avi',
      'tagWith':['hell','ftpFile'],
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
