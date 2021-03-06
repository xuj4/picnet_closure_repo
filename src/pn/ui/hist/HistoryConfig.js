﻿;
goog.provide('pn.ui.hist.HistoryConfig');

goog.require('pn.ui.edit.soy.history');



/**
 * @constructor
 * @extends {goog.Disposable}
 * @param {!pn.ui.UiSpec} spec The entity spec being shown.
 * @param {!pn.data.BaseDalCache} cache The current context cache.
 * @param {!Array.<!pn.data.Entity>} changes The changes (audit
 *    entries) to display.
 */
pn.ui.hist.HistoryConfig = function(spec, cache, changes) {
  goog.Disposable.call(this);

  pn.assInst(spec, pn.ui.UiSpec);
  pn.assInst(cache, pn.data.BaseDalCache);
  pn.assArr(changes);

  /**
   * @const
   * @type {!pn.ui.UiSpec}
   */
  this.spec = spec;

  /**
   * @const
   * @type {!pn.data.BaseDalCache}
   */
  this.cache = cache;

  /**
   * @const
   * @type {!Array.<!pn.data.Entity>}
   */
  this.changes = changes;

  var entity = pn.data.TypeRegister.create(spec.type, {'ID': 0});
  var cfg = spec.getEditConfig(entity, cache);
  /**
   * @const
   * @type {!Array.<pn.ui.edit.FieldCtx>}
   */
  this.fields = cfg.fCtxs;
  goog.dispose(cfg);
};
goog.inherits(pn.ui.hist.HistoryConfig, goog.Disposable);


/**
 * @param {pn.data.Entity} e The entity being displayed.
 * @return {string} The heading for the specified entity.  The default
 *    implementation returns the EntityType + Name field or simply the 'ID'.
 *    Override to change.
 */
pn.ui.hist.HistoryConfig.prototype.getHeading = function(e) {
  pn.assInst(e, pn.data.Entity);

  if (!e) { return ''; }
  var nameprop = this.spec.type + 'Name';
  if (e.hasProp(nameprop)) { return 'History - ' + e.getValue(nameprop); }
  return 'History - ID: ' + e.id;
};


/** @return {string} The html for the HistoryViewer control.  See
 *    HistoryViewer.js for details on what is expected of this template. */
pn.ui.hist.HistoryConfig.prototype.getTemplate = function() {
  return pn.ui.edit.soy.history.page();
};
