﻿;
goog.provide('pn.data.BaseDalCache');



/**
 * @constructor
 * @param {!Object.<!Array.<pn.data.Entity>>} cache The current context cache.
 */
pn.data.BaseDalCache = function(cache) {
  pn.assObj(cache);
  pn.ass(goog.object.every(cache, goog.isArray));

  /**
   * @private
   * @type {!Object.<!Array.<pn.data.Entity>>}
   */
  this.cache_ = {};
  // This handles LocalCache style query results that have Type:Linq
  //  map keys.
  for (var key in cache) {
    var type = key.split(':')[0];
    pn.ass(!(type in this.cache_));
    this.cache_[type] = cache[key];
  }
};


/**
 * @param {string} type The type to retreive from the cache.
 * @return {!Array.<pn.data.Entity>} The entities of the specified type.
 */
pn.data.BaseDalCache.prototype.get = function(type) {
  pn.assStr(type);

  var arr = this.cache_[type];
  if (!arr) throw new Error('Type: ' + type + ' not in cache.');
  return arr;
};


/**
 * @param {string} type The type to retreive from the cache.
 * @param {number} id The ID of the entity of the specified type to retreive.
 * @return {!pn.data.Entity} The entities of the specified type.
 */
pn.data.BaseDalCache.prototype.getEntity = function(type, id) {
  pn.assStr(type);
  pn.ass(goog.isNumber(id) && id > 0);

  return this.get(type).pnsingle(function(e) { return e.id === id; });
};