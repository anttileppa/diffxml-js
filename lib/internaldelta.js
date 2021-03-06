/*
 * DiffXmlJs - JavaScript library for comparing XML files.
 * 
 * Licensed under GNU Lesser General Public License Version 3 or later (the "LGPL")
 * http://www.gnu.org/licenses/lgpl.html
 *
 * Antti Leppä / Foyt
 * antti.leppa@foyt.fi
 */

/**
 * @class Default delta.
 * @extends Delta
 */
InternalDelta = DiffXmlUtils.createClass(Delta, {
  /**
   * Constructor
   * @constructs
   */
  init: function (operations) {
    this._changes = operations||new Array();
  },
  proto : /** @lends InternalDelta.prototype */ {
    
    /**
     * Returns changes array
     * 
     * @returns changes array
     */
    getChanges: function () {
      return this._changes;
    },

    /**
     * Returns move operations as array
     * 
     * @returns move operations as array
     */
    getMoved: function () {
      return this._getChangesByType("move");
    },
    
    /**
     * Returns delete operations as array
     * 
     * @returns delete operations as array
     */
    getDeleted: function () {
      return this._getChangesByType("delete");
    },
    
    /**
     * Returns insert operations as array
     * 
     * @returns insert operations as array
     */
    getInserted: function () {
      return this._getChangesByType("insert");
    },
    
    /**
     * Returns update operations as array
     * 
     * @returns update operations as array
     */
    getUpdated: function () {
      return this._getChangesByType("update");
    },

    /**
     * Adds inserts for attributes of a node to an delta.
     * 
     * @param attrs the attributes to be added
     * @param path the path to the node they are to be added to
     */
    addAttrsToDelta: function (attrs, path) {
      var numAttrs;
      if (attrs == null) {
        numAttrs = 0;
      } else {
        numAttrs = attrs.length;
      }

      for (var i = 0; i < numAttrs; i++) {
        this.insert(attrs.item(i), path, 0, 1);
      }
    },
    
    /**
     * Appends an insert operation to the delta.
     * 
     * Set charpos to 1 if not needed.
     * 
     * @param n The node to insert
     * @param parent The path to the node to be parent of n
     * @param childno The child number of the parent node that n will become
     * @param charpos The character position to insert at
     */
    insert: function (n, parent, childno, charpos) {
      var inserted = {
        type: 'insert',
        parent: parent,
        nodeType: n.nodeType,
        value: n.nodeValue
      };
      
      if (n.nodeType != Node.ATTRIBUTE_NODE) {
        inserted['childNo'] = childno;
      } 
      
      if (n.nodeType == Node.ATTRIBUTE_NODE || n.nodeType == Node.ELEMENT_NODE || n.nodeType == Node.PROCESSING_INSTRUCTION_NODE) {
        inserted['nodeName'] = n.nodeName;
      }
      
      if (charpos > 1) {
        inserted['charpos'] = charpos;
      }
      
      this._changes.push(inserted);
      
      if (n.nodeType == Node.ELEMENT_NODE) {
        this.addAttrsToDelta(n.attributes, parent + "/node()[" + childno + "]");
      }
    },
    
    /**
     * Adds a delete operation to the delta for the given Node.
     * 
     * @param n The Node that is to be deleted
     */
    deleteNode: function(n) {
      var deleted = {
        type: 'delete',
        node: NodeOps.getXPath(n)
      };
      
      if (n.nodeType == Node.TEXT_NODE) {
        var cn = new ChildNumber(n);
        var charpos = cn.getXPathCharPos();
        
        if (charpos >= 1) {
          deleted['charpos'] = charpos;
          deleted['length'] = n.length;
        }
      }

      this._changes.push(deleted);
    },

    /**
     * Adds a Move operation to the delta. 
     * 
     * @param n The node being moved
     * @param parent XPath to the new parent Node
     * @param childno Child number of the parent n will become
     * @param ncharpos The new character position for the Node
     */
    move: function (n, parent, childno, ncharpos) {
      if (ncharpos < 1) {
        throw new Error("New Character position must be >= 1");
      }

      var moved = {
        type: 'move',
        node: NodeOps.getXPath(n),
        ocharpos: new ChildNumber(n).getXPathCharPos(),
        ncharpos: ncharpos,
        parent: parent,
        childNo: childno
      };
      
      if (n.nodeType == Node.TEXT_NODE) {
        moved['length'] = n.length;
      }
      
      this._changes.push(moved);
    },

    /**
     * Adds an update operation to the delta.
     * 
     * @param w The node to update
     * @param x The node to update it to
     */
    update: function (w, x) {
      var updated = {
        type: 'update',
        node: NodeOps.getXPath(w)
      };
      
      if (w.nodeType == Node.ELEMENT_NODE) {
        updated['nodeName'] = x.nodeName;
        this._updateAttributes(w, x);
      } else {
        updated['nodeValue'] = x.nodeValue;
      }
      
      this._changes.push(updated);
    },
    
    /**
     * Returns delta in DUL format
     * 
     * @returns delta in DUL format
     */
    toDUL: function () {
      var changes = this.getChanges();
      
      var dulDocument = DiffXmlUtils.parseXmlDocument('<?xml version="1.0" encoding="UTF-8" standalone="no"?><delta/>');
      
      for (var i = 0, l = changes.length; i < l; i++) {
        var change = changes[i];

        switch (change.type) {
          case 'insert':
            this._appendInsertDULNode(dulDocument, change.parent, change.nodeType, change.childNo, change.nodeName, change.charpos, change.value);
          break;
          case 'delete':
            this._appendDeleteDULNode(dulDocument, change.charpos, change.length, change.node);
          break;
          case 'move':
            this._appendMoveDULNode(dulDocument, change.node, change.ocharpos, change.ncharpos, change.parent, change.childNo, change.length);
          break;
          case 'update':
            this._appendUpdateDULNode(dulDocument, change.node, change.nodeName, change.nodeValue);
          break;
          default:
            throw new Error("Invalid operation: " + change.type);
          break;
        }
      }
      
      return DiffXmlUtils.serializeXmlDocument(dulDocument);
    },
    
    _appendInsertDULNode: function (dulDocument, parent, nodeType, childNo, nodeName, charpos, value) {
      var node = dulDocument.createElement(DULConstants.INSERT);

      if (charpos) {
        node.setAttribute(DULConstants.CHARPOS, charpos);
      }
      
      if (childNo) {
        node.setAttribute(DULConstants.CHILDNO, childNo);
      }

      if (nodeName) {
        node.setAttribute(DULConstants.NAME, nodeName);
      }
      
      if (nodeType) {
        node.setAttribute(DULConstants.NODETYPE, nodeType);
      }
      
      if (parent) {
        node.setAttribute(DULConstants.PARENT, parent);
      }

      if (value) {
        node.appendChild(dulDocument.createTextNode(value));
      }
      
      dulDocument.documentElement.appendChild(node);
    },
    
    _appendDeleteDULNode: function (dulDocument, charpos, length, nodeAttr) {
      var node = dulDocument.createElement(DULConstants.DELETE);
      
      if (charpos) {
        node.setAttribute(DULConstants.CHARPOS, charpos);
      }

      if (length) {
        node.setAttribute(DULConstants.LENGTH, length);
      }
      
      if (nodeAttr) {
        node.setAttribute(DULConstants.NODE, nodeAttr);
      }
      
      dulDocument.documentElement.appendChild(node);
    },
    
    _appendMoveDULNode: function (dulDocument, node, ocharpos, ncharpos, parent, childNo, length) {
      var node = dulDocument.createElement(DULConstants.MOVE);
      
      if (node) {
        node.setAttribute(DULConstants.NODE, node);
      }

      if (ocharpos) {
        node.setAttribute(DULConstants.OLD_CHARPOS, ocharpos);
      }
      
      if (ncharpos) {
        node.setAttribute(DULConstants.NEW_CHARPOS, ncharpos);
      }
      
      if (parent) {
        node.setAttribute(DULConstants.PARENT, parent);
      }
      
      if (childNo) {
        node.setAttribute(DULConstants.CHILDNO, childNo);
      }

      if (length) {
        node.setAttribute(DULConstants.LENGTH, length);
      }
      
      dulDocument.documentElement.appendChild(node);
    },
    
    _appendUpdateDULNode: function (dulDocument, node, nodeName, nodeValue) {
      var node = dulDocument.createElement(DULConstants.DELETE);
      
      if (node) {
        node.setAttribute(DULConstants.NODE, node);
      }
      
      if (nodeName) {
        node.appendChild(dulDocument.createTextNode(nodeName));
      } else if (nodeValue) {
        node.appendChild(dulDocument.createTextNode(nodeValue));
      }
      
      dulDocument.documentElement.appendChild(node);
    },
    
    /**
     * Updates the attributes of element w to be the same as x's.
     * 
     * @param w The Element to update the attributes of
     * @param x The element holding the correct attributes
     */
    _updateAttributes: function (w, x) {
      var wAttrs = w.attributes;
      var xAttrs = x.attributes;
      
      //Delete any attrs of w not in x, update others
      for (var i = 0; i < wAttrs.length; i++) {
        var wAttr = wAttrs.item(i);
        var xAttr = xAttrs[wAttr.name];
        if (xAttr == null) {
          this.deleteNode(wAttrs.item(i));
        } else if (wAttr.nodeValue != xAttr.nodeValue) {
          this.update(wAttr, xAttr);
        }
      }
        
      //Add any attrs in x but not w
      for (var j = 0; j < xAttrs.length; j++) {
        var xAttr = xAttrs.item(j);
        if (wAttrs[xAttr.name] == null) {
          this.insert(xAttr, NodeOps.getXPath(w), 0, 1);
        }
      }
    },
    
    _getChangesByType: function (type) {
      var result = new Array();
      for (var i = 0, l = this._changes.length; i < l; i++) {
        if (this._changes[i].type == type) {
          result.push(this._changes[i]);
        }
      }
      return result;
    }
  }
});