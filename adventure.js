"use strict";
//TODO limit to inventory?
//TODO maybe ambiguous items should be a warning error rather than first-found?
//TODO "jump"
//TODO "put ___ on ____"?
//TODO better name/pronoun grammar management
//TODO 'known' should be property of subject, not items... maybe even 'hidden'?
//TODO allow for multiple subjects 
//TODO add timed events with some kind of 'tick' handler or some other system

var Adventure = (function() {

  var Adv = {};
  Adv.newAdventure = function() {
    return new Adventure();
  };

  var objectValues = function(o, includeProto) {
    if (includeProto) {
      var ret = [];
      for (var k in o) {
        ret.push(o[k]);
      }
      return ret;
    }
    return Object.keys(o).map(function(k) {
      return o[k];
    });
  };

  // string manipulation functions    
  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  Adv.capitalize = capitalize;

  function titleCase(str) {
    return str.toLowerCase().split(" ").map(capitalize).join(" ");
  }
  Adv.titleCase = titleCase;

  function series(strs, conjunction) {
    conjunction = conjunction || 'and';
    if (strs.length < 3) return strs.join(' ' + conjunction + ' ');
    return strs.slice(0, -1).join(', ') + ', ' + conjunction + ' ' + strs[strs.length - 1];
  }
  Adv.series = series;

  // mutability for options
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
  Adv.mutable = mutable;

  function immutable(obj, enforceIfWrapped) {
    if (obj instanceof MutabilityMarker) {
      if (!enforceIfWrapped) return obj;
      obj = obj.object;
    }
    return new MutabilityMarker(false, obj);
  }
  Adv.immutable = immutable;

  function unwrap(obj) {
    if (obj instanceof MutabilityMarker)
      return obj.object;
    return obj;
  }

  function enforceItemPropertyImmutability(item, options) {
    var immutableProperties = {};
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
      Object.defineProperty(item, prop, o);
    });
    return immutableProperties;
  }

  // default names for an item given its name and plurality
  function getDefaultNames(name, plural) {
    var ret = {};
    if (plural) {
      ret.pluralName = name;
    } else if ((/[^aeiou]y$/i).test(name)) {
      ret.pluralName = name.substring(0, name.length - 1) + 'ies';
    } else if ((/(s|x|z|ch|sh)$/i).test(name)) {
      ret.pluralName = name + 'es';
    } else {
      ret.pluralName = name + 's';
    }
    ret.keywords = [name.toLowerCase().replace(/[^a-z0-9 ]/g, '')];
    ret.definiteName = 'the ' + name;
    ret.indefiniteName = plural ? name : ('aeiou'.indexOf(name.charAt(0).toLowerCase()) >=
      0 ? 'an ' :
      'a ') + name;
    ret.it = plural ? 'they' : 'it';
    return ret;
  };

  function Adventure() {

    var a = this;

    a.maxNesting = 256;

    // directions 
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
      down: ['d', 'lower', 'downward', 'downwards', 'below', 'lower', 'low', 'lowest', 'under', 'beneath',
        'underneath',
        'bottom'
      ]
    };

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

    var dirRegExps = {};
    Object.keys(directions).forEach(function(k) {
      var re = '(?:leading )?(?:on |to |toward )?(?:the |a |an )?(?:' + k + '|' + directions[k].join('|') + ')';
      dirRegExps[k] = {
        start: new RegExp('^' + re + '(?:^|\\s+)(.*)$', 'i'),
        end: new RegExp('^(.*?)(?:^|\\s+)' + re + '$', 'i')
      };
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
    a.itemMap = itemMap;
    a.allItems = allItems;

    // serialize adventure
    var serialize = function() {
      var serializedMap = {};
      Object.keys(itemMap).forEach(function(k) {
        var serialized = itemMap[k].serialize();
        if (serialized) serializedMap[k] = serialized;
      });
      return JSON.stringify(serializedMap);
    };
    a.serialize = serialize;

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
    a.deserialize = deserialize;

    function Item(options) {
      var item = this;
      this.adventure = a;
      if (typeof options === 'string') {
        options = {
          id: options
        };
      }
      options = Object.assign({}, options || {});

      var name = unwrap(options.name) || unwrap(options.id) || 'item';
      options.name = immutable(options.name || name);

      if (options.id && unwrap(options.id) in itemMap) throw new Error('cannot reuse id "' + unwrap(options.id) +
        '"');

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
      var defaultNames = getDefaultNames(name, plural);
      options.description = immutable(options.description || null);
      options.keywords = immutable(options.keywords || defaultNames.keywords);
      options.plural = immutable('plural' in options ? options.plural : false);
      options.definiteName = immutable(options.definiteName || defaultNames.definiteName);
      options.indefiniteName = immutable(options.indefiniteName || defaultNames.indefiniteName);
      options.pluralName = immutable(options.pluralName || defaultNames.pluralName);
      options.it = immutable(options.it || defaultNames.it);
      options.canBeTaken = immutable('canBeTaken' in options ? options.canBeTaken : true);
      options.location = (unwrap(options.canBeTaken) ? mutable : immutable)(options.location || null);
      options.hidden = 'hidden' in options ? mutable(options.hidden) : mutable(false);
      options.unlisted = immutable('unlisted' in options ? options.unlisted : false);
      options.known = mutable('known' in options ? options.known : false);
      options.isItem = immutable(true);

      var location = options.location;
      delete options.location;
      immutableProperties = enforceItemPropertyImmutability(item, options);
      if ((location instanceof MutabilityMarker) && !(location.mutable)) immutableProperties.location = true;
      location = unwrap(location);
      var o = {
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
            ret += exitTypes[type].directions.length == 1 ? 'is ' + exitTypes[type].single : 'are ' +
              exitTypes[
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
          ret += ' ' + capitalize(this.it) + ' ' + ((this instanceof Person) ? (this.plural ? 'have' : 'has') : (
            this.plural ? 'contain' : 'contains')) + ' ' + series(itemNames) + '.';
        }
      }
      return ret;
    };

    Item.prototype.allContents = function() {
      var here = this;
      return allItems().filter(function(it) {
        return it.location === here;
      });
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
        if (cnt > a.maxNesting) {
          throw new Error('Location nesting of more than ' + a.maxNesting + ' exceeded!');
        }
        if (loc === this) return true;
      }
      return false;
    };

    Item.prototype.ultimateLocation = function() {
      var cnt = 0;
      for (var loc = this; loc.location; loc = loc.location) {
        cnt++;
        if (cnt > a.maxNesting) {
          throw new Error('Location nesting of more than ' + a.maxNesting + ' exceeded!');
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

    // return a string representing the current state of this item, or falsy value if no state to serialize
    Item.prototype.serialize = function() {
      var item = this;
      var ret = JSON.stringify(this, function(k, v) {
        if ((typeof this.getImmutableProperties === 'function') && (k in this.getImmutableProperties()))
          return; // don't serialize immutables
        if (v === a) return; // don't serialize the adventure object
        if (k && v && (v.adventure === a)) { // serialize another Item/Place/Person as its id string  
          return serializationPrefix + '#' + v.id;
        }
        if (typeof v === 'string' && v.startsWith(serializationPrefix)) { // if, somehow, a name collision comes in, escape it
          return serializationPrefix + '?' + v;
        }
        return v;
      });
      if (ret !== '{}') return ret;
      return false;
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
      if (!('hidden' in options))
        options.hidden = immutable(false);
      if (!('canBeTaken' in options))
        options.canBeTaken = immutable(false);
      if (!('location' in options))
        options.location = immutable(this);
      return new Item(options);
    };

    a.newItem = function(options) {
      return new Item(options)
    };

    var addMethodFactory = function(typeName, constructor) {
      return function(name, method) {
        if (name in constructor.prototype) throw new Error(typeName +
          " prototype already has a property named \"" + name + "\".");
        constructor.prototype[name] = method;
      };
    };

    a.addItemMethod = addMethodFactory('Item', Item);

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
      if (!('hidden' in options)) {
        options.hidden = immutable(false);
      }
      options.location = immutable(options.location);
      options.isPlace = immutable(true);
      Item.call(this, options);
    }
    Place.prototype = Object.create(Item.prototype);
    a.newPlace = function(options) {
      return new Place(options)
    };
    a.addPlaceMethod = addMethodFactory('Place', Place);

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
      options.location = mutable(options.location); // people default to mobile
      if (!('it' in options)) {
        options.it = immutable('she');
      }
      options.isPerson = immutable(true);
      Item.call(this, options);

    }

    Person.prototype = Object.create(Item.prototype);
    a.newPerson = function(options) {
      return new Person(options)
    };
    a.addPersonMethod = addMethodFactory('Person', Person);

    a.addCommand = function(subjectCommandName, objectCommandName, templates, help, helpOrder) {
      var command = function command(object) {
        if (!this.canSee(object)) {
          return "You can't see " + object.definiteName + " here.";
        }
        if (!(objectCommandName in object)) {
          // okay let's use the first template
          var commandName = templates[0].toLowerCase().replace(/%[id]1?[^0-9]*$/, '').trim().replace(
            /%[id]\d+/, 'anything');
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
      if (typeof helpOrder === 'undefined') {
        helpOrder = Math.max.apply(null, Person.prototype.commands().map(function(c) {
          return c.helpOrder;
        }).filter(function(o) {
          return typeof o == 'number';
        })) + 1;
      }
      command.helpOrder = helpOrder;
      Person.prototype[subjectCommandName] = command;
    };

    var go = function(exit) {
      if (exit.noExit) {
        return "You can't go " + exit.direction + " from here.";
      }
      return this.use(exit);
    }
    go.templates = ['go %d1', '%d1', 'move %d1', 'walk %d1'];
    go.help = 'Go in the specified direction, like North or South.';
    go.helpOrder = 0;
    Person.prototype.go = go;

    var climb = function(dir) {
      if (!dir) {
        dir = 'up';
      }
      return this.go(dir);
    };
    climb.templates = ['climb', 'climb %d1'];
    Person.prototype.climb = climb;

    var look = function look() {
      this.location.known = true;
      return this.location.beExaminedBy(this);
    };
    look.templates = ['look', 'l'];
    look.help = 'Look around you.';
    look.helpOrder = 1;
    Person.prototype.look = look;

    a.addCommand('take', 'beTakenBy', ['take %i1', 't %i1', 'get %i1', 'pick up %i1', 'pickup %i1',
        'pick %i1 up'
      ],
      'Pick up an item.', 2);

    a.addCommand('drop', 'beDroppedBy', ['drop %i1', 'dr %i1', 'put down %i1', 'put %i1 down',
      'let %i1 go',
      'let go of %i1',
      'let go %i1', 'release %i1'
    ], 'Put down an item.', 3);

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
    inventory.helpOrder = 4;
    Person.prototype.inventory = inventory;

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
          return x.startsWith('%i') ? '[ITEM]' : x.startsWith('%d') ? '[DIRECTION]' : capitalize(x);
        }).join(' ') + '": ' + c.help + (shortcut ? ' (Shortcut: "' + shortcut.charAt(0).toUpperCase() +
          '")' :
          '');
      }).join('\n');
      ret += '\n\nThere are other commands not listed here.  Try stuff out.  Good luck!';
      return ret;
    };
    help.templates = ['help', 'h', 'help me'];
    help.help = 'Read these words.';
    help.helpOrder = 5;
    Person.prototype.help = help;

    a.addCommand('examine', 'beExaminedBy', ['examine %i1', 'x %i1', 'look %i1', 'look at %i1',
        'l %i1',
        'l at %i1'
      ],
      'Examine an item.', 6);

    a.addCommand('use', 'beUsedBy', ['use %i1', 'use %i1 with %i2', 'use %i1 on %i2'],
      'Use an item in some way.', 7);

    Person.prototype.commands = function() {
      return objectValues(this, true).filter(function(v) {
        return typeof v == 'function' && 'templates' in v && v.templates.length > 0;
      }).sort(function(x, y) {
        return (x.helpOrder || 0) - (y.helpOrder || 0);
      });
    };

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
      if (!('hidden' in options)) {
        options.hidden = immutable(false);
      }

      options.location = immutable(options.location);
      options.direction = immutable(options.direction);
      options.isExit = immutable(true);
      // destination should be managed as a getter/setter that takes objects or ids, like location
      var destination = immutable(options.destination);
      delete options.destination;
      var destinationImmutable = !(destination.mutable);
      destination = unwrap(destination);
      var o = {
        configurable: false,
        enumerable: true,
        get: function() {
          var ret = destination;
          if (typeof destination === 'string') ret = itemMap[destination];
          if (!ret) ret = null;
          return ret;
        }
      };
      if (!destinationImmutable) {
        o.set = function(l) {
          destination = l;
        };
      }
      Object.defineProperty(this, 'destination', o);

      var reverse = unwrap(options.reverse);

      var exit = this;

      function makeThisAnItem() {
        Item.call(exit, options);
        if (destinationImmutable) exit.getImmutableProperties().destination = true;
      }

      if (!reverse) {
        makeThisAnItem();
        return;
      }

      delete options.reverse;

      if (reverse === true) {
        reverse = {};
      } else if (typeof reverse == 'string') {
        reverse = {
          direction: reverse
        };
      }

      reverse.direction = immutable(reverse.direction || oppositeDirections[unwrap(options.direction)]);

      if (('id' in reverse) && (unwrap(reverse.id) in itemMap)) throw new Error('Cannot reuse id ' + unwrap(reverse
          .id) +
        ' for reverse.id');

      reverse.id = immutable(reverse.id || getNewId((unwrap(reverse.name) || name) + '-reverse'));

      var reversePlural = ('plural' in reverse) ? unwrap(reverse.plural) : (('plural' in options) ? unwrap(options.plural) :
        false);

      if ('name' in reverse) {
        reverse.name = immutable(reverse.name);
        var defaultNames = getDefaultNames(unwrap(reverse.name), reversePlural);
        reverse.keywords = immutable(reverse.keywords || defaultNames.keywords);
        reverse.definiteName = immutable(reverse.definiteName || defaultNames.definiteName);
        reverse.indefiniteName = immutable(reverse.indefiniteName || defaultNames.indefiniteName);
        reverse.pluralName = immutable(reverse.pluralName || defaultNames.pluralName);
        reverse.it = immutable(reverse.it || defaultNames.it);
      }

      ['description', 'keywords', 'plural', 'definiteName', 'indefiniteName', 'pluralName', 'it', 'canBeTaken',
        'hidden',
        'unlisted'
      ].forEach(function(k) {
        if (k in reverse) reverse[k] = immutable(reverse[k]);
      });

      // unchangable options
      options.isForwardExit = immutable(true);
      options.isReverseExit = immutable(false);
      reverse.isForwardExit = immutable(false);
      reverse.isReverseExit = immutable(true);
      options.forwardExit = immutable(this);

      var proxyType = function() {};
      proxyType.prototype = this;
      var reverseExit = new proxyType();

      options.reverseExit = immutable(reverseExit);

      if ('location' in reverse) throw new Error(
        'Do not specify location of reverse exit; it will automatically be the same as the exit destination');
      if ('destination' in reverse) throw new Error(
        'Do not specify destination of reverse exit; it will automatically be the same as the exit location');

      var immutableProperties = enforceItemPropertyImmutability(reverse, reverse);
      // as of now, reverse is an object holding onto these properties

      makeThisAnItem();

      itemMap[reverse.id] = reverseExit;

      var forwardExit = this;
      reverse.serialize = this.serialize.bind(reverse);
      reverse.deserialize = this.deserialize.bind(reverse);
      reverse.getImmutableProperties = function() {
        return immutableProperties;
      };

      Object.defineProperty(reverseExit, 'location', {
        enumerable: true,
        configurable: false,
        get: function() {
          return forwardExit.destination;
        },
        set: function(v) {
          forwardExit.destination = v;
        }
      });
      Object.defineProperty(reverseExit, 'destination', {
        enumerable: true,
        configurable: false,
        get: function() {
          return forwardExit.location;
        },
        set: function(v) {
          forwardExit.location = v;
        }
      });

      var mergedKeyObj = {};
      Object.keys(this).forEach(function(k) {
        mergedKeyObj[k] = true;
      });
      Object.keys(reverse).forEach(function(k) {
        mergedKeyObj[k] = true;
      });

      Object.keys(mergedKeyObj).forEach(function(k) {
        if ((k == 'location') || (k == 'destination')) return;
        var get;
        var set;
        if (k in reverse) {
          get = function() {
            return reverse[k];
          };
          set = function(v) {
            reverse[k] = v;
          };
        } else {
          get = function() {
            return forwardExit[k];
          };
          set = function(v) {
            forwardExit[k] = v;
          };
        }

        Object.defineProperty(reverseExit, k, {
          enumerable: true,
          configurable: false,
          get: get,
          set: set
        });
      });

      Object.seal(reverseExit);

    }
    Exit.prototype = Object.create(Item.prototype);
    Exit.prototype.getDistinguishingName = function(indefinite) {
      var ret = indefinite ? this.indefiniteName : this.definiteName;
      if (!this.location) return ret;
      if (!this.direction) return ret;
      var name = this.name;
      var exitsOfSameType = this.location.getExits().filter(function(ex) {
        return ex.name === name;
      });
      if (exitsOfSameType.length < 2) return ret;
      ret += ' leading ' + this.direction;
      return ret;
    };
    Exit.prototype.beUsedBy = function(subject) {
      var ret = 'You use ' + this.definiteName + ' leading ' + this.direction + '.\n\n';
      subject.location = this.destination;
      return ret + subject.look();
    };
    Exit.prototype.beExaminedBy = function(subject) {
      if (this.description) return this.description;
      return capitalize(this.it) + (this.plural ? "'re" : "'s") + ' ' + this.getDistinguishingName(true) + '.';
    };

    a.newExit = function(options) {
      return new Exit(options);
    };
    a.addExitMethod = addMethodFactory('Exit', Exit);

    var noExit = {};
    Object.keys(directions).forEach(function(k) {
      noExit[k] = new Exit({
        id: 'no-exit-' + k,
        name: 'exit leading ' + k,
        definiteName: 'an exit leading ' + k,
        keywords: ['exit', 'door'],
        direction: k,
        location: null,
        destination: null,
        noExit: immutable(true),
        known: immutable(false),
        hidden: immutable(true)
      });
    });

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
      // okay, we didn't understand.  So let's be humorous?
      if (str.length == 0) {
        if (!curBlankResponses.length) curBlankResponses = blankResponses.slice();
        return curBlankResponses.splice(Math.floor(Math.random() * curBlankResponses.length), 1)[0];
      }

      var confused = interpretation.confusingInput ? ('"' + interpretation.confusingInput + '"') : 'that';
      return "Sorry, I don't understand " + confused + ".  Type \"help\" for help."

    }
    a.respond = respond;

    function getCommandMatches(subject, str) {
      str = str.replace(/[^a-z0-9 ]/ig, '').replace(/\s+/g, ' ').trim();
      str = str.replace(/(\b|^)please( |$)/g, '').trim(); // no need to be polite;
      var argRe = /%[id]\d*/g;
      var allMatches = [];
      subject.commands().forEach(function(command) {
        command.templates.forEach(function(template) {
          var lens = [];
          while (true) {
            // build a regular expression to match this template to the string, making sure to preclude
            // any previous matches by limiting the length of the matches
            var i = 0;
            var func = function(str, offset) {
              var ret = (typeof lens[i] === 'number') ? ('\\b(.{1,' + lens[i] + '})\\b') : '\\b(.+)\\b';
              i++;
              return ret;
            };
            var re = new RegExp('^(?:' + template.replace(argRe, func) + ')$', 'i');
            var matches = str.match(re);
            if (matches) {
              matches = matches.slice(1);
              var args = [];
              var params = (template.match(argRe) || []);
              var unknownArg = 1;
              for (var j = 0; j < matches.length; j++) {
                var param = params[j];
                var match = matches[j];
                var type = param.charAt(1);
                var argNum = (parseInt(param.substring(2), 10) || unknownArg) - 1;
                unknownArg = argNum + 2;
                args[argNum] = {
                  type: type,
                  str: match
                };
              }
              lens = matches.map(function(m) {
                return m.length;
              });
              var totalMatchedLength = lens.reduce(function(s, l) {
                return s + l;
              }, 0);
              allMatches.push({
                command: command,
                template: template,
                args: args,
                totalMatchedLength: totalMatchedLength
              });

            } else {
              lens.pop();
            }
            while (true) {
              var lenlen = lens.length;
              if (!lenlen) return;
              lenlen--;
              lens[lenlen]--;
              if (lens[lenlen] > 0) {
                break;
              }
              lens.pop();
            }
          }
        });
      });
      allMatches.sort(function(x, y) {
        return x.totalMatchedLength - y.totalMatchedLength;
      });
      allMatches.forEach(function(m) {
        delete m.totalMatchedLength;
      });
      return allMatches;
    }

    function matchStringToItem(subject, str, item) {
      // assume that string is alphanumeric separated by single spaces  
      // check to see if item is a nearby exit specified by direction
      if ((item instanceof Exit) && (item.noExit || (item.location === subject.location)) && item.direction) {
        var matches = str.match(dirRegExps[item.direction].start) || str.match(dirRegExps[item.direction].end);
        if (matches) {
          str = matches[1]; // strip direction specifier off
          if (!str) return true; //specifying just the direction is considered a match                    
        }
      }
      // see if it matches any of the item's keywords
      str = str.toLowerCase().replace(/^(the|a|an) /i, '').trim(); // strip off articles
      for (var i = 0; i < item.keywords.length; i++) {
        if (str === item.keywords[i].toLowerCase())
          return true;
      }
      return false; // didn't match any keywords or direction... it's not a match.
    }

    function interpretInput(subject, str) {

      var commandMatches = getCommandMatches(subject, str);

      if (!commandMatches.length) return {
        success: false,
        confusingInput: str
      };

      var exits = null;
      var getExits = function() {
        if (!exits) {
          exits = allItems().filter(function(it) {
            return (it.known) && (it instanceof Exit) && (it.location === subject.location);
          });
          exits.push.apply(exits, objectValues(noExit));
        }
        return exits;
      };
      var items = null;
      var getItems = function() {
        if (!items) {
          items = allItems().filter(function(it) {
            return (it.known);
          });
          items.sort(function(x, y) {
            return +subject.canSee(y) - subject.canSee(x);
          });
          items.push.apply(items, objectValues(noExit));
        }
        return items;
      };

      var confusingArgNumber = -1;
      var confusingInput = null;
      commandLoop: for (var i = 0; i < commandMatches.length; i++) {
        var commandMatch = commandMatches[i];
        var params = [];
        argLoop: for (var j = 0; j < commandMatch.args.length; j++) {
          var arg = commandMatch.args[j];
          var itemsToSearch = (arg.type.toLowerCase() == 'd') ? getExits() : getItems();
          itemLoop: for (var k = 0; k < itemsToSearch.length; k++) {
            var itemToSearch = itemsToSearch[k];
            if (matchStringToItem(subject, arg.str, itemToSearch)) {
              params[j] = itemToSearch;
              continue argLoop;
            }
          }
          if (j > confusingArgNumber) {
            confusingInput = arg.str;
            confusingArgNumber = j;
          }
          // the string doesn't match any item so maybe this isn't the right command        
          continue commandLoop;
        }
        return {
          success: true,
          func: commandMatch.command,
          parameters: params
        };
      }
      return {
        success: false,
        confusingInput: confusingInput
      };

    };

  };

  // some nice defaults?
  Adv.openableExitOptions = {
    open: true,
    beOpenedBy: function(subject) {
      if (this.open) return "It's already open.";
      this.open = true;
      return "You have opened " + this.getDistinguishingName() + ".";
    },
    beClosedBy: function(subject) {
      if (!this.open) return "It's already closed.";
      this.open = false;
      return "You have closed " + this.getDistinguishingName() + ".";
    },
    beUsedBy: function(subject) {
      if (!this.open) return Adv.capitalize(this.getDistinguishingName()) +
        " is closed.";
      return this.superMethod('beUsedBy')(subject);
    },
    beExaminedBy: function(subject) {
      var description = this.superMethod('beExaminedBy')(subject);
      return description + ' ' + Adv.capitalize(this.it) + ' is ' + (this.open ? 'open' : 'closed') + '.';
    },
    beUnlockedBy: function(subject) {
      return "There's no lock.";
    },
    beLockedBy: function(subject) {
      return "It doesn't lock.";
    },
    bePulledBy: function(subject) {
      return (this.isForwardExit) ? this.beOpenedBy(subject) : this.beClosedBy(subject);
    },
    bePushedBy: function(subject) {
      return (this.isReverseExit) ? this.beOpenedBy(subject) : this.beClosedBy(subject);
    }
  };

  Adv.lockableExitOptions = {
    unlocked: true,
    beOpenedBy: function(subject) {
      if (this.unlocked) return Adv.openableExitOptions.beOpenedBy.call(this, subject);
      return Adv.capitalize(this.getDistinguishingName()) + " is locked.";
    },
    beUsedBy: function(subject) {
      if (!this.unlocked) return Adv.capitalize(this.getDistinguishingName()) +
        " is locked.";
      return Adv.openableExitOptions.beUsedBy.call(this, subject);
    },
    beExaminedBy: function(subject) {
      var ret = this.superMethod('beExaminedBy')(subject);
      ret += ' ' + Adv.capitalize(this.it) + ' is ' + (this.open ? 'open' : ('closed and ' + (this.unlocked ?
        'un' : ''))) + 'locked.';
      ret += ' ' + Adv.capitalize(this.it) + ' ' + (this.unlocked ? '' : 'un') + 'locks from ' + (this.isForwardExit ?
        'this' : 'the other') + ' side.';
      return ret;
    },
    beUnlockedBy: function(subject) {
      if (this.unlocked) return "It's already unlocked.";
      if (this.isReverseExit) return "You can't unlock it from this side.";
      this.unlocked = true;
      return "You have unlocked " + this.definiteName + '.';
    },
    beLockedBy: function(subject) {
      if (this.open) return "You have to close it first.";
      if (!this.unlocked) return "It's already locked.";
      if (this.isReverseExit) return "You can't lock it from this side.";
      this.unlocked = false;
      return "You have locked " + this.definiteName + '.';
    }
  };

  return Adv;
})();