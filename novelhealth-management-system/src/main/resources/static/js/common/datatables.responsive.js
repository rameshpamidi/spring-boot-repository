/**
 * File:        datatables.responsive.js
 * Version:     0.1.3
 * Author:      Seen Sai Yang
 * Info:        https://github.com/Comanche/datatables-responsive
 *
 * Copyright 2013 Seen Sai Yang, all rights reserved.
 *
 * This source file is free software, under either the GPL v2 license or a
 * BSD style license.
 *
 * This source file is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE. See the license files for details.
 *
 * You should have received a copy of the GNU General Public License and the
 * BSD license along with this program.  These licenses are also available at:
 *     https://raw.github.com/Comanche/datatables-responsive/master/license-gpl2.txt
 *     https://raw.github.com/Comanche/datatables-responsive/master/license-bsd.txt
 */

'use strict';

/**
 * Constructor for responsive datables helper.
 *
 * This helper class makes datatables responsive to the window size.
 *
 * The parameter, breakpoints, is an object for each breakpoint key/value pair
 * with the following format: { breakpoint_name: pixel_width_at_breakpoint }.
 *
 * An example is as follows:
 *
 *     {
 *         tablet: 1024,
 *         phone: 480
 *     }
 *
 * These breakpoint name may be used as possible values for the data-hide
 * attribute.  The data-hide attribute is optional and may be defined for each
 * th element in the table header.
 *
 * The parameter, options, is an object of options supported by the responsive
 * helper.  The following options are supported:
 *
 *     {
 *          hideEmptyColumnsInRowDetail - Boolean, default: false.
 *     }
 *
 * @param {Object|string} tableSelector jQuery wrapped set or selector for
 *                                      datatables container element.
 * @param {Object} breakpoints          Object defining the responsive
 *                                      breakpoint for datatables.
 * @param {Object} options              Object of options.
 */
function ResponsiveDatatablesHelper(tableSelector, breakpoints, options) {
    if (typeof tableSelector === 'string') {
        this.tableElement = jQuery(tableSelector);
    } else {
        this.tableElement = tableSelector;
    }

    // State of column indexes and which are shown or hidden.
    this.columnIndexes = [];
    this.columnsShownIndexes = [];
    this.columnsHiddenIndexes = [];

    // Index of the th in the header tr that stores where the attribute
    //     data-class="expand"
    // is defined.
    this.expandColumn = undefined;

    // Stores the break points defined in the table header.
    // Each th in the header tr may contain an optional attribute like
    //     data-hide="phone,tablet"
    // These attributes and the breakpoints object will be used to create this
    // object.
    this.breakpoints = {
        /**
         * We will be generating data in the following format:
         *     phone : {
         *         lowerLimit   : undefined,
         *         upperLimit   : 320,
         *         columnsToHide: []
         *     },
         *     tablet: {
         *         lowerLimit   : 320,
         *         upperLimit   : 724,
         *         columnsToHide: []
         *     }
         */
    };

    // Store default options
    this.options = {
        hideEmptyColumnsInRowDetail: false
    };

    // Expand icon template
    this.expandIconTemplate = '<span class="responsiveExpander"></span>';

    // Row template
    this.rowTemplate = '<tr class="row-detail"><td><ul><!--column item--></ul></td></tr>';
    this.rowLiTemplate = '<li><span class="columnTitle"><!--column title--></span>: <span class="columnValue"><!--column value--></span></li>';

    // Responsive behavior on/off flag
    this.disabled = true;

    // Skip next windows width change flag
    this.skipNextWindowsWidthChange = false;

    // Initialize settings
    this.init(breakpoints, options);
}

/**
 * Responsive datatables helper init function.
 * Builds breakpoint limits for columns and begins to listen to window resize
 * event.
 *
 * See constructor for the breakpoints parameter.
 *
 * @param {Object} breakpoints
 * @param {Object} options
 */
