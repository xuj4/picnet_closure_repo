﻿;
goog.provide('pn.ui.grid.Grid');

goog.require('goog.dom');
goog.require('goog.events.Event');
goog.require('goog.ui.Button');
goog.require('goog.ui.Component');
goog.require('goog.ui.Component.EventType');
goog.require('pn.app.AppEvents');
goog.require('pn.json');
goog.require('pn.storage');
goog.require('pn.ui.grid.ColumnCtx');
goog.require('pn.ui.grid.Config');
goog.require('pn.ui.grid.DataView');
goog.require('pn.ui.grid.OrderingColumnSpec');
goog.require('pn.ui.grid.QuickFind');
goog.require('pn.ui.grid.RowOrdering');
goog.require('pn.ui.soy');



/**
 * The pn.ui.grid.Grid is built atop SlickGrid
 * (https://github.com/mleibman/SlickGrid/).  See SlickGrid documentation for
 * full detauils.
 *
 * @constructor
 * @extends {goog.ui.Component}
 * @param {!pn.ui.UiSpec} spec The specs for the entities in
 *    this grid.
 * @param {!Array} list The entities to display.
 * @param {!Object.<Array>} cache The data cache to use for related entities.
 */
pn.ui.grid.Grid = function(spec, list, cache) {
  goog.asserts.assert(spec);
  goog.asserts.assert(list);
  goog.asserts.assert(cache);

  goog.ui.Component.call(this);

  /**
   * @private
   * @type {!pn.ui.UiSpec}
   */
  this.spec_ = spec;
  this.registerDisposable(this.spec_);

  /**
   * @private
   * @type {pn.ui.grid.Config}
   */
  this.cfg_ = this.spec_.getGridConfig(cache);
  this.registerDisposable(this.cfg_);

  /**
   * @private
   * @type {pn.ui.grid.Interceptor}
   */
  this.interceptor_ = this.cfg_.interceptor ?
      new this.cfg_.interceptor(cache) : null;
  this.registerDisposable(this.interceptor_);

  /**
   * @private
   * @const
   * @type {string}
   */
  this.hash_ = goog.array.reduce(this.cfg_.cCtxs,
      function(acc, f) { return acc + f.id; }, '');

  /**
   * @private
   * @type {goog.debug.Logger}
   */
  this.log_ = pn.log.getLogger('pn.ui.grid.Grid');

  /**
   * @private
   * @type {!Array}
   */
  this.list_ = this.interceptor_ ? this.interceptor_.filterList(list) : list;


  /**
   * @private
   * @type {!Array.<!pn.ui.grid.ColumnCtx>}
   */
  this.cctxs_ = this.getColumnsWithInitialState_(this.cfg_.cCtxs);

  /**
   * @private
   * @type {!Array.<!pn.ui.grid.ColumnCtx>}
   */
  this.totalColumns_ = goog.array.filter(this.cctxs_,
      function(cctx) { return !!cctx.spec.total; });

  /**
   * @private
   * @type {!Object.<Array>}
   */
  this.cache_ = cache;

  /**
   * @private
   * @type {!Array.<pn.ui.grid.Command>}
   */
  this.commands_ = this.cfg_.commands;

  /**
   * @private
   * @type {Slick.Grid}
   */
  this.slick_ = null;

  /**
   * @private
   * @type {Element}
   */
  this.noData_ = null;

  /**
   * @private
   * @type {pn.ui.grid.DataView}
   */
  this.dataView_ = null;

  /**
   * @private
   * @type {Function}
   */
  this.selectionHandler_ = null;

  /**
   * @private
   * @type {null|function(Object):boolean}
   */
  this.currentFilter_ = null;

  /**
   * @private
   * @type {pn.ui.grid.QuickFind}
   */
  this.quickFind_ = null;

  /**
   * @private
   * @type {pn.ui.grid.RowOrdering}
   */
  this.rowOrdering_ = null;

  /**
   * @private
   * @type {Object}
   */
  this.sortState_ = null;

  /**
   * @private
   * @type {Element}
   */
  this.totalsLegend_ = null;
};
goog.inherits(pn.ui.grid.Grid, goog.ui.Component);


/** @param {function(Object):boolean} filter The filter function to apply. */
pn.ui.grid.Grid.prototype.filter = function(filter) {
  this.log_.info('Filtering grid');
  this.currentFilter_ = filter;
  this.dataView_.refresh();
  this.slick_.render();
};


