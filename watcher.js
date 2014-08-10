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

    function retrieveDBs(iCallback){
      self._configDB.fetchItemsSharingTags(['watcherConfig'], function(err, items){
        if(!err && items && items.length == 1){
          var watcherConfig = items[0].getTagValue('watcherConfig');
          if(watcherConfig && watcherConfig.database){
            self._itDB = require('itemTagsDB')({database: watcherConfig.database});
            self._itDBSwitch = require('itemTagsDB')({database: watcherConfig.switchDatabase});
            iCallback();
          }else{
            iCallback('error');
          }
        }else{
          iCallback('error');
        }
      });
    }

    function retrieveWatchTags(iCallback){
      self._configDB.fetchItemsSharingTags(['watchTags'], function(err, items){
        if(!err && items){
          var watchTags = [];
          for(var iWatchTags in items){
            var currentWatchTag = items[iWatchTags].getTagValue('watchTags');
            if(currentWatchTag)
              watchTags = watchTags.concat(currentWatchTag);
          }
          self._watchTags = watchTags;
          iCallback();
        }else{
          iCallback('error');
        }
      });
    }

    Async.series(
      [
        retrieveDBs,
        retrieveWatchTags
      ], 
      function(err){
        if(err)
          self.emit('error');
        else
          self.emit('ready');
      }
    );
    
  }
}

function getDB(iCallback){
  if(iCallback) iCallback(null, this._itDB);
}

function getSwitchDB(iCallback){
  if(iCallback) iCallback(null, this._itDBSwitch);
}

function doDiff(iCallback){
  var self = this;
  if(!this._itDB){
    if(iCallback) iCallback('no db');
  }
  if(!this._itDBSwitch){
    if(iCallback) iCallback('no switch db');
  }

  function generateDiffDbForTag(iTag, iNotifier){
    return function(iCallback){
      var tagMatchFilter = {};
      tagMatchFilter["@"+iTag] = "/";
      self._itDB.diffDb(self._itDBSwitch, tagMatchFilter, function(err, report){
        if(err)
          iCallback(err);
        else{
          diffReportForTag = {
            'tag': iTag,
            'notifier': iNotifier,
            'addedItems': report['onlyDB1'],
            'removedItems': report['onlyDB2']
          };
          iCallback(null, diffReportForTag);
        }
      });
    }
  }

  var diffDbForTagFunctions = [];
  for(var iWatchTag in self._watchTags){
    var iCurrentWatchTag = self._watchTags[iWatchTag];
    var currentNotifier = iCurrentWatchTag['notifier'];
    for(var iTag in iCurrentWatchTag['tagsToWatch']){
      var currentTag = iCurrentWatchTag['tagsToWatch'][iTag];
      diffDbForTagFunctions.push(generateDiffDbForTag(currentTag, currentNotifier));
    }
  }

  if(diffDbForTagFunctions.length >= 1){
    Async.series(
      diffDbForTagFunctions,
      function(err, reports){
        if(err){
          if(iCallback) iCallback('error while diffs');
        }else{
          if(iCallback) iCallback(null, reports);
        }
      }
    );  
  }else{
    iCallback(null, {});
  }
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