ResponsiveDatatablesHelper.prototype.init = function (breakpoints, options) {
    // Add the 'always' breakpoint
    breakpoints['always'] = Infinity;

    /** Generate breakpoints in the format we need. ***************************/
    // First, we need to create a sorted array of the breakpoints given.
    var breakpointsSorted = [];
    _.each(breakpoints, function (value, key) {
        breakpointsSorted.push({
            name         : key,
            upperLimit   : value,
            columnsToHide: []
        });
    });
    breakpointsSorted = _.sortBy(breakpointsSorted, 'upperLimit');

    // Set lower and upper limits for each breakpoint.
    var lowerLimit = undefined;
    _.each(breakpointsSorted, function (value) {
        value.lowerLimit = lowerLimit;
        lowerLimit = value.upperLimit;
    });

    // Add the default breakpoint which shows all (has no upper limit).
    breakpointsSorted.push({
        name         : 'default',
        lowerLimit   : lowerLimit,
        upperLimit   : undefined,
        columnsToHide: []
    });

    // Copy the sorted breakpoint array into the breakpoints object using the
    // name as the key.
    for (var i = 0, l = breakpointsSorted.length; i < l; i++) {
        this.breakpoints[breakpointsSorted[i].name] = breakpointsSorted[i];
    }

    /** Create range of possible column indexes *******************************/
    // Get all visible column indexes
    var columns = this.tableElement.fnSettings().aoColumns;
    for (var i = 0, l = columns.length; i < l; i++) {
        if (columns[i].bVisible) {
            this.columnIndexes.push(i)
        }
    }

    // We need the range of possible column indexes to calculate the columns
    // to show:
    //     Columns to show = all columns - columns to hide
    var headerColumns = this.tableElement.fnSettings().aoColumns;
    // Filter for only visible columns.
    headerColumns = _.filter(headerColumns, function (col) {
        return col.bVisible;
    });

    /** Add columns into breakpoints respectively *****************************/
    // Read column headers' attributes and get needed info
    _.each(headerColumns, function (col, index) {
        // Get the column with the attribute data-class="expand" so we know
        // where to display the expand icon.
        if (jQuery(col.nTh).attr('data-class') === 'expand') {
            this.expandColumn = this.columnIndexes[index];
        }

        // The data-hide attribute has the breakpoints that this column
        // is associated with.
        // If it's defined, get the data-hide attribute and sort this
        // column into the appropriate breakpoint's columnsToHide array.
        var dataHide = jQuery(col.nTh).attr('data-hide');
        if (dataHide !== undefined) {
            var splitBreakingPoints = dataHide.split(/,\s*/);
            _.each(splitBreakingPoints, function (e) {
                if (this.breakpoints[e] !== undefined) {
                    // Translate visible column index to internal column index.
                    this.breakpoints[e].columnsToHide.push(this.columnIndexes[index]);
                }
            }, this);
        }
    }, this);

    // Enable responsive behavior.
    this.disable(false);

    // Extend options
    _.extend(this.options, options);
};

/**
 * Sets or removes window resize handler.
 *
 * @param {Boolean} bindFlag
 */
ResponsiveDatatablesHelper.prototype.setWindowsResizeHandler = function(bindFlag) {
    if (bindFlag === undefined) {
        bindFlag = true;
    }

    if (bindFlag) {
        var that = this;
        jQuery(window).bind("resize", function () {
            that.respond();
        });
    } else {
        jQuery(window).unbind("resize");
    }
}

/**
 * Respond window size change.  This helps make datatables responsive.
 */
ResponsiveDatatablesHelper.prototype.respond = function () {
    if (this.disabled) {
        return;
    }
    var that = this;

    // Get new windows width
    var newWindowWidth = jQuery(window).width();
    var updatedHiddenColumnsCount = 0;

    // Loop through breakpoints to see which columns need to be shown/hidden.
    var newColumnsToHide = [];
    _.each(this.breakpoints, function (element) {
        if ((!element.lowerLimit || newWindowWidth > element.lowerLimit) && (!element.upperLimit || newWindowWidth <= element.upperLimit)) {
            newColumnsToHide = element.columnsToHide;
        }
    }, this);

    // Find out if a column show/hide should happen.
    // Skip column show/hide if this window width change follows immediately
    // after a previous column show/hide.  This will help prevent a loop.
    var columnShowHide = false;
    if (!this.skipNextWindowsWidthChange) {
        // Check difference in length
        if (this.columnsHiddenIndexes.length !== newColumnsToHide.length) {
            // Difference in length
            columnShowHide = true;
        } else {
            // Same length but check difference in values
            var d1 = _.difference(this.columnsHiddenIndexes, newColumnsToHide).length;
            var d2 = _.difference(newColumnsToHide, this.columnsHiddenIndexes).length;
            columnShowHide = d1 + d2 > 0;
        }
    }

    if (columnShowHide) {
        // Showing/hiding a column at breakpoint may cause a windows width
        // change.  Let's flag to skip the column show/hide that may be
        // caused by the next windows width change.
        this.skipNextWindowsWidthChange = true;
        this.columnsHiddenIndexes = newColumnsToHide;
        this.columnsShownIndexes = _.difference(this.columnIndexes, this.columnsHiddenIndexes);
        this.showHideColumns();
        updatedHiddenColumnsCount = this.columnsHiddenIndexes.length;
        this.skipNextWindowsWidthChange = false;
    }


    // We don't skip this part.
    // If one or more columns have been hidden, add the has-columns-hidden class to table.
    // This class will show what state the table is in.
    if (this.columnsHiddenIndexes.length) {
        this.tableElement.addClass('has-columns-hidden');

        // Show details for each row that is tagged with the class .detail-show.
        jQuery('tr.detail-show', this.tableElement).each(function (index, element) {
            var tr = jQuery(element);
            if (tr.next('.row-detail').length === 0) {
                ResponsiveDatatablesHelper.prototype.showRowDetail(that, tr);
            }
        });
    } else {
        this.tableElement.removeClass('has-columns-hidden');
        jQuery('tr.row-detail').each(function (event) {
            ResponsiveDatatablesHelper.prototype.hideRowDetail(that, jQuery(this).prev());
        });
    }
};