/**
 * @private
 * @param {!Object} item The row item to pass to the currentFilter_.
 * @return {boolean} Whether the specified item satisfies the currentFilter.
 */
pn.ui.grid.Grid.prototype.filterImpl_ = function(item) {
  if (this.quickFind_ && !this.quickFind_.matches(item)) { return false; }
  return !this.currentFilter_ || this.currentFilter_(item);
};


/** @override */
pn.ui.grid.Grid.prototype.createDom = function() {
  this.decorateInternal(this.dom_.createElement('div'));
};


/** @override */
pn.ui.grid.Grid.prototype.decorateInternal = function(element) {
  this.setElementInternal(element);

  if (!this.cfg_.readonly) {
    goog.array.forEach(this.commands_, function(c) {
      c.decorate(element);
    }, this);
  }

  var height = 80 + Math.min(550, this.list_.length * 25);
  var width = $(element).width();
  var hasData = this.list_.length > 0;
  var parent = pn.dom.addHtml(element,
      pn.ui.soy.grid({
        specId: this.spec_.id,
        width: width,
        height: height,
        hasData: hasData}));
  this.noData_ = goog.dom.getElementByClass('grid-no-data', parent);
  var gridContainer = goog.dom.getElementByClass('grid-container', parent);


  if (hasData) {
    this.dataView_ = new pn.ui.grid.DataView();
    this.registerDisposable(this.dataView_);

    var columns = goog.array.map(this.cctxs_,
        goog.bind(this.getColumnSlickConfig_, this));
    this.slick_ = new Slick.Grid(gridContainer, this.dataView_,
        columns, this.cfg_.toSlick());

    if (this.totalColumns_.length) {
      this.totalsLegend_ = goog.dom.createDom('div', 'totals-legend');
      goog.dom.appendChild(element, this.totalsLegend_);
    }
  }
};


/**
 * @private
 * @param {!pn.ui.grid.ColumnCtx} cctx The field context to convert to a slick
 *    grid column config.
 * @return {pn.ui.grid.ColumnSpec} A config object for a slick grid column.
 */
pn.ui.grid.Grid.prototype.getColumnSlickConfig_ = function(cctx) {
  var cfg = cctx.spec.toSlick();
  var renderer = cctx.getColumnRenderer();
  if (renderer) {
    cfg['formatter'] = function(row, cell, value, col, item) {
      return renderer(cctx, item);
    };
  }
  return cfg;
};


/**
 * @private
 * @param {!Array.<!pn.ui.grid.ColumnCtx>} cctxs The unsorted columns.
 * @return {!Array.<!pn.ui.grid.ColumnCtx>} The sorted columns with saved
 *    widths.
 */
pn.ui.grid.Grid.prototype.getColumnsWithInitialState_ = function(cctxs) {
  var state = pn.storage.get(this.hash_);
  if (!state) return cctxs;

  var data = goog.json.unsafeParse(state);
  var ids = data['ids'];
  var widths = data['widths'];
  var ordered = [];
  goog.array.forEach(ids, function(id, idx) {
    var cidx = goog.array.findIndex(cctxs,
        function(cctx1) { return cctx1.id === id; });
    var cctx = cctxs[cidx];
    delete cctxs[cidx];
    cctx.spec.width = widths[idx];
    ordered.push(cctx);
  });

  // Add remaining columns (if any)
  goog.array.forEach(cctxs, ordered.push);
  return ordered;
};


/**
 * @return {Array.<Array.<string>>} The data of the grid. This is used when
 *    exporting the grid contents.
 */
pn.ui.grid.Grid.prototype.getGridData = function() {
  var headers = goog.array.map(this.cctxs_,
      function(cctx1) { return cctx1.spec.name; });
  var gridData = [headers];
  var lencol = this.cctxs_.length;
  for (var row = 0, len = this.dataView_.getLength(); row < len; row++) {
    var rowData = this.dataView_.getItem(row);
    var rowTxt = [];

    for (var cidx = 0; cidx < lencol; cidx++) {
      var cctx = this.cctxs_[cidx];
      var val = rowData[cctx.spec.dataProperty];
      var renderer = cctx.getColumnRenderer();
      var txt = renderer ? renderer(cctx, rowData) : val;
      rowTxt.push(txt);
    }
    gridData.push(rowTxt);
  }
  return gridData;
};


