"use strict";

//TODO limit to inventory?
//TODO maybe ambiguous items should be a warning error rather than first-found...
//TODO "jump"
//TODO "put ___ in/on ____"

function Adventure() {

  var A = this;

  A.maxNesting = 256;

  // Object.values polyfill
  var objectValues = Object.values || function(o) {
    return Object.keys(o).map(function(k) {
      return o[k];
    });
  };

  // string manipulation functions    
  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  A.capitalize = capitalize;

  function titleCase(str) {
    return str.toLowerCase().split(" ").map(capitalize).join(" ");
  }
  A.titleCase = titleCase;

  function series(strs, conjunction) {
    conjunction = conjunction || 'and';
    if (strs.length < 3) return strs.join(' ' + conjunction + ' ');
    return strs.slice(0, -1).join(', ') + ', ' + conjunction + ' ' + strs[strs.length - 1];
  }
  A.series = series;

  function MutabilityMarker(mutable, object) {
    this.mutable = mutable;
    this.object = object;
  }

  function mutable(obj, enforceIfWrapped) {
    if (obj instanceof MutabilityMarker) {
      if (!enforceIfWrapped) return obj;
      obj = obj.object;
    }
    return new MutabilityMarker(true, obj);
  }
  A.mutable = mutable;

  function immutable(obj, enforceIfWrapped) {
    if (obj instanceof MutabilityMarker) {
      if (!enforceIfWrapped) return obj;
      obj = obj.object;
    }
    return new MutabilityMarker(false, obj);
  }
  A.immutable = immutable;

  function unwrap(obj) {
    if (obj instanceof MutabilityMarker)
      return obj.object;
    return obj;
  }

  var directions = {
    north: ['n', 'northern', 'northward', 'northwards'],
    south: ['s', 'southern', 'southward', 'southwards'],
    east: ['e', 'eastern', 'eastward', 'eastwards'],
    west: ['w', 'western', 'westward', 'westwards'],
    northeast: ['ne', 'northeastern', 'northeastward', 'northeastwards'],
    southeast: ['se', 'southeastern', 'southeastward', 'southeastwards'],
    northwest: ['nw', 'northwestern', 'northwestward', 'northwestwards'],
    southwest: ['sw', 'southwestern', 'southwestward', 'southeastwards'],
    up: ['u', 'upper', 'upward', 'upwards', 'above', 'high', 'higher', 'highest', 'over', 'top'],
    down: ['d', 'lower', 'downward', 'downwards', 'below', 'lower', 'low', 'lowest', 'under', 'beneath', 'underneath',
      'bottom'
    ]
  };
  var dirs = {};
  Object.keys(directions).forEach(function(k) {
    dirs[k] = k;
    directions[k].forEach(function(v) {
      dirs[v] = k;
    });
  });

  var oppositeDirections = {
    north: 'south',
    east: 'west',
    northeast: 'southwest',
    northwest: 'southeast',
    up: 'down'
  }
  Object.keys(oppositeDirections).forEach(function(dir) {
    oppositeDirections[oppositeDirections[dir]] = dir;
  });

  // KEEP A MAP OF ALL ITEMS IN THE ADVENTURE
  var itemMap = {};

  var getNewId = function(id) {
    var cnt = 0;
    var testId = id;
    while (testId in itemMap) {
      testId = id + '' + cnt;
      cnt++;
    }
    return testId;
  }

  var allItems = function() {
    return objectValues(itemMap);
  }
  A.itemMap = itemMap;
  A.allItems = allItems;

  // serialize adventure
  var serialize = function() {
    var serializedMap = {};
    Object.keys(itemMap).forEach(function(k) {
      serializedMap[k] = itemMap[k].serialize();
    });
    return JSON.stringify(serializedMap);
  };
  A.serialize = serialize;

  // restore to state given by state string.  
  // this CANNOT BE USED to add or remove items form the world. 
  // TODO... somehow deal with that?
  var deserialize = function(state) {
    var serializedMap = JSON.parse(state);
    if (typeof serializedMap !== 'object') throw new Error('invalid state string');
    Object.keys(serializedMap).forEach(function(k) {
      var item = itemMap[k];
      // if bad item, ignore it?  TODO
      if (item) {
        item.deserialize(serializedMap[k]);
      }
    });
  };
  A.deserialize = deserialize;

  function Item(options) {
    var item = this;
    this.adventure = A;
    if (typeof options === 'string') {
      options = {
        id: options
      };
    }
    options = Object.assign({}, options || {});

    var name = unwrap(options.name) || unwrap(options.id) || 'item';
    options.name = immutable(options.name || name);

    if (options.id && unwrap(options.id) in itemMap) throw new Error('cannot reuse id "' + unwrap(options.id) + '"');

    var baseId = unwrap(options.id) || name || 'item';
    var id = getNewId(baseId);
    options.id = immutable(id);

    itemMap[id] = this;

    // prevent a property from being saved/loaded as state or modified
    var immutableProperties = {};

    this.getImmutableProperties = function() {
      return immutableProperties;
    };

    var plural = unwrap(options.plural);

    var pluralName = name;
    if (plural) {
      pluralName = name;
    } else if ((/[^aeiou]y$/i).test(name)) {
      pluralName = name.substring(0, name.length - 1) + 'ies';
    } else if ((/(s|x|z|ch|sh)$/i).test(name)) {
      pluralName = name + 'es';
    } else {
      pluralName = name + 's';
    }

    options.description = immutable(options.description || null);
    options.keywords = immutable(options.keywords || [name.toLowerCase().replace(/[^a-z0-9 ]/g, '')]);
    options.plural = immutable('plural' in options ? options.plural : false);
    options.definiteName = immutable(options.definiteName || ('the ' + name));
    options.indefiniteName = immutable(options.indefiniteName || (plural ? name : ('aeiou'.indexOf(name.charAt(0).toLowerCase()) >=
      0 ? 'an ' :
      'a ') + name));
    options.pluralName = immutable(options.pluralName || pluralName);
    options.it = immutable(options.it || (plural ? 'they' : 'it'));
    options.canBeTaken = immutable('canBeTaken' in options ? options.canBeTaken : true);
    options.location = mutable(options.location || null);
    options.hidden = 'hidden' in options ? mutable(options.hidden) : immutable(false);
    options.unlisted = 'unlisted' in options ? mutable(options.unlisted) : immutable(false);
    options.known = mutable('known' in options ? options.known : false);

    Object.keys(options).forEach(function(prop) {
      var v = options[prop];
      var immutable = false;
      if (v instanceof MutabilityMarker) {
        immutable = !v.mutable;
        v = v.object;
      }
      if (immutable) {
        immutableProperties[prop] = true;
      }
      item[prop] = v;
    });

    var o = {
      configurable: false,
      enumerable: true,
      writable: false
    };
    // make immutable properties immutable
    Object.keys(immutableProperties).forEach(function(prop) {
      if (prop === 'location') return;
      Object.defineProperty(item, prop, o);
    });

    var location = item.location;
    o = {
      configurable: false,
      enumerable: true,
      get: function() {
        var ret = location;
        if (typeof location === 'string') ret = itemMap[location];
        if (!ret) ret = null;
        return ret;
      }
    };
    if (!immutableProperties.location) {
      o.set = function(l) {
        location = l;
      };
    }

    Object.defineProperty(item, 'location', o);

  };

  Item.prototype.getExits = function() {
    var here = this;
    return allItems().filter(function(it) {
      return (it instanceof Exit) && (it.location === here) && (!it.hidden);
    });
  };

  Item.prototype.beTakenBy = function(subject) {
    if (!this.canBeTaken) {
      return "You can't pick up " + this.definiteName + ".";
    }
    if (subject.has(this)) {
      return "You already have " + this.definiteName + ".";
    }
    this.location = subject;
    return "You have picked up " + this.definiteName + ".";
  };

  Item.prototype.beDroppedBy = function(subject) {
    if (!subject.has(this)) {
      return "You don't have " + this.definiteName + ".";
    }
    this.location = subject.location;
    return "You have dropped " + this.definiteName + ".";
  };

  Item.prototype.beExaminedBy = function(subject) {
    var here = this;
    var ret = '';
    if (subject.location === here) {
      ret += titleCase(this.name) + '\n';
    }
    ret += (this.description || capitalize(this.it) + (this.plural ? "'re" : "'s") + ' just ' + this.indefiniteName +
      '.');

    // describe exits
    var exits = this.getExits();
    if (exits.length > 0) {
      var exitTypes = {};
      exits.forEach(function(ex) {
        var type = ex.pluralName;
        if (!(type in exitTypes)) {
          exitTypes[type] = {
            single: ex.indefiniteName,
            multiple: ex.pluralName,
            directions: []
          };
        }
        exitTypes[type].directions.push(ex.direction);
      });
      Object.keys(exitTypes).forEach(function(type) {
        if (subject.location === here) {
          ret += ' There ';
          ret += exitTypes[type].directions.length == 1 ? 'is ' + exitTypes[type].single : 'are ' + exitTypes[
            type].multiple;
        } else {
          ret += ' ' + capitalize(this.it) + ' ' + (this.plural ? ' have ' : ' has ');
          ret += exitTypes[type].directions.length == 1 ? exitTypes[type].single : exitTypes[type].multiple;
        }
        ret += ' leading ';
        ret += series(exitTypes[type].directions);
        ret += '.';
      });
    }

    // describe non-exits
    var items = this.listContents().filter(function(it) {
      return !(it instanceof Exit);
    });
    var itemNames = items.map(function(it) {
      return it.indefiniteName;
    });
    if (items.length > 0) {
      if (subject.location === here) {
        ret += ' ' + capitalize(series(itemNames)) + ((items.length > 1 || items[0].plural) ? ' are' : ' is') +
          ' here.';
      } else {
        ret += ' ' + capitalize(this.it) + ' contain' + (this.plural ? '' : 's') + ' ' + series(itemNames) + '.';
      }
    }
    return ret;
  };

  Item.prototype.listContents = function() {
    var here = this;
    var items = allItems().filter(function(it) {
      return it.location === here && !it.hidden;
    });
    items.forEach(function(i) {
      i.known = true;
    });
    items = items.filter(function(it) {
      return !(it.unlisted)
    });
    return items;
  };

  Item.prototype.ultimatelyContains = function(item) {
    var cnt = 0;
    for (var loc = item.location; loc; loc = loc.location) {
      cnt++;
      if (cnt > A.maxNesting) {
        throw new Error('Location nesting of more than ' + A.maxNesting + ' exceeded!');
      }
      if (loc === this) return true;
    }
    return false;
  };

  Item.prototype.ultimateLocation = function() {
    var cnt = 0;
    for (var loc = this; loc.location; loc = loc.location) {
      cnt++;
      if (cnt > A.maxNesting) {
        throw new Error('Location nesting of more than ' + A.maxNesting + ' exceeded!');
      }
    }
    return loc;
  };
  Item.prototype.canSee = function(item) {
    return !item.hidden && (this.ultimateLocation() === item.ultimateLocation());
  };
  Item.prototype.has = function(item) {
    return !item.hidden && item.location === this; //(this.ultimatelyContains(item));
  };
  Item.prototype.appearsInInventoryOf = function(subject) {
    return subject.has(this);
  };

  Item.prototype.superMethod = function(name) {
    var method = this[name];
    var proto = Object.getPrototypeOf(this);
    while (true) {
      var superMethod = proto[name];
      if (!superMethod) return superMethod;
      if (superMethod !== method) return superMethod.bind(this);
      proto = Object.getPrototypeOf(proto);
      if (!proto) return void(0);
    }
  };

  // copy the state of this item into a string
  var serializationPrefix = 'ITEM!';

  // return a string representing the current state of this item
  Item.prototype.serialize = function() {
    var item = this;
    return JSON.stringify(this, function(k, v) {
      if ((this === item) && (k in this.getImmutableProperties())) return; // don't serialize immutables
      if (v === A) return; // don't serialize the adventure object
      if (k && v && (v.adventure === A)) { // serialize another Item/Place/Person as its id string  
        return serializationPrefix + '#' + v.id;
      }
      if (typeof v === 'string' && v.startsWith(serializationPrefix)) { // if, somehow, a name collision comes in, escape it
        return serializationPrefix + '?' + v;
      }
      return v;
    });
  };

  // restore this item to the state represented by the passed-in string  
  Item.prototype.deserialize = function(state) {
    var stateObject = JSON.parse(state, function(k, v) {
      if ((typeof v === 'string') && (v.startsWith(serializationPrefix))) {
        var c = v.charAt(serializationPrefix.length);
        var s = v.substring(serializationPrefix.length + 1);
        if (c == '#') {
          return itemMap[s];
        } else {
          return s;
        }
      }
      return v;
    });
    var item = this;
    Object.keys(stateObject).forEach(function(k) {
      if (!(k in item.getImmutableProperties())) {
        item[k] = stateObject[k];
      }
    });
  };

  Item.prototype.newBackgroundItem = function(options) {
    options = options || {};
    if (!('unlisted' in options))
      options.unlisted = immutable(true);
    if (!('canBeTaken' in options))
      options.canBeTaken = immutable(false);
    if (!('location' in options))
      options.location = immutable(this);
    return new Item(options);
  };

  A.newItem = function(options) {
    return new Item(options)
  };

  function Place(options) {
    if (typeof options === 'string') {
      options = {
        id: options
      };
    }
    options = Object.assign({}, options || {});
    var name = unwrap(options.name) || unwrap(options.id) || 'place';
    options.name = immutable(options.name || name);
    if (!('canBeTaken' in options)) {
      options.canBeTaken = immutable(false);
    }
    options.location = immutable(options.location);
    Item.call(this, options);
  }
  Place.prototype = Object.create(Item.prototype);
  A.newPlace = function(options) {
    return new Place(options)
  };

  function Person(options) {
    if (typeof options === 'string') {
      options = {
        id: options
      };
    }
    options = Object.assign({}, options || {});
    var name = unwrap(options.name) || unwrap(options.id) || 'person';
    options.name = immutable(options.name || name);
    if (!('indefiniteName' in options)) {
      options.indefiniteName = immutable(options.name);
    }
    if (!('definiteName' in options)) {
      options.definiteName = immutable(options.name);
    }
    if (!('canBeTaken' in options)) {
      options.canBeTaken = immutable(false);
    }
    if (!('it' in options)) {
      options.it = immutable('she');
    }
    Item.call(this, options);

    this.addCommand = function(subjectCommandName, objectCommandName, templates, help) {
      var command = function command(object) {
        if (!this.canSee(object)) {
          return "You can't see " + object.definiteName + " here.";
        }
        if (!(objectCommandName in object)) {
          // okay let's use the first template
          var commandName = templates[0].split(/\s+/)[0].toLowerCase();
          return "You can't " + commandName + " " + object.definiteName + ".";
        }
        var args = Array.from(arguments);
        args[0] = this;
        return object[objectCommandName].apply(object, args);
      };
      command.templates = templates;
      if (help) {
        command.help = help;
      }
      this[subjectCommandName] = command;
    };

    var go = function(exitOrDirection) {
      if (typeof exitOrDirection === 'string') {
        return "You can't go " + exitOrDirection + " from here.";
      }
      return this.use(exitOrDirection);
    }
    go.templates = ['go ?d1', '?d1', 'move ?d1', 'walk ?d1'];
    go.help = 'Go in the specified direction, like North or South.';
    this.go = go;

    var climb = function(dir) {
      if (!dir) {
        dir = 'up';
      }
      return this.go(dir);
    };
    climb.templates = ['climb', 'climb ?d1'];
    this.climb = climb;

    var look = function look() {
      this.location.known = true;
      return this.location.beExaminedBy(this);
    };
    look.templates = ['look', 'l'];
    look.help = 'Look around you.';
    this.look = look;

    this.addCommand('take', 'beTakenBy', ['take ?i1', 't ?i1', 'get ?i1', 'pick up ?i1', 'pickup ?i1',
        'pick ?i1 up'
      ],
      'Pick up an item.');

    this.addCommand('drop', 'beDroppedBy', ['drop ?i1', 'dr ?i1', 'put down ?i1', 'put ?i1 down', 'let ?i1 go',
      'let go of ?i1',
      'let go ?i1', 'release ?i1'
    ], 'Put down an item.');

    var inventory = function inventory() {
      var subject = this;
      var items = allItems().filter(function(item) {
        return item.appearsInInventoryOf(subject);
      }).map(function(i) {
        return i.indefiniteName;
      });
      if (!items.length) return "You don't have anything.";
      return "You have " + series(items) + ".";
    }
    inventory.templates = ['inventory', 'i'];
    inventory.help = 'List the items in your possession.';
    this.inventory = inventory;

    var help = function help() {
      var ret = '';
      ret += 'Need help?  Here are some commands:\n\n';
      ret += this.commands().filter(function(c) {
        return c.help;
      }).map(function(c) {
        var shortcut = c.templates.find(function(t) {
          return t.split(/\s+/)[0].length == 1;
        });
        return '"' + c.templates[0].toLowerCase().split(/\s+/).map(function(x) {
          return x.startsWith('?i') ? '[ITEM]' : x.startsWith('?d') ? '[DIRECTION]' : capitalize(x);
        }).join(' ') + '": ' + c.help + (shortcut ? ' (Shortcut: "' + shortcut.charAt(0).toUpperCase() +
          '")' :
          '');
      }).join('\n');
      ret += '\n\nThere are other commands not listed here.  Try stuff out.  Good luck!';
      return ret;
    };
    help.templates = ['help', 'h', 'help me'];
    help.help = 'Read these words.';
    this.help = help;
    this.commands = function() {
      return objectValues(this).filter(function(v) {
        return typeof v == 'function' && 'templates' in v && v.templates.length > 0;
      });
    };

    this.addCommand('examine', 'beExaminedBy', ['examine ?i1', 'x ?i1', 'look ?i1', 'look at ?i1', 'l ?i1',
        'l at ?i1'
      ],
      'Examine an item.');

    this.addCommand('use', 'beUsedBy', ['use ?i1', 'use ?i1 with ?i2', 'use ?i1 on ?i2'], 'Use an item in some way.');

  }
  Person.prototype = Object.create(Item.prototype);
  A.newPerson = function(options) {
    return new Person(options)
  };

  var exitReverseProperties = {
    id: 'reverseId',
    location: 'destination',
    direction: 'reverseDirection',
    isForwardExit: 'isReverseExit'
  };
  Object.keys(exitReverseProperties).forEach(function(k) {
    exitReverseProperties[exitReverseProperties[k]] = k;
  });

  function Exit(options) {
    if (typeof options === 'string') {
      options = {
        id: options
      };
    }
    options = Object.assign({}, options || {});
    var name = unwrap(options.name) || unwrap(options.id) || 'exit';
    options.name = immutable(options.name || name);
    if (!('canBeTaken' in options)) {
      options.canBeTaken = immutable(false);
    }
    options.location = immutable(options.location);
    options.direction = immutable(options.direction);
    options.destination = immutable(options.destination);

    var reverseDirection = unwrap(options.reverseDirection);
    if (reverseDirection) {
      options.reverseDirection = immutable(typeof reverseDirection === 'boolean' ? oppositeDirections[unwrap(options.direction)] :
        options.reverseDirection);

      if (('reverseId' in options) && (unwrap(options.reverseid) in itemMap)) throw new Error('Cannot reuse id ' +
        unwrap(options.reverseId) + ' for reverseId');
      options.reverseId = immutable(options.reverseId || getNewId(name + '-reverse'));

      // these are not touchable
      options.isForwardExit = immutable(true);
      options.isReverseExit = immutable(false);

      options.forwardExit = immutable(this);

      var proxyType = function() {};
      proxyType.prototype = this;
      var reverseExit = new proxyType();

      options.reverseExit = immutable(reverseExit);
    }

    Item.call(this, options);

    if (reverseDirection) {

      var reverseExit = this.reverseExit;
      var forwardExit = this;

      Object.keys(this).forEach(function(k) {
        var rk = exitReverseProperties[k] || k;
        var h = {
          enumerable: true,
          configurable: false,
          get: function() {
            return forwardExit[rk];
          },
          set: function(v) {
            forwardExit[rk] = v;
          }
        };
        Object.defineProperty(reverseExit, k, h);
      });

      reverseExit.serialize = function() {
        return '';
      };
      reverseExit.deserialize = function() {};
      Object.seal(reverseExit);

      itemMap[this.reverseId] = reverseExit;
    }

  }
  Exit.prototype = Object.create(Item.prototype);
  Exit.prototype.beUsedBy = function(subject) {
    var ret = 'You use ' + this.definiteName + ' leading ' + this.direction + '.\n\n';
    subject.location = this.destination;
    return ret + subject.look();
  };
  Exit.prototype.beExaminedBy = function(subject) {
    if (this.description) return this.description;
    return capitalize(this.it) + (this.plural ? "'re" : "'s") + ' ' + this.indefiniteName + (this.direction ?
      ' leading ' + this.direction : '') + '.';
  };

  A.newExit = function(options) {
    return new Exit(options)
  };
  
  //TODO desperation isn't good, maybe this is the right way to match all the time
  // It could be useful to collect lots of possible results and either return the
  // first success or the most likely failure
  function findConfusingInput (subject, str) {
    str = str.toLowerCase().replace(/[^a-z0-9 ]/g, '');
    str = str.replace(/\s+/g, ' ').trim();
    str = str.replace(/\bplease( |$)/g, '').trim(); // no need to be polite 
    var knownItems = allItems().filter(function(it){return it.known;});
    for (var i = 0; i < interpretInput.templates.length; i++) {
       var template = interpretInput.templates[i];
       if (!template.numTokens) continue; // don't bother with match-all I guess
       var matchResults = template.regexp.exec(str);
       if (!matchResults) continue;
       var parameters = [];
       var success = true;
       for (var j = 1; j < matchResults.length; j++) {
          var p = template.paramOrder[j-1]-1;
          var item = parseItemAndRemainder(subject, matchResults[j], knownItems);
          if (!item || item.remainder) {
            parameters[p]=matchResults[j];
            success = false;
          } else {
            parameters[p]=item.item;
          }
       }
       if (!success) return {func: template.func, parameters: parameters, template: template};
    }
    return null; // totally confused
  }
 
  var interpretInput = this.interpretInput = function interpretInput(subject, str) {
    str = str.toLowerCase().replace(/[^a-z0-9 ]/g, '');
    str = str.replace(/\s+/g, ' ').trim();
    str = str.replace(/\bplease( |$)/g, '').trim(); // no need to be polite 
    // sort templates by length
    if (!interpretInput.templates) {
      interpretInput.templates = flatten(subject.commands().map(function(c) {
        return c.templates.map(function(t) {
          var pattern = t.toLowerCase().split(/\s+/);
          return {
            func: c,
            pattern: pattern,
            regexp: new RegExp('^'+(pattern.map(function(s){return s.charAt(0)=='?' ? '(.*)' : s.replace(/[^a-z0-9 ]/g,'');}).join(' '))+'$'),
            paramOrder: pattern.filter(function(s){return s.charAt(0)=='?';}).map(function(s){return parseInt(s.substring(2),10);}),
            numTokens: pattern.filter(function(s){return s.charAt(0)!='?';}).length
          };
        });
      }));
      interpretInput.templates.sort(function(x, y) {
        return y.pattern.length - x.pattern.length;
      });
      //TODO maybe they should be ordered by number of item/dirs, or length of words?
    }
    templateLoop: for (var i = 0; i < interpretInput.templates.length; i++) {
      var template = interpretInput.templates[i];
      var m = str;
      var ret = {
        success: true,
        func: template.func,
        parameters: [],
        template: template.pattern.join(' ')
      };
      for (var j = 0; j < template.pattern.length; j++) {
        var token = template.pattern[j];
        if (token.charAt(0) == '?') {
          var paramIndex = parseInt(token.substring(2), 10) - 1;
          if (!(paramIndex >= 0)) {
            console.log('bad pattern index in: ' + template.pattern.join(' '));
            continue templateLoop;
          }
          var result;
          if (token.charAt(1) == 'i') {
            // interpret as an item or exit?
            result = parseExitAndRemainder(subject, m);
            if (!result || typeof result.exit === 'string') {
              var knownItems = allItems().filter(function(it){return it.known;});
              result = parseItemAndRemainder(subject, m, knownItems.filter(function(it){return subject.canSee(it);}));
              if (!result) {
                result = parseItemAndRemainder(subject, m, knownItems.filter(function(it){return !subject.canSee(it);}));
                if (!result) 
                    continue templateLoop; // not an item
              }
              ret.parameters[paramIndex] = result.item;
            } else {
              ret.parameters[paramIndex] = result.exit;
            }
          } else if (token.charAt(1) == 'd') {
            // interpret as exit
            result = parseExitAndRemainder(subject, m);
            if (!result) continue templateLoop; // not an exit
            ret.parameters[paramIndex] = result.exit;
          } else {
            // don't recognize the type of pattern word
            console.log('bad pattern type in: ' + template.pattern.join(' '));
            continue templateLoop;
          }
          m = result.remainder;
        } else {
          if (!(m + ' ').startsWith(token)) {
            // doesn't match
            continue templateLoop;
          }
          m = m.substring(token.length + 1); // remove a space or go off the end, which is fine				
        }
      }
      // we made it!  Or did we?  If there's stuff after the match, it's not a match
      if (m.length == 0) {
        return ret;
      }
    }
    return {success: false }; // no match
  }

  function flatten(arrayOfArray) {
    return [].concat.apply([], arrayOfArray);
  }

  function parseDirectionAndRemainder(subject, str) {
    str = str.toLowerCase().replace(/^(leading) /i, '').trim(); // strip off 'leading'  
    str = str.toLowerCase().replace(/^(on|to|toward) /i, '').trim(); // strip off directional words
    str = str.toLowerCase().replace(/^(the|a|an) /i, '').trim(); // strip off articles
    var space = (str + ' ').indexOf(' ');
    if (!space) return null; // no words
    var word = str.substring(0, space);
    var remainder = str.substring(space + 1);
    if (word in dirs) {
      return {
        direction: dirs[word],
        remainder: remainder
      };
    }
    return null; // couldn't find direction
  }

  function parseExitAndRemainder(subject, str) {
    var loc = subject.location;
    var knownNearbyExits = allItems().filter(function(it) {
      return (it.known) && (it instanceof Exit) && (it.location === loc);
    });

    var startsWithExit = parseItemAndRemainder(subject, str, knownNearbyExits);
    if (startsWithExit) {
      // see if the next word is a direction
      var followedByDirection = parseDirectionAndRemainder(subject, startsWithExit.remainder);
      if (followedByDirection) {
        // okay, we found something.  Now let's see if that matches up with the exit in that direction
        var theExit = knownNearbyExits.find(function(it) {
          return it.direction === followedByDirection.direction
        });
        if (theExit) {
          // there is an exit in this direction, but the user might have used the wrong name for it
          startsWithExit = parseItemAndRemainder(subject, str, [theExit]);
          if (startsWithExit) {
            followedByDirection = parseDirectionAndRemainder(subject, startsWithExit.remainder);
            if (followedByDirection && followedByDirection.direction === theExit.direction) {
              // this works
              return {
                exit: theExit,
                remainder: followedByDirection.remainder
              };
            }
            // the exit is not in the direction specified... try other matches
          } // the exit is not in the direciton specified... try other matches            
        } // there is no exit in that direction.  Blah            
      } // there is no direction afterward, but so just the exit was specified
      return {
        exit: startsWithExit.item,
        remainder: startsWithExit.remainder
      };
    }

    var startsWithDirection = parseDirectionAndRemainder(subject, str);
    if (startsWithDirection) {
      var theExit = knownNearbyExits.find(function(it) {
        return it.direction === startsWithDirection.direction;
      });
      if (theExit) {
        var followedByExit = parseItemAndRemainder(subject, startsWithDirection.remainder, [theExit]);
        if (followedByExit) {
          return {
            exit: theExit,
            remainder: followedByExit.remainder
          };
        }
        // not followed by an exit word, but the direction will specify the exit
        return {
          exit: theExit,
          remainder: startsWithDirection.remainder
        };
      }
      // there is no exit in this direction, but we definitely specified a direction
      // Let's return the direction with no exit?
      return {
        exit: startsWithDirection.direction,
        remainder: startsWithDirection.remainder
      };
    }
    return null; // no exit item, no direction, forget it           
  }

  function parseItemAndRemainder(subject, str, itemList) {
    str = str.toLowerCase().replace(/^(the|a|an) /i, ''); // strip off articles
        
    itemList = itemList || allItems().filter(function(x) {
      return x.known;
    });
    // get keywords for all acceptable items
    var theItems = flatten(itemList.map(function(x) {
      var canSee = subject.canSee(x);
      return x.keywords.map(function(k) {
        return {
          keyword: k.toLowerCase(),
          canSee: canSee,
          item: x
        };
      });
    }));

    // sort these items so that nearby items are more likely to be identified,
    // and do the longest match first
    theItems.sort(function(x, y) {
      return y.keyword.length - x.keyword.length;
    });
    var found = theItems.find(function(x) {
      return str.startsWith(x.keyword);
    });
    if (!found) return null;
    return {
      item: found.item,
      remainder: str.substring(found.keyword.length).trim()
    };
  }
  var blankResponses = ["What?", "Come again?", "Sorry, I didn't hear you.", "Did you say something?",
    "Are you confused?  Type \"help\" for help.", "I don't follow.", "You should probably type something.",
    "Sorry, I don't speak mime.", "Try using words to express yourself.",
    "I like short commands, but that's too short."
  ];
  var curBlankResponses = [];

  function respond(subject, str) {
    str = str.replace(/\s+/g, ' ').trim();
    str = str.replace(/^"\s*(.*)\s*"$/, '$1');
    str = str.replace(/^'\s*(.*)\s*'$/, '$1');
    var interpretation = interpretInput(subject, str);
    if (interpretation.success) {
      return interpretation.func.apply(subject, interpretation.parameters);
    } 
    // failed to understand
    var failedInterpretation = findConfusingInput(subject, str);
    if (failedInterpretation) {
        var misunderstood = failedInterpretation.parameters.filter(function(s){return typeof s === 'string';}).map(function(s){return '"'+s+'"';});
        if (misunderstood) {
            return "Sorry, I don't understand "+series(misunderstood,'or')+".";  
        }
     }
    // okay, we didn't understand.  So let's be humorous?
    if (str.length == 0) {
      if (!curBlankResponses.length) curBlankResponses = blankResponses.slice();
      return curBlankResponses.splice(Math.floor(Math.random() * curBlankResponses.length), 1)[0];
    }
    return "Sorry, I don't understand \"" + str + "\". Type \"help\" for help.";
  }
  A.respond = respond;

};