/**
 * Show/hide datatables columns.
 */
ResponsiveDatatablesHelper.prototype.showHideColumns = function () {
    // Calculate the columns to show
    // Show columns that may have been previously hidden.
    for (var i = 0, l = this.columnsShownIndexes.length; i < l; i++) {
        this.tableElement.fnSetColumnVis(this.columnsShownIndexes[i], true, false);
    }

    // Hide columns that may have been previously shown.
    for (var i = 0, l = this.columnsHiddenIndexes.length; i < l; i++) {
        this.tableElement.fnSetColumnVis(this.columnsHiddenIndexes[i], false, false);
    }

    // Rebuild details to reflect shown/hidden column changes.
    var that = this;
    jQuery('tr.row-detail').each(function () {
        ResponsiveDatatablesHelper.prototype.hideRowDetail(that, jQuery(this).prev());
    });
    if (this.tableElement.hasClass('has-columns-hidden')) {
        jQuery('tr.detail-show', this.tableElement).each(function (index, element) {
            ResponsiveDatatablesHelper.prototype.showRowDetail(that, jQuery(element));
        });
    }
};

/**
 * Create the expand icon on the column with the data-class="expand" attribute
 * defined for it's header.
 *
 * @param {Object} tr table row object
 */
ResponsiveDatatablesHelper.prototype.createExpandIcon = function (tr) {
    if (this.disabled) {
        return;
    }

    // Get the td for tr with the same index as the th in the header tr
    // that has the data-class="expand" attribute defined.
    var tds = jQuery('td', tr);
    var that = this;
    // Loop through tds and create an expand icon on the td that has a column
    // index equal to the expand column given.
    for (var i = 0, l = tds.length; i < l; i++) {
        var td = tds[i];
        var tdIndex = that.tableElement.fnGetPosition(td)[2];
        td = jQuery(td);
        if (tdIndex === that.expandColumn) {
            // Create expand icon if there isn't one already.
            if (jQuery('span.responsiveExpander', td).length == 0) {
                td.prepend(that.expandIconTemplate);

                // Respond to click event on expander icon.
                td.on('click', 'span.responsiveExpander', {responsiveDatatablesHelperInstance: that}, that.showRowDetailEventHandler);
            }
            break;
        }
    }
};

/**
 * Show row detail event handler.
 *
 * This handler is used to handle the click event of the expand icon defined in
 * the table row data element.
 *
 * @param {Object} event jQuery event object
 */
ResponsiveDatatablesHelper.prototype.showRowDetailEventHandler = function (event) {
    if (this.disabled) {
        return;
    }

    // Get the parent tr of which this td belongs to.
    var tr = jQuery(this).closest('tr');

    // Show/hide row details
    if (tr.hasClass('detail-show')) {
        ResponsiveDatatablesHelper.prototype.hideRowDetail(event.data.responsiveDatatablesHelperInstance, tr);
    } else {
        ResponsiveDatatablesHelper.prototype.showRowDetail(event.data.responsiveDatatablesHelperInstance, tr);
    }

    tr.toggleClass('detail-show');

    // Prevent click event from bubbling up to higher-level DOM elements.
    event.stopPropagation();
};

/**
 * Show row details.
 *
 * @param {ResponsiveDatatablesHelper} responsiveDatatablesHelperInstance instance of ResponsiveDatatablesHelper
 * @param {Object}                     tr                                 jQuery wrapped set
 */
