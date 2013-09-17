module.exports = function (options) {
   
  /**
   * Module options
   */  
  var itDB = null
  var configDB = null
  if ('undefined' != typeof options) _set_options_(options)
  
  /**
   * Privates
   */
  function _set_options_(options){
    if('undefined' != typeof options.database){
      itDB = require('itemTagsDB')({database: options.database})      
    }
    if('undefined' != typeof options.configDB){
      configDB = require('itemTagsDB')({database: options.configDB})      
    }
  }
  
  
  /**
   * Protected
   */
  function deleteOne (uuid, callback) {
    nosql.remove(_uuidFilter_(uuid), function(removedCount){
      callback(undefined, removedCount)
    })
  }

  function listFtp(){
    if(!configDB){return}
    configDB.fetchItemsSharingTags(['@ftpConfig'], function(err, items){
      if(!err){
        var ftpConfig = items[0]
        var ftp = require('ftp')()
        ftp.on('ready', function(){
          ftp.list(function(err, list){
            console.dir(list)
            ftp.end()
          })
        })
        ftp.connect(ftpConfig)
      }      
    })
  }  

  /**
  * exposed API
  */
  return {
    
    "configure": _set_options_,

    "listFtp": listFtp,

    "getDB": function getDB(){return itDB}

  }
 
}
