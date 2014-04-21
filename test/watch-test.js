var fs = require('fs');
var async = require('async');
var https = require('https');

var S_OK = 'SUCCEEDED';
var E_FAIL = 'FAILED';
var CONFIG_DB_PATH = './watch-test-watcherConfig.nosqltest';
var TMP_CONFIG_DB_PATH = './tmp-watch-test-watcherConfig.nosql';
var DB_PORT = 1337;

var watcher = null;
var TMP_DB_PATH =  './tmp-watch-test-db.nosql';
var SWITCH_TMP_DB_PATH =  './last-tmp-watch-test-db.nosql';

function loadDb(iCallback){
  watcher = require('../watcher')({
    configDB:TMP_CONFIG_DB_PATH
  });
  
  watcher.on('ready', function(){
    iCallback(null, S_OK);
  });
}

function rmDB(){
  fs.unlinkSync(TMP_DB_PATH);
  fs.unlinkSync(TMP_CONFIG_DB_PATH);
}

console.log('start watcher test');

function testWatch(iCallback){
  console.log('testWatch ');
  
  watcher.doWatch(function(err){
    if(err){
      console.log('KO ',err);
      iCallback(err, E_FAIL);
    }else{
      iCallback(null, S_OK);
    }
  });
  
}

function testCheck(iCallback){
  console.log('testCheck ');
  watcher.getDB().fetchAll(function(err, items){
    if(err){
      iCallback(err, E_FAIL);
    }else{
      if(items.length != 2){
        iCallback('bad expected count', E_FAIL);
      }else{
        iCallback(null, S_OK);
      }
    }
  });

}

async.series(
  {
    copyDb : function(callback){return copyFile(CONFIG_DB_PATH, TMP_CONFIG_DB_PATH, callback);},
    loadDb : function(callback){return loadDb(callback);},
    watch: function(callback){return testWatch(callback);},
    check: function(callback){return testCheck(callback);}
  },

  function finishCallback(err, results){
    console.log('erreurs: '+JSON.stringify(err));
    console.log('test results:'+JSON.stringify(results));
    rmDB();
  }
);




//
//utilities 
//

function copyFile(source, target, cb) {
  //create a copy of db
  if(fs.existsSync(target)){
    fs.unlinkSync(target);
  }

  var cbCalled = false;

  var rd = fs.createReadStream(source);
  rd.on("error", function(err) {
    done(err);
  });
  var wr = fs.createWriteStream(target);
  wr.on("error", function(err) {
    done(err);
  });
  wr.on("close", function(ex) {
    done();
  });
  rd.pipe(wr);

  function done(err) {
    if (!cbCalled) {
      cb(err);
      cbCalled = true;
    }
  }
}