ResponsiveDatatablesHelper.prototype.showRowDetail = function (responsiveDatatablesHelperInstance, tr) {
    // Get column because we need their titles.
    var tableContainer = responsiveDatatablesHelperInstance.tableElement;
    var columns = tableContainer.fnSettings().aoColumns;

    // Create the new tr.
    var newTr = jQuery(responsiveDatatablesHelperInstance.rowTemplate);

    // Get the ul that we'll insert li's into.
    var ul = jQuery('ul', newTr);

    // Loop through hidden columns and create an li for each of them.
    _.each(responsiveDatatablesHelperInstance.columnsHiddenIndexes, function (index) {
        // Get row td
        var rowIndex = tableContainer.fnGetPosition(tr[0]);
        var td = tableContainer.fnGetTds(rowIndex)[index];

        // Don't create li if contents are empty (depends on hideEmptyColumnsInRowDetail option).
        if (!responsiveDatatablesHelperInstance.options.hideEmptyColumnsInRowDetail || td.innerHTML.trim().length) {
            var li = jQuery(responsiveDatatablesHelperInstance.rowLiTemplate);
            jQuery('.columnTitle', li).html(columns[index].sTitle);
            var rowHtml = jQuery(td).contents().clone();
            jQuery('.columnValue', li).html(rowHtml);

            // Copy index to data attribute, so we'll know where to put the value when the tr.row-detail is removed.
            li.attr('data-column', index);

            // Copy td class to new li.
            var tdClass = jQuery(td).attr('class');
            if (tdClass !== 'undefined' && tdClass !== false && tdClass !== '') {
                      li.addClass(tdClass)
            }

            ul.append(li);
        }
    });

    // Create tr colspan attribute.
    var colspan = responsiveDatatablesHelperInstance.columnIndexes.length - responsiveDatatablesHelperInstance.columnsHiddenIndexes.length;
    newTr.find('> td').attr('colspan', colspan);

    // Append the new tr after the current tr.
    tr.after(newTr);
};

/**
 * Hide row details.
 *
 * @param {ResponsiveDatatablesHelper} responsiveDatatablesHelperInstance instance of ResponsiveDatatablesHelper
 * @param {Object}                     tr                                 jQuery wrapped set
 */
ResponsiveDatatablesHelper.prototype.hideRowDetail = function (responsiveDatatablesHelperInstance, tr) {

    // If the value of an input has changed, we need to copy its state back to the DataTables object
    // so that value will persist when the tr.row-detail is removed.
    tr.next('.row-detail').find('li').each(function () {
        var tableContainer = responsiveDatatablesHelperInstance.tableElement;
        var aoData = tableContainer.fnSettings().aoData;
        var rowIndex = tableContainer.fnGetPosition(tr[0]);
        var column = jQuery(this).attr('data-column');
        var td = jQuery(this).find('span.columnValue').contents();
        aoData[rowIndex]._anHidden[column] = jQuery(aoData[rowIndex]._anHidden[column]).empty().append(td)[0];
    });
    tr.next('.row-detail').remove();
};

/**
 * Enable/disable responsive behavior and restores changes made.
 *
 * @param {Boolean} disable, default is true
 */
ResponsiveDatatablesHelper.prototype.disable = function (disable) {
    this.disabled = (disable === undefined) || disable;

    if (this.disabled) {
        // Remove windows resize handler.
        this.setWindowsResizeHandler(false);

        // Remove all trs that have row details.
        jQuery('tbody tr.row-detail', this.tableElement).remove();

        // Remove all trs that are marked to have row details shown.
        jQuery('tbody tr', this.tableElement).removeClass('detail-show');

        // Remove all expander icons.
        jQuery('tbody tr span.responsiveExpander', this.tableElement).remove();

        this.columnsHiddenIndexes = [];
        this.columnsShownIndexes = this.columnIndexes;
        this.showHideColumns();
        this.tableElement.removeClass('has-columns-hidden');

        this.tableElement.off('click', 'span.responsiveExpander', this.showRowDetailEventHandler);
    } else {
        // Add windows resize handler.
        this.setWindowsResizeHandler();
    }
}

/**
 * Get an array of TD nodes from DataTables for a given row, including any column elements which are hidden.
 *
 * Author: Allan Jardine
 * http://datatables.net/plug-ins/api
 *
 * @param {Object} oSettings DataTables settings object
 * @param {node}   mTr       TR node or aoData index
 */
jQuery.fn.dataTableExt.oApi.fnGetTds = function (oSettings, mTr)
{
    var anTds = [];
    var anVisibleTds = [];
    var iCorrector = 0;
    var nTd, iColumn, iColumns;

    /* Take either a TR node or aoData index as the mTr property */
    var iRow = (typeof mTr == 'object') ?
        oSettings.oApi._fnNodeToDataIndex(oSettings, mTr) : mTr;
    var nTr = oSettings.aoData[iRow].nTr;

    /* Get an array of the visible TD elements */
    for (iColumn=0, iColumns=nTr.childNodes.length; iColumn<iColumns ; iColumn++) {
        nTd = nTr.childNodes[iColumn];
        if (nTd.nodeName.toUpperCase() == "TD") {
            anVisibleTds.push( nTd );
        }
    }

    /* Construct and array of the combined elements */
    for (iColumn=0, iColumns=oSettings.aoColumns.length; iColumn<iColumns ; iColumn++) {
        if (oSettings.aoColumns[iColumn].bVisible) {
            anTds.push( anVisibleTds[iColumn-iCorrector] );
        }
        else {
            anTds.push( oSettings.aoData[iRow]._anHidden[iColumn] );
            iCorrector++;
        }
    }

    return anTds;
};