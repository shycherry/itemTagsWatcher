EventEmitter = require('events').EventEmitter;
inherits = require('util').inherits;

var Watcher = module.exports = function (options) {

  if(!(this instanceof Watcher))
    return new Watcher(options);

  var _itDB;
  var _configDB;
  
  if ('undefined' != typeof options) this.configure(options);
};

inherits(Watcher, EventEmitter);

/**
* exposed API
*/
Watcher.prototype.configure = configure;
Watcher.prototype._handleWatchPath_ = _handleWatchPath_;
Watcher.prototype._handleFtpPaths_ = _handleFtpPaths_;
Watcher.prototype._handleDummyPaths_ = _handleDummyPaths_;
Watcher.prototype._handleReport_ = _handleReport_;
Watcher.prototype.doWatch = doWatch;
Watcher.prototype.getDB = function(){return this._itDB;};

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
          self.emit('ready');
        }
      }
    });
  }
}

function doWatch(iCallback){
  var self = this;
  if(!this._configDB){return;}
  this._configDB.fetchItemsSharingTags(['@watchPath'], function(err, items){
    if(!err){
      var watchingQueue = require('async').queue(self._handleWatchPath_, 3);
      watchingQueue.empty = function(){console.log('queue is empty');};
      watchingQueue.drain = function(){
        console.log('drain');
        if(iCallback)
            iCallback();
      };
      watchingQueue.saturated = function(){console.log('a task is pending... queueing !');};

      for(var watchPathIdx = 0; watchPathIdx<items.length; watchPathIdx++){
        var currentWatchPath = items[watchPathIdx];
        currentWatchPath.this = self;
        watchingQueue.push(currentWatchPath, function(err, report){
          if(!err){
            self._handleReport_(report);
            console.log(report);
          }else{
            console.log('error : '+err);
          }
        });
      }
    }
  });
}

function _handleWatchPath_(iWatchPathItem, iCallback){
  var self = iWatchPathItem.this;
  if(iWatchPathItem.xorHasTags(['@ftpWatchPath'])){
    
    self._configDB.fetchOne(iWatchPathItem.ftpConfig, (function(iWatchPathItem){
      return function(err, itemFtpConfig){
        if(!err){
          self._handleFtpPaths_(itemFtpConfig.config, iWatchPathItem.path, iWatchPathItem.tagWith, function(err, report){
            iCallback(err, report);
          });
        }
      };
    })(iWatchPathItem));
  
  }else if(iWatchPathItem.xorHasTags(['@dummyWatchPath'])){
    
    self._handleDummyPaths_(iWatchPathItem, function(err, report){
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
  var report = {};

  ftp.on('ready', function(){
    ftp.list(iPath, function(err, list){
      for(var i in list){
        var relativePath = (list[i].name)? list[i].name : '/';
        report[i] = {
          'uri':encodeURI(Url.resolve(baseFtpUri, relativePath)),
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

function _handleReport_(iReport){
  if(!this._itDB){return;}
  var self = this;

  for(var iEntry in iReport){
    var entry = iReport[iEntry];
    
    this._itDB.fetchOneByFilter(_uriFilter_(entry.uri), (function(iEntry){
      return function(err, item){
        if(err){
          self._itDB.save({
            'uri':iEntry['uri'],
            'tags':iEntry['tagWith']
          },function(){});
        }else{
          item.addTags(iEntry['tagWith']);
          self._itDB.save(item, function(){});
        }
      };
    })(entry));
    
  }
}

function _handleDummyPaths_(iDummyWatchPath, iCallback){
  var report = {
    0:{
      'uri':'ftp://bidule:truc@serveur.fr:21/path/to/heaven.avi',
      'tagWith':['heaven','ftpFile'],
    },
    
    1:{
      'uri':'ftp://bidule:truc@serveur.fr:21/path/to/hell.avi',
      'tagWith':['hell','ftpFile'],
    },

  };

  iCallback(undefined, report);

}
