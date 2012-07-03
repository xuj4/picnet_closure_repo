﻿;
goog.provide('pn.ui.edit.Config');

goog.require('pn.ui.edit.Command');
goog.require('pn.ui.edit.DeleteCommand');



/**
 * @constructor
 * @extends {goog.Disposable}
 * @param {!Array.<pn.ui.edit.FieldCtx>} fCtxs An array of field meta
 *    specifications that describe how each of the display fields should be
 *    displayed, captioned and validated.
 * @param {Array.<pn.ui.edit.Command>=} opt_commands An optional commands array
 *    which can also be empty. If not defined then a default set of commands
 *    are used.
 * @param {function(?):string=} opt_template The optional template to render
 *    this edit control.
 * @param {function(new:pn.ui.edit.Interceptor,!pn.ui.edit.CommandsComponent,
 *    !Object,!Object.<!Array.<!Object>>,!Object.<Element|goog.ui.Component>,
 *    !Object.<goog.ui.Button>)=} opt_interceptor The optional interceptor
 *    constructor pointer used to receive and intercept lifecycle events.
 */
pn.ui.edit.Config =
    function(fCtxs, opt_commands, opt_template, opt_interceptor) {
  goog.asserts.assert(fCtxs);

  goog.Disposable.call(this);

  /** @type {!Array.<pn.ui.edit.FieldCtx>} */
  this.fCtxs = fCtxs;

  /** @type {!Array.<pn.ui.edit.Command>} */
  this.commands = opt_commands || this.getDefaultCommands_();
  goog.array.forEach(this.commands, this.registerDisposable, this);

  /** @type {null|function(?):string} */
  this.template = opt_template || null;

  /** @type {null|function(new:pn.ui.edit.Interceptor,
   *    !pn.ui.edit.CommandsComponent,!Object,!Object.<!Array.<!Object>>,
   *    !Object.<Element|goog.ui.Component>,!Object.<goog.ui.Button>)} */
  this.interceptor = opt_interceptor || null;

  /** @type {boolean} */
  this.autoFocus = true;

  /** @type {null|
      function(!pn.ui.UiSpec,!Object,!Object.<!Array.<!Object>>):string} */
  this.titleStrategy = null;

  /**
   * The Grid control will use pn.app.ctx.pub to publish events if this is true.
   *    Otherwise traditional goog.events.Event will be used.
   * @type {boolean}
   */
  this.publishEventBusEvents = true;
};
goog.inherits(pn.ui.edit.Config, goog.Disposable);


/**
 * @private
 * @return {!Array.<pn.ui.edit.Command>} The default commands used when no
 *    opt_commands are passed into the constructor.
 */
pn.ui.edit.Config.prototype.getDefaultCommands_ = function() {
  return [
    new pn.ui.edit.Command('Save', pn.app.AppEvents.ENTITY_SAVE, true),
    new pn.ui.edit.Command('Clone', pn.app.AppEvents.ENTITY_CLONE),
    new pn.ui.edit.DeleteCommand(),
    new pn.ui.edit.Command('Cancel', pn.app.AppEvents.ENTITY_CANCEL)
  ];
};
