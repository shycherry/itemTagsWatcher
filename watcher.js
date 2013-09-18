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
Watcher.prototype.listFtp = listFtp;
Watcher.prototype.doFtpWatch = doFtpWatch;
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
        if(watcherConfig.database){
          self._itDB = require('itemTagsDB')({database: watcherConfig.database});
          self.emit('ready');
        }
      }
    });
  }
}

function doFtpWatch(){
  var self = this;
  if(!this._configDB){return;}
  this._configDB.fetchItemsSharingTags(['@ftpWatchingSet'], function(err, items){
    if(!err){
      for(var iSet = 0; iSet<items.length; iSet++){
        var ftpWatchingSet = items[iSet];
        self._configDB.fetchOne(ftpWatchingSet.ftpConfig, (function(ftpWatchingSet){
          return function(err, itemFtpConfig){
            if(!err){
              self.listFtp(itemFtpConfig.config, ftpWatchingSet.path);
            }
          };
        })(ftpWatchingSet));
      }
    }
  });
}

function listFtp(ftpConfig, path){
  var ftp = require('ftp')();
  ftp.on('ready', function(){
    ftp.list(path, function(err, list){
      console.dir(list);
      ftp.end();
    });
  });
  ftp.connect(ftpConfig);
}