/** @override */
pn.ui.grid.Grid.prototype.enterDocument = function() {
  pn.ui.grid.Grid.superClass_.enterDocument.call(this);
  if (!this.slick_) return; // No data

  var hasOrderColumn = !this.cfg_.readonly && goog.array.findIndex(this.cctxs_,
      function(cctx) {
        return cctx.spec instanceof pn.ui.grid.OrderingColumnSpec;
      }) >= 0;
  var rowSelectionModel = new Slick.RowSelectionModel();
  // Selecting
  if (!this.cfg_.readonly) {
    if (this.cfg_.allowEdit) {
      this.slick_.setSelectionModel(rowSelectionModel);
      this.selectionHandler_ = goog.bind(this.handleSelection_, this);
      this.slick_.onSelectedRowsChanged.subscribe(this.selectionHandler_);
    }
    goog.array.forEach(this.commands_, function(c) {
      this.getHandler().listen(c, c.eventType, function(e) {
        e.target = this;
        this.publishEvent_(e);
      });
    }, this);
  }
  if (!hasOrderColumn) {
    // Sorting
    this.slick_.onSort.subscribe(goog.bind(function(e, args) {
      var col = args['sortCol']['id'];
      var asc = args['sortAsc'];
      this.sortState_ = { 'colid': col, 'asc': asc };
      this.sort_(col, asc);
      this.saveGridState_();
    }, this));
  }

  this.dataView_.onRowsChanged.subscribe(goog.bind(function(e, args) {
    this.slick_.invalidateRows(args.rows);
    this.slick_.render();
  }, this));

  // Filtering
  this.dataView_.onRowCountChanged.subscribe(goog.bind(function() {
    this.slick_.updateRowCount();
    this.slick_.render();
    this.updateTotals_();
    goog.style.showElement(this.noData_, this.dataView_.getLength() === 0);
  }, this));


  // Initialise
  this.dataView_.beginUpdate();
  this.dataView_.setItems(this.list_, 'ID');
  this.dataView_.setFilter(goog.bind(this.filterImpl_, this));
  this.dataView_.endUpdate();

  // Quick Filters
  if (this.cfg_.enableQuickFilters) {
    this.quickFind_ = new pn.ui.grid.QuickFind(
        this.cache_, this.cctxs_, this.slick_);
    this.registerDisposable(this.quickFind_);
    this.quickFind_.init();
    if (this.cfg_.persistFilters) {
      var state = pn.storage.get(this.hash_);
      if (state) {
        var data = goog.json.unsafeParse(state);
        this.quickFind_.setFilterStates(data['filters']);
        var filtered = pn.ui.grid.QuickFind.EventType.FILTERED;
        this.getHandler().listen(this.quickFind_, filtered,
            goog.bind(this.saveGridState_, this));
      }
    }
  }

  if (hasOrderColumn) {
    this.rowOrdering_ = new pn.ui.grid.RowOrdering(this.slick_);
    this.registerDisposable(this.rowOrdering_);
    this.rowOrdering_.init();
    this.getHandler().listen(this.rowOrdering_, pn.app.AppEvents.LIST_ORDERED,
        goog.bind(this.publishEvent_, this));
  }

  var rfr = goog.bind(function() {
    if (this.quickFind_) { this.quickFind_.resize(); }
    this.saveGridState_();
  }, this);
  this.slick_.onColumnsReordered.subscribe(rfr);
  this.slick_.onColumnsResized.subscribe(rfr);

  this.setGridInitialSortState_();
};


/** @private */
pn.ui.grid.Grid.prototype.setGridInitialSortState_ = function() {
  var orderColumn = goog.array.find(this.cctxs_, function(cctx) {
    return cctx.spec instanceof pn.ui.grid.OrderingColumnSpec;
  });
  var state = pn.storage.get(this.hash_);
  if (!orderColumn && !state) return;
  var data = orderColumn ? {
    'sort': {
      'colid': orderColumn.spec.dataProperty,
      'asc': true
    }
  } : goog.json.unsafeParse(state);
  var col = null,
      asc = true;
  if (data['sort']) {
    col = data['sort']['colid'];
    asc = data['sort']['asc'];
  } else if (this.cfg_.defaultSortColumn) {
    col = this.cfg_.defaultSortColumn;
    asc = this.cfg_.defaultSortAscending;
  }
  if (col) {
    if (!orderColumn) this.slick_.setSortColumn(col, asc);
    this.sort_(col, asc);
  }
};


