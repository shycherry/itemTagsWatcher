var fs = require('fs');
var async = require('async');

var S_OK = 'SUCCEEDED';
var E_FAIL = 'FAILED';
var CONFIG_DB_PATH = './switch-test-watcherConfig.nosqltest';
var TMP_CONFIG_DB_PATH = './tmp-switch-test-watcherConfig.nosql';

var CONFIG_DB_PATH2 = './switch-test-watcherConfig2.nosqltest';
var TMP_CONFIG_DB_PATH2 = './tmp-switch-test-watcherConfig2.nosql';

var DB_PORT = 1337;

var watcher = null;
var TMP_DB_PATH =  './tmp-switch-test-db.nosql';
var SWITCH_TMP_DB_PATH =  './last-tmp-switch-test-db.nosql';

function loadDb(iCallback){
  console.log('loadDb test');
  watcher = require('../watcher')({
    configDB:TMP_CONFIG_DB_PATH
  });

  watcher.on('ready', function(){
    iCallback(null, S_OK);
  });
}

function loadDb2(iCallback){
  console.log('loadDb2 test');
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

function testSave(iCallback){
  console.log('testSave ');
  
  watcher.getDB(function(err, db){
    if(err){
      console.log('KO ',err);
      iCallback(err, E_FAIL);
    }else{
      db.save({'test_item_1':'truc'}, function(err, callback){
        db.save({'test_item_2':'bidule'}, function(err, callback){
          iCallback(null, S_OK);
        }); 
      });
    }
  });
  
}

function testSwitch(iCallback){
  console.log('testSwitch ');
  
  watcher.doSwitch(function(err){
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
  watcher.getDB(function(err, db){
    db.fetchAll(function(err, items){
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
  });
}

function testCheckDBBis(iCallback){
  console.log('testCheckDBBis');
  watcher.getDB(function(err, db){
    db.fetchAll(function(err, items){
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
  });
}

function testCheckSwitchDB(iCallback){
  console.log('testCheckSwitchDB');
  watcher.getSwitchDB(function(err, db){
    db.fetchAll(function(err, items){
      if(err){
        iCallback(err, E_FAIL);
      }else{
        if(items.length !== 2){
          iCallback('bad expected count', E_FAIL);
        }else{
          iCallback(null, S_OK);
        }
      }
    });
  });
}

function testCheckSwitchDBBis(iCallback){
  console.log('testCheckSwitchDBBis');
  watcher.getSwitchDB(function(err, db){
    db.fetchAll(function(err, items){
      if(err){
        iCallback(err, E_FAIL);
      }else{
        if(items.length != 4){
          iCallback('bad expected count', E_FAIL);
        }else{
          iCallback(null, S_OK);
        }
      }
    });
  });
}

function testDiff(iCallback){
  console.log('testDiff');
  watcher.doDiff(function(err, iDiffReport){
    console.log('diff report:');
    console.log(JSON.stringify(iDiffReport,2,2));
    if(err){
      iCallback(err, E_FAIL);
    }else{
      iCallback(null, S_OK);
    }
  });
}

async.series(
  {
    copyDb : function(callback){return copyFile(CONFIG_DB_PATH, TMP_CONFIG_DB_PATH, callback);},
    copyDb2 : function(callback){return copyFile(CONFIG_DB_PATH2, TMP_CONFIG_DB_PATH2, callback);},
    loadDb : function(callback){return loadDb(callback);},
    save: function(callback){return testSave(callback);},
    switch: function(callback){return testSwitch(callback);},
    check: function(callback){return testCheckDB(callback);},
    checkSwitch: function(callback){return testCheckSwitchDB(callback);},    
    saveBis: function(callback){return testSave(callback);},
    diff: function(callback){return testDiff(callback);}
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
