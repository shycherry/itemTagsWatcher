module.exports = function (options) {
   
  /**
   * Module options
   */  
  var itDB = null
  if ('undefined' != typeof options) _set_options_(options)
  
  /**
   * Privates
   */
  function _set_options_(options){
    if('undefined' != typeof options.database){
      itDB = require('itemTagsDB'){database: options.database}
      itDB.dumpDB()
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
  

  /**
  * exposed API
  */
  return {
    
    "configure": _set_options_,    

  }
 
}
