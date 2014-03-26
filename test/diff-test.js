var fs = require('fs');
var async = require('async');
var https = require('https');

var S_OK = 'SUCCEEDED';
var E_FAIL = 'FAILED';
var CONFIG_DB_PATH = './diff-test-watcherConfig.nosqltest';
var TMP_CONFIG_DB_PATH = './tmp-diff-test-watcherConfig.nosql';

var CONFIG_DB_PATH2 = './diff-test-watcherConfig2.nosqltest';
var TMP_CONFIG_DB_PATH2 = './tmp-diff-test-watcherConfig2.nosql';

var DB_PORT = 1337;

var watcher = null;
var TMP_DB_PATH =  './tmp-diff-test-db.nosql';
var SWITCH_TMP_DB_PATH =  './last-tmp-diff-test-db.nosql';

function loadDb(iCallback){
  watcher = require('../watcher')({
    configDB:TMP_CONFIG_DB_PATH
  });

  watcher.on('ready', function(){
    iCallback(null, S_OK);
  });
}

function loadDb2(iCallback){
  watcher = require('../watcher')({
    configDB:TMP_CONFIG_DB_PATH2
  });

  watcher.on('ready', function(){
    iCallback(null, S_OK);
  });
}

function rmDB(){
  fs.unlinkSync(TMP_DB_PATH);
  fs.unlinkSync(SWITCH_TMP_DB_PATH);
  fs.unlinkSync(TMP_CONFIG_DB_PATH);
  fs.unlinkSync(TMP_CONFIG_DB_PATH2);
}

console.log('start diff test');

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

function testCheckDB(iCallback){
  console.log('testCheckDB');
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

function testCheckDBBis(iCallback){
  console.log('testCheckDB');
  watcher.getDB().fetchAll(function(err, items){
    if(err){
      iCallback(err, E_FAIL);
    }else{
      if(items.length != 1){
        iCallback('bad expected count', E_FAIL);
      }else{
        iCallback(null, S_OK);
      }
    }
  });
}

function testCheckSwitchDB(iCallback){
  console.log('testCheckSwitchDB');
  watcher.getSwitchDB().fetchAll(function(err, items){
    if(err){
      iCallback(err, E_FAIL);
    }else{
      if(items.length != 0){
        iCallback('bad expected count', E_FAIL);
      }else{
        iCallback(null, S_OK);
      }
    }
  });
}

function testCheckSwitchDBBis(iCallback){
  console.log('testCheckSwitchDB');
  watcher.getSwitchDB().fetchAll(function(err, items){
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
    copyDb2 : function(callback){return copyFile(CONFIG_DB_PATH2, TMP_CONFIG_DB_PATH2, callback);},
    loadDb : function(callback){return loadDb(callback);},    
    watch: function(callback){return testWatch(callback);},
    check: function(callback){return testCheckDB(callback);},
    checkSwitch: function(callback){return testCheckSwitchDB(callback);},
    loadDb2 : function(callback){return loadDb2(callback);},
    watchBis: function(callback){return testWatch(callback);},
    checkBis: function(callback){return testCheckDBBis(callback);},
    checkSwitchBis: function(callback){return testCheckSwitchDBBis(callback);}    
  },

  function finishCallback(err, results){
    console.log('erreurs: '+JSON.stringify(err));
    console.log('test results:'+JSON.stringify(results, 2, 2));
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
