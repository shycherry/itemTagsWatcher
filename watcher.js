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
Watcher.prototype.doDiff = function(iCallback){return this._requestQueue.push(doDiff.bind(this), iCallback)};
Watcher.prototype.doSwitch = function(iCallback){return this._requestQueue.push(doSwitch.bind(this), iCallback)};
Watcher.prototype.getDB = function(iCallback){return this._requestQueue.push(getDB.bind(this), iCallback)};
Watcher.prototype.getSwitchDB = function(iCallback){return this._requestQueue.push(getSwitchDB.bind(this), iCallback)};

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

function getDB(iCallback){
  if(iCallback) iCallback(null, this._itDB);
}

function getSwitchDB(iCallback){
  if(iCallback) iCallback(null, this._itDBSwitch);
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

function doSwitch(iCallback) {  
  var switchDatabase = this._itDBSwitch;
  var currentDatabase = this._itDB;

  if(!switchDatabase || !currentDatabase){
    if(iCallback)
      iCallback('doSwitch error : database missing');
  }

  console.log('cloning database to switch_database...');
  switchDatabase.cloneDb(currentDatabase, function(err){
    if(iCallback) iCallback(err);
  });

}
