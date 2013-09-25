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
Watcher.prototype.handleFtpPaths = handleFtpPaths;
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
  this._configDB.fetchItemsSharingTags(['@ftpWatchPath'], function(err, items){
    if(!err){
      for(var iSet = 0; iSet<items.length; iSet++){
        var ftpWatchedPath = items[iSet];
        self._configDB.fetchOne(ftpWatchedPath.ftpConfig, (function(ftpWatchedPath){
          return function(err, itemFtpConfig){
            if(!err){
              self.handleFtpPaths(itemFtpConfig.config, ftpWatchedPath.path, function(err, report){
                for(var i in report){
                  console.log(report[i]);
                }
              });
            }
          };
        })(ftpWatchedPath));
      }
    }
  });
}

function handleFtpPaths(iFtpConfig, iPath, iCallback){
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
        report[i] = encodeURI(baseFtpUri+'/'+list[i].name);
      }
      ftp.end();
      iCallback(undefined, report);
    });
  });
  ftp.connect(iFtpConfig);
}