/**
 * @private
 * @param {string} col The column being sorted.
 * @param {boolean} asc Wether to sort ascending.
 */
pn.ui.grid.Grid.prototype.sort_ = function(col, asc) {
  var cctx = goog.array.find(this.cctxs_, function(cctx1) {
    return cctx1.id === col;
  });
  this.dataView_.sort(function(a, b) {
    var x = cctx.getCompareableValue(a);
    var y = cctx.getCompareableValue(b);
    return (x === y ? 0 : (x > y ? 1 : -1));
  }, asc);
};


/** @private */
pn.ui.grid.Grid.prototype.updateTotals_ = function() {
  if (!this.totalColumns_.length) return;

  var items = this.dataView_.getItems();
  var total = goog.array.reduce(items, function(acc, item) {
    goog.array.forEach(this.totalColumns_, function(cctx1) {
      if (acc[cctx1.id] === undefined) acc[cctx1.id] = 0;
      var itemVal = item[cctx1.id];
      if (itemVal) acc[cctx1.id] += itemVal;
    }, this);
    return acc;
  }, {}, this);
  var html = [];
  for (var field in total) {
    var cctx = goog.array.find(this.totalColumns_,
        function(cctx1) { return cctx1.id === field; });
    var val;
    var mockEntity = {};
    mockEntity[field] = total[field];
    var renderer = cctx.getColumnRenderer();
    if (renderer) { val = renderer(cctx, mockEntity); }
    else { val = parseInt(total[field], 10); }
    html.push('Total ' + cctx.spec.name + ': ' + val || '0');
  }
  this.totalsLegend_.innerHTML = '<ul><li>' +
      html.join('</li><li>') + '</li>';
};


/** @private */
pn.ui.grid.Grid.prototype.saveGridState_ = function() {
  var columns = this.slick_.getColumns();
  var data = {
    'ids': goog.array.map(columns, function(c) { return c['id']; }),
    'widths': goog.array.map(columns, function(c) { return c['width']; }),
    'sort': this.sortState_
  };
  if (this.cfg_.persistFilters && this.quickFind_) {
    data['filters'] = this.quickFind_.getFilterStates();
  }
  pn.storage.set(this.hash_, pn.json.serialiseJson(data));
};


/**
 * @private
 * @param {Event} ev The selection event from the SlickGrid.
 * @param {Object} evData The data for the selection event.
 */
pn.ui.grid.Grid.prototype.handleSelection_ = function(ev, evData) {
  // Ignore if triggered by cell re-ordering.
  if (window.event.target.className.indexOf('cell-reorder') >= 0 ||
      (this.rowOrdering_ && this.rowOrdering_.isOrdering())) return;

  var idx = evData['rows'][0];
  var selected = this.dataView_.getItem(idx);
  var e = new goog.events.Event(pn.app.AppEvents.ENTITY_SELECT, this);
  e.selected = selected;
  this.publishEvent_(e);
};


/**
 * @private
 * @param {!goog.events.Event} e The event to publish using the pn.app.ctx.pub
 *    mechanism.
 */
pn.ui.grid.Grid.prototype.publishEvent_ = function(e) {
  if (!this.cfg_.publishEventBusEvents) {
    this.dispatchEvent(e);
    return;
  }
  var ae = pn.app.AppEvents;
  switch (e.type) {
    case ae.ENTITY_SELECT:
      var id = e.selected['ID'];
      pn.app.ctx.pub(e.type, this.spec_.type, id);
      break;
    case ae.ENTITY_ADD:
      pn.app.ctx.pub(e.type, this.spec_.type);
      break;
    case ae.LIST_EXPORT:
      var data = e.target.getGridData();
      var format = e.exportFormat;
      pn.app.ctx.pub(e.type, this.spec_.type, format, data);
      break;
    case ae.LIST_ORDERED:
      pn.app.ctx.pub(e.type, this.spec_.type, e.ids);
      break;
    default: throw new Error('Event: ' + e.type + ' is not supported');
  }
};


/** @override */
pn.ui.grid.Grid.prototype.disposeInternal = function() {
  pn.ui.grid.Grid.superClass_.disposeInternal.call(this);

  if (this.slick_) { this.slick_.destroy(); }
};
