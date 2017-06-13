interface Array<T> {
  filter<U extends T>(pred: (a: T) => a is U): U[];
}

interface ObjectConstructor {
  keys<T>(obj: T): (keyof T)[]
}

type ImplicitAnyIndex<T> = T & { [k: string]: any };

namespace Adventure {

  type Dictionary<T> = {
    [k: string]: T
  }

  type SetOfStrings = Dictionary<true>;

  type Info = string | ((p: Person) => string);

  var objectValues = function <T>(o: Dictionary<T>, includeProto?: boolean): T[] {
    if (includeProto) {
      var ret: T[] = [];
      var k;
      for (k in o) {
        ret.push(o[k]);
      }
      return ret;
    }
    return Object.keys(o).map(function(k) {
      return o[k];
    });
  };

  // string/grammar manipulation functions    
  export function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  export function titleCase(str: string): string {
    return str.toLowerCase().split(" ").map(capitalize).join(" ");
  }

  export function series(strs: string[], conjunction?: string): string {
    conjunction = conjunction || 'and';
    if (strs.length < 3) return strs.join(' ' + conjunction + ' ');
    return strs.slice(0, -1).join(', ') + ', ' + conjunction + ' ' + strs[strs.length - 1];
  }

  function addS(name: string): string {
    if ((/[^aeiou]y$/i).test(name)) {
      return name.substring(0, name.length - 1) + 'ies';
    } else if ((/(s|x|z|ch|sh|[^aeiou]o)$/i).test(name)) {
      return name + 'es';
    } else {
      return name + 's';
    }
  }

  // mutability for options
  class MutabilityMarker<T> {
    mutable: boolean;
    object: T

    constructor(mutable: boolean, object: T) {
      this.mutable = mutable;
      this.object = object;
    }

  }

  type MaybeMarked<T> = T | MutabilityMarker<T>;

  type MaybePropertiesMarked<T> = {
    [P in keyof T]: MaybeMarked<T[P]>;
  }

  type PartialMarkedOptions<T> = Partial<MaybePropertiesMarked<T>>;

  export function mutable<T>(obj: MaybeMarked<T>, enforceIfWrapped?: boolean): MutabilityMarker<T> {
    if (obj instanceof MutabilityMarker) {
      if (!enforceIfWrapped) return obj;
      obj = obj.object;
    }
    return new MutabilityMarker(true, obj);
  }

  export function immutable<T>(obj: MaybeMarked<T>, enforceIfWrapped?: boolean): MutabilityMarker<T> {
    if (obj instanceof MutabilityMarker) {
      if (!enforceIfWrapped) return obj;
      obj = obj.object;
    }
    return new MutabilityMarker(false, obj);
  }

  function unwrap<T>(obj: MaybeMarked<T>): T {
    if (obj instanceof MutabilityMarker)
      return obj.object;
    return obj;
  }

  function setOptions<T>(item: T & { getImmutableProperties: () => SetOfStrings }, options: PartialMarkedOptions<T>) {
    var immutableProperties = item.getImmutableProperties();
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
  }

  function enforceImmutables<T>(item: T & { getImmutableProperties: () => SetOfStrings }) {
    Object.keys(item.getImmutableProperties()).forEach(function(prop) {
      var desc = Object.getOwnPropertyDescriptor(item, prop) || {
        enumerable: true
      };
      desc.configurable = false;
      if (desc.set) desc.set = undefined;
      if (!desc.get) desc.writable = false;
      Object.defineProperty(item, prop, desc);
    });

  }



  export function newAdventure() {
    return new Adventure();
  };


  interface DirectionRegExps {
    start: RegExp;
    end: RegExp;
  }
  interface Direction {
    id: string;
    name: string;
    keywords: string[];
    oppositeId: string | false;
    regExps: DirectionRegExps;
  }
  type BaseDirOpts = ({ id: string, name?: string } | { id?: string, name: string }) & { keywords?: string[] };
  type DirectionOptions = BaseDirOpts & { opposite?: BaseDirOpts };


  interface GrammaticalPersonMapping<T> {
    i: T;
    we: T;
    you: T;
    he: T;
    she: T;
    it: T;
    they: T;
  }

  function grammarize<T>(itemOrPronoun: Item | string, mapping: GrammaticalPersonMapping<T>): T {
    if (typeof itemOrPronoun !== 'string') {
      itemOrPronoun = itemOrPronoun.pronoun;
    }
    var pronoun = itemOrPronoun.toLowerCase();
    var index: number;
    if (!(pronoun in mapping))
      pronoun = 'it';
    return mapping[pronoun as keyof GrammaticalPersonMapping<T>];
  }
  function isPlural(pronoun: string) {
    return grammarize(pronoun, {
      i: false,
      we: true,
      you: false,
      he: false,
      she: false,
      it: false,
      they: true
    });
  }
  // default names for an item and its pronoun
  interface DefaultNames {
    pluralName: string;
    keywords: string[];
    definiteName: string;
    indefiniteName: string;
  }


  function getDefaultNames(name: string, pronoun: string): DefaultNames {
    var ret = {} as DefaultNames;
    var plural = isPlural(pronoun)
    return {
      pluralName: plural ? name : addS(name),
      keywords: [name.toLowerCase().replace(/[^a-z0-9 ]/g, '')],
      definiteName: 'the ' + name,
      indefiniteName: plural ? name : ('aeiou'.indexOf(name.charAt(0).toLowerCase()) >=
        0 ? 'an ' :
        'a ') + name
    };
  };
  var addMethodFactory = function <T>(typeName: string, constructor: { new(...args: any[]): T }): (name: string, method: (this: T, ...args: any[]) => any) => void {
    return function(name: string, method: (this: T, ...args: any[]) => any) {
      if (name in constructor.prototype) throw new Error(typeName +
        " prototype already has a property named \"" + name + "\".");
      constructor.prototype[name] = method;
    };
  };

  class Adventure {


    you: Person;

    maxNesting = 256;

    // KEEP A MAP OF ALL DIRECTIONS IN THE ADVENTURE
    directions: Dictionary<Direction> = {};


    directionName(dir: string) {
      if (dir in this.directions) return this.directions[dir].name;
      return dir;
    }

    directionRegExps(dir: string, keywords?: string[]): DirectionRegExps {
      if (dir in this.directions) return this.directions[dir].regExps;
      keywords = keywords || [dir];
      var re = '(?:leading )?(?:on |to |toward )?(?:the |a |an )?(?:' + keywords.join('|') + ')';
      return {
        start: new RegExp('^' + re + '(?:^|\\s+)(.*)$', 'i'),
        end: new RegExp('^(.*?)(?:^|\\s+)' + re + '$', 'i')
      };
    }


    newDirection(options: DirectionOptions) {
      if (!('name' in options) && (!('id' in options))) throw new Error('a direction needs a name');
      if (!('name' in options)) options.name = options.id;
      if (!('id' in options)) {
        var i = 0;
        var id: string = options.name;
        while (id in options) {
          i++;
          id = options.name + i;
        }
        options.id = id;
      }
      if (options.id in this.directions) throw new Error('ID conflict with direction ' + options.id);
      var direction = {} as Direction;
      direction.id = options.id;
      direction.name = options.name;
      direction.keywords = options.keywords || [direction.name];
      direction.oppositeId = false;
      if (options.opposite) {
        var oppositeOptions = Object.assign({}, options.opposite);
        delete (oppositeOptions as any).opposite; // don't need it but can't hurt
        var opposite = this.newDirection(oppositeOptions);
        direction.oppositeId = opposite.id;
        opposite.oppositeId = direction.id;
      }
      direction.regExps = this.directionRegExps(options.id, direction.keywords);
      this.directions[options.id] = direction;
      return direction;
    };

    constructor() {
      var a = this;

      this.tell = function(personOrPeople: Person | Person[], infoPeople?: Info, infoNearby?: Info, infoDistant?: Info) {
        var people: Person[] = (personOrPeople instanceof Item) ? [personOrPeople] : personOrPeople;

        var peopleMap: SetOfStrings = {};
        people.forEach(function(person) {
          peopleMap[person.id] = true;
          if (infoPeople) person.learn(infoPeople);
        });

        if (infoNearby || infoDistant) {
          a.allPeople().forEach(function(person) {

            if (person.id in peopleMap) return;

            var canSee = false;
            for (var p = 0; p < people.length; p++) {
              if (person.canSee(people[p])) {
                canSee = true;
                break;
              }
            }

            if (canSee && infoNearby) person.learn(infoNearby);
            if (!canSee && infoDistant) person.learn(infoDistant);

          });
        }
      };



      a.newDirection({
        id: 'north',
        keywords: ['north', 'n', 'northern', 'northward', 'northwards'],
        opposite: {
          id: 'south',
          keywords: ['south', 's', 'southern', 'southward', 'southwards']
        }
      });
      a.newDirection({
        id: 'east',
        keywords: ['east', 'e', 'eastern', 'eastward', 'eastwards'],
        opposite: {
          id: 'west',
          keywords: ['west', 'w', 'western', 'westward', 'westwards']
        }
      });
      a.newDirection({
        id: 'northeast',
        keywords: ['northeast', 'ne', 'northeastern', 'northeastward', 'northeastwards'],
        opposite: {
          id: 'southwest',
          keywords: ['southwest', 'sw', 'southwestern', 'southwestward', 'southwestwards']
        }
      });
      a.newDirection({
        id: 'northwest',
        keywords: ['northwest', 'nw', 'northwestern', 'northwestward', 'northwestwards'],
        opposite: {
          id: 'southeast',
          keywords: ['southeast', 'se', 'southeastern', 'southeastward', 'southeastwards']
        }
      });
      a.newDirection({
        id: 'up',
        keywords: ['up', 'u', 'upper', 'upward', 'upwards', 'above', 'high', 'higher', 'highest', 'over', 'top'],
        opposite: {
          id: 'down',
          keywords: ['down', 'd', 'lower', 'downward', 'downwards', 'below', 'lower', 'low', 'lowest', 'under',
            'beneath',
            'underneath',
            'bottom'
          ]
        }
      });

      var directionName = this.directionName.bind(this);
      a.newCommand({
        methodName: "go",
        templates: 'go|move|walk| %d1',
        help: 'Go in the specified direction, like North or South.',
        command: function(exit) {
          if (exit.noExit) {
            tell(this, "You can't go " + directionName(exit.direction) + " from here.");
            return;
          }
          this.use(exit);
        }
      });


      a.newCommand({
        methodName: "climb",
        templates: 'climb |%d1',
        command: function(dir: Exit) {
          if (!dir) {
            var dir = this.location.getExits().find(function(ex: Exit) {
              return ex.direction == 'up';
            }) || noExit['up']
          }
          this.go(dir);
        }
      });

      a.newCommand({
        methodName: "look",
        templates: 'look|l',
        help: 'Look around you.',
        command: function look() {
          this.setKnown(this.location);
          this.location.beExaminedBy(this);
        }
      });
          // how do I represent arbitrary commands?!
      


      a.newCommand({
        methodName: "take",
        templates: ["take|t|get|pickup %i1", "pick up %i1", "pick %i1 up"],
        help: "Pick up an item.",
        command: {
          objectMethodName: "beTakenBy"
        }
      });

      a.newCommand({
        methodName: "drop",
        templates: ["drop|d|release %i1", "put down %i1", "put %i1 down", "let %i1 go", "let go |of| %i1"],
        help: "Put down an item.",
        command: {
          objectMethodName: "beDroppedBy",
          mustHave: true
        }
      });

      a.newCommand({
        methodName: "give",
        templates: ["give %i1 to %i2", "give %i2 %i1"],
        help: "Give an item to someone else.",
        command: {
          objectMethodName: "beGivenBy",
          mustHave: true
        }
      });

      var allItems: (() => Item[]) = this.allItems.bind(this);
      var tell = this.tell;

      var commands = this.commands;
      a.newCommand({
        methodName: "inventory",
        templates: 'inventory|i',
        help: 'List the items in your possession.',
        command: function inventory() {
          var subject = this;
          var items = allItems().filter(function(item) {
            return item.appearsInInventoryOf(subject);
          }).map(function(i) {
            subject.setKnown(i);
            return i.indefiniteName;
          });
          var ret = (!items.length) ? "You don't have anything." : "You have " + series(items) + ".";
          tell(this, ret);
        }
      });

      a.newCommand({
        methodName: "help",
        command: function help() {
          var ret = '';
          ret += 'Need help?  Here are some commands:\n\n';
          ret += commands.filter(function(c) {
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
          tell(this, ret);
        },
        templates: ['help|h', 'help me'],
        help: 'Read these words.'
      });

      a.newCommand({
        methodName: "examine",
        templates: ["examine|x %i1", "look|l |at|in|inside|into %i1"],
        help: "Examine an item.",
        command: {
          objectMethodName: "beExaminedBy"
        }
      });

      a.newCommand({
        methodName: "use",
        templates: ["use|u %i1", "use|u %i1 with|on %i2"],
        help: "Use an item in some way.",
        command: {
          objectMethodName: "beUsedBy"
        }
      });

      var noExit = this.noExit;
      Object.keys(this.directions).forEach(function(k) {
        noExit[k] = new Exit(a, {
          id: 'no-exit-' + k,
          name: 'exit leading ' + directionName(k),
          definiteName: 'an exit leading ' + directionName(k),
          keywords: ['exit', 'door'],
          direction: k,
          location: null,
          destination: null,
          reverse: false,
          noExit: immutable(true),
          hidden: immutable(true)
        });
      });

    }



    // KEEP A MAP OF ALL ITEMS IN THE ADVENTURE
    itemMap: Dictionary<Item> = {};

    getNewId(id: string) {
      var cnt = 0;
      var testId = id;
      while (testId in this.itemMap) {
        testId = id + '' + cnt;
        cnt++;
      }
      return testId;
    }

    allItems() {
      return objectValues(this.itemMap);
    }
    getItem(id: string): Item {
      return this.itemMap[id];
    };


    allPeople(): Person[] {
      return this.allItems().filter<Person>(isPerson);
    }

    // KEEP A LIST OF ALL COMMANDS IN THE ADVENTURE
    commands: Command[] = [];

    getCommand(name: string) {
      return this.commands.find(function(command) {
        return command.methodName == name;
      });
    };

    // serialize adventure
    // 


    serialize() {
      var serializedMap: Dictionary<string> = {};
      var itemMap = this.itemMap;
      Object.keys(itemMap).forEach(function(k) {
        var serialized = itemMap[k].serialize();
        if (serialized) serializedMap[k] = serialized;
      });
      return JSON.stringify(serializedMap);
    };

    // restore to state given by state string.  
    // this CANNOT BE USED to add or remove items form the world. 
    // TODO... somehow deal with that?
    deserialize(state: string) {
      var serializedMap = JSON.parse(state);
      if (typeof serializedMap !== 'object') throw new Error('invalid state string');
      var itemMap = this.itemMap;
      Object.keys(serializedMap).forEach(function(k) {
        var item = itemMap[k];
        // if bad item, ignore it?  TODO
        if (item) {
          item.deserialize(serializedMap[k]);
        }
      });
    };

    tell: (personOrPeople: Person | Person[], infoPeople?: Info, infoNearby?: Info, infoDistant?: Info) => void;

    newCommand(options: CommandOptions): Command {
      var tell = this.tell;
      options = Object.assign({}, options);
      if (!options.methodName) throw new Error('The command needs a methodName');
      if (typeof options.templates == 'string') options.templates = [options.templates];
      if (!options.templates || !options.templates.length) throw new Error('The command needs templates');
      options.templates = expandTemplates(Array.from(options.templates));
      var commandFunction: (this: Person, ...args: any[]) => any;
      if (typeof options.command == 'function') {
        commandFunction = options.command;
      } else if (typeof options.command == 'object') {
        var youCant = options.command.youCant;
        if (!youCant) {
          var commandName = options.templates[0].toLowerCase().replace(/%[id]1?[^0-9]*$/, '').trim().replace(
            /%[id]\d+/, 'anything');
          youCant = "You can't " + commandName + " %i1.";
        }
        var mustSee = ('mustSee' in options.command) ? !!options.command.mustSee : true; // default true
        var mustHave = !!options.command.mustHave; // default false
        var objectMethodName: string | false = options.command.objectMethodName || false;
        commandFunction = function(object: ImplicitAnyIndex<Item>) {
          var subject = this;
          var objectName = this.nameFor(object);
          if (object && mustHave && !this.has(object)) {
            tell(this, "You don't have " + objectName + ".");
            return;
          }
          if (object && mustSee && !this.canSee(object)) {
            tell(this, "You can't see " + objectName + " here.");
            return;
          }
          if (!object) {
            tell(this, youCant.replace(/%[id][0-9]*/gi, '').replace(/\s+/g, ' '));
            return;
          }
          if (!objectMethodName || !(objectMethodName in object)) {
            tell(this, youCant.replace(/%[id][0-9]*/gi, objectName).replace(/\s+/g, ' '));
            return;
          }
          var args = Array.from(arguments);
          args[0] = this;
          object[objectMethodName].apply(object, args);
          return '';
        };
      } else {
        throw new Error('The command needs either a command function or command options object');
      }
      var command: Command = Object.assign(commandFunction, {
        templates: options.templates,
        methodName: options.methodName
      });
      if (options.help) {
        command.help = options.help;
      }
      (Person.prototype as ImplicitAnyIndex<Person>)[options.methodName] = command;
      this.commands.push(command);
      return command; // why not
    };

    newItem<T>(options: MaybePropertiesMarked<Partial<Item>>, extraOptions?: MaybePropertiesMarked<T>): Item & T {
      return new Item(this, Object.assign({}, options, extraOptions)) as Item & T;
    };
    addItemMethod = addMethodFactory('Item', Item);

    newPlace<T>(options: MaybePropertiesMarked<Partial<Place>>, extraOptions?: MaybePropertiesMarked<T>): Place & T {
      return new Place(this, Object.assign({}, options, extraOptions)) as Place & T;
    };
    addPlaceMethod = addMethodFactory('Place', Place);

    newPerson<T>(options: MaybePropertiesMarked<Partial<Person>>, extraOptions?: MaybePropertiesMarked<T>): Person & T {
      return new Person(this, Object.assign({}, options, extraOptions)) as Person & T;
    };
    addPersonMethod = addMethodFactory('Person', Person);

    newExit<T>(options: MaybePropertiesMarked<Partial<Exit>>, extraOptions?: MaybePropertiesMarked<T>): Exit & T {
      return new Exit(this, Object.assign({}, options, extraOptions)) as Exit & T;
    };
    addExitMethod = addMethodFactory('Exit', Exit);


    noExit: Dictionary<Exit> = {};


    static blankResponses = ["What?", "Come again?", "Sorry, I didn't hear you.", "Did you say something?",
      "Are you confused?  Type \"help\" for help.", "I don't follow.", "You should probably type something.",
      "Sorry, I don't speak mime.", "Try using words to express yourself.",
      "I like short commands, but that's too short."
    ];
    curBlankResponses: string[] = [];

    respond(subject: Person, str: string): string {
      str = str.replace(/\s+/g, ' ').trim();
      str = str.replace(/^"\s*(.*)\s*"$/, '$1');
      str = str.replace(/^'\s*(.*)\s*'$/, '$1');
      var interpretation = this.interpretInput(subject, str);
      if (interpretation.success !== false) {
        var ret = subject.consumeInformationQueue();
        interpretation.parameters.forEach(function(param) {
          if (param.id) subject.setKnown(param);
        });
        interpretation.func.apply(subject, interpretation.parameters);
        ret += subject.consumeInformationQueue();
        ret = ret.trim();
        return ret;
      }

      // okay, we didn't understand.  So let's be humorous?
      if (str.length == 0) {
        if (!this.curBlankResponses.length) this.curBlankResponses = Adventure.blankResponses.slice();
        return this.curBlankResponses.splice(Math.floor(Math.random() * this.curBlankResponses.length), 1)[0];
      }

      var i = interpretation.confusingInput;

      var confused = i ? ('"' + i + '"') : 'that';
      return "Sorry, I don't understand " + confused + ".  Type \"help\" for help."

    }

    getCommandMatches(subject: Person, str: string) {
      str = str.replace(/[^a-z0-9 ]/ig, '').replace(/\s+/g, ' ').trim();
      str = str.replace(/(\b|^)please( |$)/g, '').trim(); // no need to be polite;
      var argRe = /%[id]\d*/g;
      var allMatches: ({
        command: Command;
        template: string;
        args: any[];
        totalMatchedLength: number;
      })[] = [];
      this.commands.forEach(function(command) {
        command.templates.forEach(function(template) {
          var lens: number[] = [];
          while (true) {
            // build a regular expression to match this template to the string, making sure to preclude
            // any previous matches by limiting the length of the matches
            var i = 0;
            var func = function(str: string, offset: number) {
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

    matchStringToItem(subject: Person, str: string, item: Item) {
      // assume that string is alphanumeric separated by single spaces  
      // check to see if item is a nearby exit specified by direction
      if ((item instanceof Exit) && (item.noExit || (item.location === subject.location)) && item.direction) {
        var regExps = this.directionRegExps(item.direction);
        var matches = str.match(regExps.start) || str.match(regExps.end);
        if (matches) {
          str = matches[1]; // strip direction specifier off
          if (!str) return true; //specifying just the direction is considered a match                    
        }
      }
      // see if it matches any of the item's keywords
      str = str.toLowerCase().replace(/^(the|a|an) /i, '').trim(); // strip off articles
      var kw = item.keywords;
      // the word "me" or "myself" can refer to the speaker
      if (subject === item) {
        kw = kw.concat(['me', 'myself', 'i']);
      } else {
        kw = kw.concat([item.them, item.themselves, item.they]);
      }
      for (var i = 0; i < kw.length; i++) {
        if (str === kw[i].toLowerCase())
          return true;
      }
      return false; // didn't match any keywords or direction... it's not a match.
    }

    interpretInput(subject: Person, str: string) {

      var commandMatches = this.getCommandMatches(subject, str);

      if (!commandMatches.length) return {
        success: <false>false,
        confusingInput: <string>str
      };

      var exits: Exit[] = null;
      var noExit = this.noExit;
      var getExits = function() {
        if (!exits) {
          exits = subject.knownItems.filter(function(it: Item): it is Exit {
            return (it instanceof Exit) && (it.location === subject.location);
          });
          exits.push.apply(exits, objectValues(noExit));
        }
        return exits;
      };
      var items: Item[] = null;
      var getItems = function() {
        if (!items) {
          items = subject.knownItems.slice();
          items = items.reverse();
          items = items.filter(function(i) {
            return subject.canSee(i);
          }).
            concat(items.filter(function(i) {
              return !subject.canSee(i);
            }),
            objectValues(noExit));
        }
        return items;
      };

      var confusingArgNumber = -1;
      var confusingInput = null;
      commandLoop: for (var i = 0; i < commandMatches.length; i++) {
        var commandMatch = commandMatches[i];
        var params: Item[] = [];
        argLoop: for (var j = 0; j < commandMatch.args.length; j++) {
          var arg = commandMatch.args[j];
          var itemsToSearch = (arg.type.toLowerCase() == 'd') ? getExits() : getItems();
          for (var k = 0; k < itemsToSearch.length; k++) {
            var itemToSearch = itemsToSearch[k];
            if (this.matchStringToItem(subject, arg.str, itemToSearch)) {
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
          success: <true>true,
          func: commandMatch.command,
          parameters: params
        };
      }
      return {
        success: <false>false,
        confusingInput: confusingInput
      };
    };
  }

  class Item {
    getImmutableProperties: () => SetOfStrings;
    location: Item;
    definiteName: string;
    indefiniteName: string;
    pluralName: string;
    pronoun: string;

    get them() {
      return grammarize(this, { i: 'me', we: 'us', you: 'you', he: 'him', she: 'her', it: 'it', they: 'them' });
    }

    get they() {
      return this.pronoun;
    }

    get are() {
      return grammarize(this, {
        i: 'am',
        we: 'are',
        you: 'are',
        he: 'is',
        she: 'is',
        it: 'is',
        they: 'are'
      });
    }

    get were() {
      return grammarize(this, {
        i: 'was',
        we: 'were',
        you: 'were',
        he: 'was',
        she: 'was',
        it: 'was',
        they: 'were'
      });
    }

    get have() {
      return grammarize(this, {
        i: 'have',
        we: 'have',
        you: 'have',
        he: 'has',
        she: 'has',
        it: 'has',
        they: 'have'
      });
    }

    get re() {
      return grammarize(this, {
        i: 'm',
        we: 're',
        you: 're',
        he: 's',
        she: 's',
        it: 's',
        they: 're'
      });
    }

    get ve() {
      return grammarize(this, {
        i: 've',
        we: 've',
        you: 've',
        he: 's',
        she: 's',
        it: 's',
        they: 've'
      });
    }

    get thirdSing() {
      return grammarize(this, {
        i: false,
        we: false,
        you: false,
        he: true,
        she: true,
        it: true,
        they: false
      });
    }

    get their() {
      return grammarize(this, {
        i: 'my',
        we: 'our',
        you: 'your',
        he: 'his',
        she: 'her',
        it: 'its',
        they: 'their'
      });
    }
    get theirs() {
      return grammarize(this, {
        i: 'mine',
        we: 'ours',
        you: 'yours',
        he: 'his',
        she: 'hers',
        it: 'its',
        they: 'theirs'
      });
    }
    get themselves() {
      return grammarize(this, {
        i: 'myself',
        we: 'ourselves',
        you: 'yourself',
        he: 'himself',
        she: 'herself',
        it: 'itself',
        they: 'themselves'
      });
    }

    get theyre() {
      return this.they + "'" + this.re;
    };

    get theyve() {
      return this.they + "'" + this.ve;
    };

    get toPlural() {
      return grammarize(this, {
        i: 'we',
        we: 'we',
        you: 'you',
        he: 'they',
        she: 'they',
        it: 'they',
        they: 'they'
      });
    }

    get isPlural() {
      return isPlural(this.pronoun);
    }

    name: string;
    description?: string;
    hidden: boolean;
    unlisted: boolean;
    playableCharacter: boolean;
    canBeTaken: boolean;
    id: string;
    alive: boolean;
    keywords: string[];
    wantsToTake: SetOfStrings;
    wantsToGive: Dictionary<SetOfStrings>;
    informationQueue: string[];
    isItem: true;
    isPlace: boolean;
    isPerson: boolean;
    isExit: boolean;

    constructor(public adventure: Adventure, options: string | Partial<MaybePropertiesMarked<Item>>, noEnforceImmutables?: boolean) {

      var item = this;
      if (typeof options === 'string') {
        options = {
          id: options
        };
      }
      options = Object.assign({}, options || {});

      var name = unwrap(options.name) || unwrap(options.id) || 'item';
      options.name = immutable(options.name || name);
      var itemMap = this.adventure.itemMap;
      if (options.id && unwrap(options.id) in itemMap) throw new Error('cannot reuse id "' + unwrap(options.id) +
        '"');

      var baseId = unwrap(options.id) || name || 'item';
      var id = this.adventure.getNewId(baseId);
      options.id = immutable(id);

      itemMap[id] = this;

      // prevent a property from being saved/loaded as state or modified
      var immutableProperties = {};

      this.getImmutableProperties = function() {
        return immutableProperties;
      };

      var pronoun = unwrap(options.pronoun) || 'it';
      var defaultNames = getDefaultNames(name, pronoun);
      options.description = immutable(options.description || null);
      options.keywords = immutable(options.keywords || defaultNames.keywords);
      options.definiteName = immutable(options.definiteName || defaultNames.definiteName);
      options.indefiniteName = immutable(options.indefiniteName || defaultNames.indefiniteName);
      options.pluralName = immutable(options.pluralName || defaultNames.pluralName);
      options.pronoun = immutable(options.pronoun || pronoun);
      options.canBeTaken = immutable('canBeTaken' in options ? options.canBeTaken : true);
      options.location = (unwrap(options.canBeTaken) ? mutable : immutable)(options.location || null);
      options.hidden = 'hidden' in options ? mutable(options.hidden) : mutable(false);
      options.unlisted = immutable('unlisted' in options ? options.unlisted : false);
      options.playableCharacter = immutable(('playableCharacter' in options) ? options.playableCharacter : false);
      options.alive = immutable(('alive' in options) ? options.alive : false);
      options.wantsToTake = mutable(options.wantsToTake || {});
      options.wantsToGive = mutable(options.wantsToGive || {});

      if (unwrap(options.playableCharacter)) options.informationQueue = mutable([] as string[]);
      options.isItem = immutable<true>(true);

      setOptions(item, options);

      var location: Item | string = this.location;

      var o = {
        configurable: true,
        enumerable: true,
        get: function() {
          var ret = location;
          if (typeof location === 'string') ret = itemMap[location];
          if (!ret) ret = null;
          return ret;
        },
        set: function(l: Item) {
          if (item.ultimatelyContains(l, true)) {
            throw new Error(capitalize(item.definiteName) + " ultimately contains " + capitalize(l.name) +
              " so " + item.they + " cannot be contained by " +
              ((l === item) ? l.themselves : l.them) + " without making a loop.");
          }
          location = l;
        }
      };
      Object.defineProperty(item, 'location', o);



      if (!noEnforceImmutables) enforceImmutables(item);

    };

    toString() {
      return this.definiteName;
    }


    verb(vb: string) {

      var vbl = vb.toLowerCase();
      if (vbl == 'are') return this.are;
      if (vbl == 'were') return this.were;
      if (vbl == 'have') return this.have;
      if (vbl === 're') return this.re;
      if (vbl === 've') return this.ve;
      if (vbl === "'re") return "'" + this.re;
      if (vbl === "'ve") return "'" + this.ve;
      if (this.thirdSing) return addS(vb);
      return vb;
    }



    getExits(): Exit[] {
      var here = this;
      return this.adventure.allItems().filter(function(it): it is Exit {
        return (it instanceof Exit) && (it.location === here) && (!it.hidden);
      });
    };

    beTakenBy(subject: Person) {
      var item = this;
      var tell = this.adventure.tell;
      if (!this.canBeTaken) {
        tell(subject, "You can't pick up " + subject.nameFor(item) + ".");
        return;
      }
      if (subject.has(this)) {
        tell(subject, "You already have " + subject.nameFor(item) + ".");
        return;
      }

      subject.wantsToTake[this.id] = true;


      // prevent trying to create a loop
      if (this.ultimatelyContains(subject)) {
        tell(subject, "You can't take " +
          subject.nameFor(this) + ((subject as Item === this) ? "." : " because " +
            this.they + " already " + (this.alive ? this.have : this.verb('contain'))) + " you.");
        return;
      }

      var locationChain = this.locationChain();
      for (var i = 0; i < locationChain.length; i++) {
        var loc = locationChain[i];
        if (subject === loc) continue; // you say yes to yourself
        if (!loc.beAskedToGive(this, subject, false)) {
          loc.beAskedToGive(this, subject, true);
          return;
        }
      }
      // one final direct check
      var success = false;
      loc = this.location;
      if (!loc) {
        tell(subject,
          "You have picked up " + subject.nameFor(item) + ".",
          function(witness: Person) {
            return capitalize(witness.nameFor(subject)) + ' ' + subject.have + ' picked up ' + witness.nameFor(
              item) +
              '.';
          });
        success = true;
      } else if (this.location.beAskedToGive(this, subject, true)) {
        success = true;
      }
      if (success) {
        this.location = subject;
        delete subject.wantsToTake[this.id];
        delete ((loc || ({} as Person)).wantsToGive || {})[this.id];
      }
    };

    beGivenBy(subject: Person, recipient: Item) {
      var tell = this.adventure.tell;
      if (!subject.canSee(recipient)) {
        tell(subject, "You can't see " + subject.nameFor(recipient) + " here.");
        return;
      }
      if (subject === recipient) {
        tell(subject, "You already have " + subject.nameFor(this) + ".");
        return;
      }

      if (!subject.wantsToGive[this.id]) {
        subject.wantsToGive[this.id] = {};
      }
      subject.wantsToGive[this.id][recipient.id] = true;

      // prevent trying to create a loop
      if (this.ultimatelyContains(recipient)) {
        tell(subject, "You can't " + (recipient.alive ? 'give ' : 'put ') +
          subject.nameFor(this) + (recipient.alive ? ' to ' : ' into ') +
          subject.nameFor(recipient, this == recipient ? recipient.themselves : subject.nameFor(recipient)) +
          ((recipient === this) ? "." :
            " because " + subject.nameFor(this, this.they + " already " + (this.alive ? this.have : this.verb(
              'contain')), "you already have") + " " +
            subject.nameFor(recipient, recipient.them) + "."));
        return;
      }
      var locationChain = recipient.locationChain();
      for (var i = 0; i < locationChain.length; i++) {
        var loc = locationChain[i];
        if (subject === loc) continue; // you say yes to yourself
        if (!loc.beAskedToTake(this, subject, false)) {
          loc.beAskedToTake(this, subject, true);
          return;
        }
      }
      // one final direct check
      if (recipient.beAskedToTake(this, subject, true)) {
        this.location = recipient;
        delete subject.wantsToGive[this.id];
        delete (recipient.wantsToTake || {})[this.id];
      }
    };

    beDroppedBy(subject: Person) {
      this.beGivenBy(subject, subject.location);
    }

    beExaminedBy(subject: Person) {
      var item = this;
      var ret = '';

      if (subject.location === item) {
        ret += titleCase(item.name) + '\n';
      }

      ret += item.description || (subject.nameFor(item, capitalize(item.theyre), "You're") + ' just ' +
        subject.nameFor(item, item.indefiniteName) + '.');
      subject.setKnown(item);

      // describe exits with directions
      var exits = item.getExits().filter(function(ex) {
        return ex.direction;
      });
      if (exits.length > 0) {
        var exitTypes: {
          [k: string]: { single: string; multiple: string; directions: string[]; }
        } = {};
        exits.forEach(function(ex) {
          var type = ex.pluralName;
          if (!(type in exitTypes)) {
            exitTypes[type] = {
              single: ex.indefiniteName,
              multiple: ex.pluralName,
              directions: []
            };
          }
          exitTypes[type].directions.push(item.adventure.directionName(ex.direction));
        });
        Object.keys(exitTypes).forEach(function(type) {
          if (subject.location === item) {
            ret += ' There ';
            ret += exitTypes[type].directions.length == 1 ? 'is ' + exitTypes[type].single : 'are ' +
              exitTypes[
                type].multiple;
          } else {
            ret += ' ' + capitalize(item.they) + ' ' + item.have;
            ret += exitTypes[type].directions.length == 1 ? exitTypes[type].single : exitTypes[type].multiple;
          }
          ret += ' leading ';
          ret += series(exitTypes[type].directions);
          ret += '.';
        });
      }

      // describe non-exits or exits with no direction, but not the subject
      var items = item.listContents(subject).filter(function(it) {
        return (!(it instanceof Exit) || (!it.direction)) && it !== subject;
      });
      var itemNames = items.map(function(it) {
        return subject.nameFor(it, it.indefiniteName, 'you');
      });
      if (items.length > 0) {
        if (subject.location === item) {
          ret += ' ' + capitalize(series(itemNames)) + ' ' + ((items.length > 1) ? 'are' : items[0].are) +
            ' here.';
        } else {
          ret += ' ' + subject.nameFor(item, capitalize(item.pronoun), 'You') + ' ' + ((item.alive) ?
            subject.nameFor(item, item.have, 'have') : item.verb(
              'contain')) +
            ' ' + series(itemNames) + '.';
        }
      }
      this.adventure.tell(subject, ret);
    };

    allContents() {
      var here = this;
      return this.adventure.allItems().filter(function(it) {
        return it.location === here;
      });
    };

    listContents(subject: Person) {
      var here = this;
      var items = this.adventure.allItems().filter(function(it) {
        return it.location === here && !it.hidden;
      });
      items.forEach(function(i) {
        subject.setKnown(i);
      });
      items = items.filter(function(it) {
        return !(it.unlisted)
      });
      return items;
    };

    ultimatelyContains(item: Item, excludingItself?: boolean) {
      var cnt = 0;
      for (var loc = (excludingItself ? item.location : item); loc; loc = loc.location) {
        cnt++;
        if (cnt > this.adventure.maxNesting) {
          throw new Error('Location nesting of more than ' + this.adventure.maxNesting + ' exceeded!');
        }
        if (loc === this) return true;
      }
      return false;
    };

    locationChain() {
      var ids: SetOfStrings = {};
      var ret = [];
      for (var loc: Item = this; loc && loc.id && (!(loc.id in ids)); loc = loc.location) {
        ids[loc.id] = true;
        ret.push(loc);
      }
      return ret;
    };

    // return true if yes, false if no
    beAskedToGive(item: Item, asker: Person, doTell: boolean) {
      var holder = this;
      var tell = this.adventure.tell;
      if (doTell) tell(asker, "You have taken " + asker.nameFor(item) + " from " + asker.nameFor(this) +
        ".",
        function(witness) {
          return capitalize(witness.nameFor(asker)) + ' ' + asker.have + ' taken ' + witness.nameFor(item) +
            ' from ' +
            witness.nameFor(holder) + '.'
        });
      return true;
    };

    beAskedToTake(item: Item, asker: Person, doTell: boolean) {
      var tell = this.adventure.tell;
      if (doTell) tell(asker, "You can't " + (this.alive ? 'give ' : 'put ') + asker.nameFor(item) + (this.alive ?
        ' to ' : ' into ') + asker.nameFor(this) + ".");
      return false;
    };

    ultimateLocation() {
      var cnt = 0;
      for (var loc: Item = this; loc.location; loc = loc.location) {
        cnt++;
        if (cnt > this.adventure.maxNesting) {
          throw new Error('Location nesting of more than ' + this.adventure.maxNesting + ' exceeded!');
        }
      }
      return loc;
    };
    canSee(item: Item) {
      return !item.hidden && (this.ultimateLocation() === item.ultimateLocation());
    };
    has(item: Item) {
      return !item.hidden && item.location === this; //(this.ultimatelyContains(item));
    };
    appearsInInventoryOf(subject: Person) {
      return subject.has(this);
    };

    superMethod(name: keyof this) {
      var method = this[name];
      var proto = Object.getPrototypeOf(this);
      while (true) {
        var superMethod = proto[name];
        if (!superMethod) return superMethod;
        if (superMethod !== method) return superMethod.bind(this);
        proto = Object.getPrototypeOf(proto);
        if (!proto) return void (0);
      }
    };

    static serializationPrefix = 'I!';

    serialize() {
      var item = this;
      var a = this.adventure;
      var ret = JSON.stringify(this, function(k, v) {
        if (typeof v === 'function') return; // don't serialize functions!        
        if ((typeof this.getImmutableProperties === 'function') && (k in this.getImmutableProperties()))
          return; // don't serialize immutables
        if (v === a) return; // don't serialize the adventure object
        if (k && v && (v.adventure === a)) { // serialize another Item/Place/Person as its id string  
          return Item.serializationPrefix + '#' + v.id;
        }
        if (typeof v === 'string' && v.startsWith(Item.serializationPrefix)) { // if, somehow, a name collision comes in, escape it
          return Item.serializationPrefix + '?' + v;
        }
        return v;
      });
      if (ret !== '{}') return ret;
      return false;
    };

    // restore this item to the state represented by the passed-in string  
    deserialize(state: string) {
      var itemMap = this.adventure.itemMap;
      var stateObject = JSON.parse(state, function(k, v) {
        if ((typeof v === 'string') && (v.startsWith(Item.serializationPrefix))) {
          var c = v.charAt(Item.serializationPrefix.length);
          var s = v.substring(Item.serializationPrefix.length + 1);
          if (c == '#') {
            return itemMap[s];
          } else {
            return s;
          }
        }
        return v;
      });
      var item: ImplicitAnyIndex<this> = this;
      Object.keys(stateObject).forEach(function(k) {
        if (!(k in item.getImmutableProperties())) {
          item[k] = stateObject[k];
        }
      });
    };

    newBackgroundItem<T>(opts: MaybePropertiesMarked<Partial<Item>>, extraOptions?: MaybePropertiesMarked<T>): Item & T {
      var options = Object.assign({}, opts, extraOptions);
      if (!('unlisted' in options))
        options.unlisted = immutable(true);
      if (!('hidden' in options))
        options.hidden = immutable(false);
      if (!('canBeTaken' in options))
        options.canBeTaken = immutable(false);
      if (!('location' in options))
        options.location = immutable(this);
      return new Item(this.adventure, options) as Item & T;
    };

  }


  class Place extends Item {

    constructor(adventure: Adventure, options: Partial<MaybePropertiesMarked<Place>>) {
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
      options.wantsToGive = immutable({}); // places don't intend to take or give anything (serialization)
      options.wantsToTake = immutable({}); // places don't intend to take or give anything (serialization)

      super(adventure, options);
    }

    beAskedToGive(item: Item, asker: Person, doTell: boolean) {
      var tell = this.adventure.tell;
      if (doTell) tell(asker, "You have picked up " + asker.nameFor(item) + ".", function(witness) {
        return capitalize(witness.nameFor(asker)) + ' ' + asker.have + ' picked up ' + witness.nameFor(item) +
          '.';
      });
      return true;
    };

    beAskedToTake(item: Item, asker: Person, doTell: boolean) {
      var tell = this.adventure.tell;
      if (doTell) tell(asker, "You have dropped " + asker.nameFor(item) + ".", function(witness) {
        return capitalize(witness.nameFor(asker)) + ' ' + asker.have + ' dropped ' + witness.nameFor(item) +
          '.';
      });
      return true;
    };


  }


  function isPerson(item: Item): item is Person {
    return item instanceof Person;
  }

  class Person extends Item {

    
    knownItems: Item[];
    look: ()=>void; 

    constructor(adventure: Adventure, options: Partial<MaybePropertiesMarked<Person>>) {
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
      if (!('pronoun' in options)) {
        options.pronoun = immutable('she');
      }
      options.isPerson = immutable(true);
      options.knownItems = [];

      options.playableCharacter = immutable(('playableCharacter' in options) ? options.playableCharacter : true);
      options.alive = immutable(('alive' in options) ? options.alive : true);
      super(adventure, options, true);

      this.knownItems.push(this); // you know yourself

      var person = this;

      ['name' as 'name', 'definiteName' as 'definiteName', 'indefiniteName' as 'indefiniteName', 'pronoun' as 'pronoun'].forEach(function(prop) {

        var p = person[prop];

        Object.defineProperty(person, prop, {
          configurable: true,
          enumerable: true,
          get: function() {
            return (adventure.you === person) ? 'you' : p;
          },
          set: function(v) {
            p = v;
          }
        });

      });

      enforceImmutables(this);

    }


    // return true if yes, false if no
    beAskedToGive(item: Item, asker: Person, doTell: boolean) {
      var tell = this.adventure.tell;

      if ((this.wantsToGive[item.id] || {})[asker.id]) {
        if (doTell) {
          tell(this, 'You have given ' + this.nameFor(item) + ' to ' + this.nameFor(asker) + '.');
          if (this !== asker) {
            tell(asker, asker.nameFor(this) + ' ' + this.have + ' given you ' + asker.nameFor(item) + '.');
          }
        }
        return true;
      }

      if (doTell) {
        tell(asker, capitalize(
          asker.nameFor(this, this.definiteName, "You")) + " won't let you take " + asker.nameFor(item) +
          ".");
        if (this !== asker)
          tell(this, function(askee) {
            return capitalize(askee.nameFor(asker)) + ' ' + asker.verb('try') + ' to take ' + askee.nameFor(
              item) +
              ' from you, but you don\'t let ' + asker.them + '.';
          });
      }
      return false;
    };

    beAskedToTake(item: Item, asker: Person, doTell: boolean) {
      var tell = this.adventure.tell;

      if (this.wantsToTake[item.id]) {
        if (doTell) {
          tell(asker, 'You have given ' + asker.nameFor(item) + ' to ' + asker.nameFor(this) + '.');
          if (this !== asker) {
            tell(this, this.nameFor(asker) + ' ' + asker.have + ' given you ' + this.nameFor(item) + '.');
          }
        }
        return true;
      }
      if (doTell) {
        tell(asker,
          capitalize(asker.nameFor(this, this.definiteName + " " + this.verb('do'), "You do") +
            "n't want to take " +
            ((this === item) ? asker.nameFor(item, item.themselves) : asker.nameFor(item) + ".")));
        if (this !== asker) {
          var askee = this;
          tell(this, function() {
            return capitalize(askee.nameFor(asker)) + ' ' + asker.verb('try') + ' to give ' +
              askee.nameFor(item) + ' to you, but you don\'t take ' + item.them + '.';
          });
        }
      }
      return false;
    };

    setKnown(object: Item, value?: boolean) {
      if (Array.isArray(object)) {
        var person = this;
        object.forEach(function(object) {
          person.setKnown(object, value);
        });
      }
      if (typeof value === 'undefined') value = true;
      // TODO performance penalty here?
      this.knownItems = this.knownItems.filter(function(it) {
        return it !== object;
      });
      if (value) this.knownItems.push(object);
    };

    isKnown(object: Item) {
      return this.knownItems.indexOf(object) != -1;
    };


    consumeInformationQueue() {
      if (!this.playableCharacter) return '';
      if (!this.informationQueue) return '';
      var ret = this.informationQueue.join('\n').replace(/\n+[\b]/g, '') + '\n';
      this.informationQueue = [];
      return ret;
    };

    learn(info: string | ((item: Item) => string)) {
      if (!this.playableCharacter) return '';
      if (!this.informationQueue) this.informationQueue = [];
      var i: string;
      if (typeof info === 'string') {
        i = info;
        info = function() {
          return i;
        };
      }
      try {
        this.adventure.you = this;
        i = info(this);
      } finally {
        this.adventure.you = null;
      }
      if (i) this.informationQueue.push(i);
    };

    nameFor(item: Item, name?: string, youName?: string) {
      name = name || (this.isKnown(item) ? item.definiteName : item.indefiniteName);
      this.setKnown(item);
      if (this !== item) return name;
      return youName || 'yourself';
    }

    use(item: Item) { };
    go(exit: Exit) { };
  }


  var expandTemplates = function(templates: string[]) {
    if (!templates.length) return [];
    var expandTemplate = function expandTemplate(t: string): SetOfStrings {
      t = t.replace(/\|+/g, '|').replace(/\s\|\s/g, '').replace(/[^a-z0-9|%\s]/gi, '').
        replace(/([^\s|])%/g, '$1').replace(/%(?![id]\d*([\s|]|$))/gi, '').replace(/\s+/g, ' ').trim();
      var b = t.indexOf('|');
      if (b < 0) {
        var ret: SetOfStrings = {};
        ret[t] = true;
        return ret;
      }
      var s1 = t.substring(0, b).lastIndexOf(' ') + 1;
      var s2 = (t + ' ').indexOf(' ', b);
      var t1 = t.substring(0, s1) + t.substring(b + 1);
      var t2 = t.substring(0, b) + t.substring(s2);
      return Object.assign(expandTemplate(t2), expandTemplate(t1));
    };
    return Object.keys(Object.assign.apply({}, templates.map(expandTemplate)));

  };

  interface CommandOptions {
    methodName: string;
    templates: string[] | string;
    command: ((this: Person, ...args: any[]) => any) | {
      youCant?: string;
      mustSee?: boolean;
      mustHave?: boolean;
      objectMethodName?: string;
    };
    help?: string;
  }
  interface Command {
    (this: Person, ...args: any[]): any;
    methodName: string;
    help?: string;
    templates: string[];
  }






  class Exit extends Item {
    direction: keyof Dictionary<Direction>;
    forwardExit: Exit;
    reverseExit?: Exit;
    isForwardExit?: boolean;
    isReverseExit?: boolean;
    otherWay?: Exit;
    destination: Place;
    noExit?: boolean;

    constructor(adventure: Adventure,
      options: Partial<MaybePropertiesMarked<Exit & { reverse: false | string | Partial<MaybePropertiesMarked<Exit>> }>>) {

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
      options.wantsToGive = immutable({}); // exits don't take or give anything (serialization)
      options.wantsToTake = immutable({}); // exits don't take or give anything (serialization)
      // destination should be managed as a getter/setter that takes objects or ids, like location
      var destinationMarked = immutable(options.destination);
      delete options.destination;
      var destinationIsImmutable = !(destinationMarked.mutable);
      var destination = unwrap(destinationMarked);


      var reverse = unwrap(options.reverse);
      delete options.reverse;

      if (reverse !== false) {


        if (!reverse) {
          reverse = {};
        } else if (typeof reverse == 'string') {
          reverse = {
            direction: reverse
          };
        }

        // TODO oppositeId may be false... if so, we should do something to 'oppositeId'

        if (!reverse.direction) {
          var dir = adventure.directions[unwrap(options.direction)];
          var oppositeId = dir ? dir.oppositeId : false;
          if (!oppositeId) throw new Error('need reverse direction for exit');
          reverse.direction = oppositeId;
        }
        reverse.direction = immutable(reverse.direction);

        if (('id' in reverse) && (unwrap(reverse.id) in adventure.itemMap)) throw new Error('Cannot reuse id ' + unwrap(
          reverse
            .id) +
          ' for reverse.id');

        reverse.id = immutable(reverse.id || adventure.getNewId((unwrap(reverse.name) || name) + '-reverse'));

        var reversePronoun = ('pronoun' in reverse) ? unwrap(reverse.pronoun) : (('pronoun' in options) ? unwrap(
          options.pronoun) :
          'it');

        if ('name' in reverse || 'pronoun' in reverse) {
          reverse.name = immutable(reverse.name || name);
          var defaultNames = getDefaultNames(unwrap(reverse.name), reversePronoun);
          reverse.keywords = immutable(reverse.keywords || defaultNames.keywords);
          reverse.definiteName = immutable(reverse.definiteName || defaultNames.definiteName);
          reverse.indefiniteName = immutable(reverse.indefiniteName || defaultNames.indefiniteName);
          reverse.pluralName = immutable(reverse.pluralName || defaultNames.pluralName);
          reverse.pronoun = immutable(reversePronoun);
        }

        var r = reverse;
        (['description', 'keywords', 'definiteName', 'indefiniteName', 'pluralName', 'pronoun', 'canBeTaken',
          'hidden',
          'unlisted'
        ] as ['description', 'keywords', 'definiteName', 'indefiniteName', 'pluralName', 'pronoun', 'canBeTaken',
            'hidden',
            'unlisted'
          ]).forEach(k => {
            if (k in r) r[k] = immutable(r[k] as any); // explicit any type since type checker can't distribute 
            // mutability marker across unions
          });

        // unchangable options
        options.isForwardExit = immutable(true);
        options.isReverseExit = immutable(false);
        reverse.isForwardExit = immutable(false);
        reverse.isReverseExit = immutable(true);

        if ('location' in reverse) throw new Error(
          'Do not specify location of reverse exit; it will automatically be the same as the exit destination');
        if ('destination' in reverse) throw new Error(
          'Do not specify destination of reverse exit; it will automatically be the same as the exit location');

        var immutableProperties = {};
        reverse.getImmutableProperties = function() {
          return immutableProperties;
        };
        setOptions(reverse as Exit, reverse);
        // as of now, reverse is an object holding onto these properties

      }

      super(adventure, options, false);

      var o:PropertyDescriptor = {
        configurable: false,
        enumerable: true,
        get: function() {
          var ret = destination as Place | string;
          if (typeof ret === 'string') ret = adventure.itemMap[ret];
          if (!ret) ret = null;
          return ret;
        }
      };
      if (!destinationIsImmutable) {
        o['set'] = function(l) {
          destination = l;
        };
      }
      Object.defineProperty(this, 'destination', o);

      if (destinationIsImmutable) this.getImmutableProperties().destination = true;

      if (reverse) {

        this.forwardExit = this;
        var reverseExit = Object.create(this);
        this.reverseExit = reverseExit;
        this.otherWay = reverseExit;
        reverseExit.otherWay = this;
        this.getImmutableProperties().forwardExit = true;
        this.getImmutableProperties().reverseExit = true;
        this.getImmutableProperties().otherWay = true;

        adventure.itemMap[(reverse as Exit).id] = reverseExit;

        var forwardExit = this;
        reverse.serialize = this.serialize.bind(reverse);
        reverse.deserialize = this.deserialize.bind(reverse);
        /*reverse.getImmutableProperties = function() {
          return immutableProperties;
        };*/

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

        var mergedKeyObj = {} as SetOfStrings;
        Object.keys(this).forEach(function(k) {
          mergedKeyObj[k] = true;
        });
        Object.keys(reverse).forEach(function(k) {
          mergedKeyObj[k] = true;
        });

        Object.keys(mergedKeyObj).forEach(function<K extends keyof Exit>(k: K) {
          if ((k == 'location') || (k == 'destination')) return;
          var get;
          var set;
          if (k in r) {
            get = function() {
              return r[k];
            };
            set = function(v: Exit[keyof Exit]) {
              r[k] = v;
            };
          } else {
            get = function() {
              return forwardExit[k];
            };
            set = function(v: Exit[keyof Exit]) {
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

        enforceImmutables(reverse as Exit);
        Object.seal(reverseExit);
        enforceImmutables(this);
      }
    }


    getDistinguishingName(indefinite: boolean) {
      var ret = indefinite ? this.indefiniteName : this.definiteName;
      if (!this.location) return ret;
      if (!this.direction) return ret;
      var name = this.name;
      var exitsOfSameType = this.location.getExits().filter(function(ex) {
        return ex.name === name;
      });
      if (exitsOfSameType.length < 2) return ret;
      ret += ' leading ' + this.adventure.directionName(this.direction);
      return ret;
    };
    beUsedBy(subject: Person) {
      var tell = this.adventure.tell;
      var exitName = this.definiteName + (this.direction ? ' leading ' + this.adventure.directionName(this.direction) :
        '');
      var ret = 'You use ' + exitName + '.\n';

      var exit = this;
      tell(subject, ret, function(witness) {
        return capitalize(subject.definiteName) + ' ' + subject.verb('leave') + ' ' + exit.location.definiteName +
          ' through ' + exitName + '.';
      });

      subject.location = this.destination;

      var otherWayName = this.otherWay ? ' through ' + this.otherWay.definiteName + (this.otherWay.direction ?
        ' leading ' + this.adventure.directionName(this.otherWay.direction) : '') : '';

      tell(subject, null, function(witness) {
        return capitalize(subject.definiteName) + ' ' + subject.verb('enter') + ' ' + exit.destination.definiteName +
          otherWayName + '.';
      });

      subject.look();
    };
    beExaminedBy(subject: Person) {
      var tell = this.adventure.tell;
      if (this.description) {
        tell(subject, this.description);
        return;
      }
      var exitName = this.getDistinguishingName(true);
      tell(subject, capitalize(this.theyre) + ' ' + exitName + '.');
    };
  }


  // some nice defaults?
  export var openableExitOptions = {
    open: true,
    beOpenedBy: function(subject: Person) {
      if (this.open) {
        this.adventure.tell(subject, "It's already open.");
        return;
      }
      this.open = true;
      var exitName = this.getDistinguishingName();
      var info = function(person: Person) {
        return capitalize(subject.definiteName) + ' ' + subject.have + ' opened ' + exitName + '.';
      };
      this.adventure.tell(subject, info, info);
    },
    beClosedBy: function(subject: Person) {
      if (!this.open) {
        this.adventure.tell(subject, "It's already closed.");
        return;
      }
      this.open = false;
      var exitName = this.getDistinguishingName();
      var info = function(person: Person) {
        return capitalize(subject.definiteName) + ' ' + subject.have + ' closed ' + exitName + '.';
      };
      this.adventure.tell(subject, info, info);
    },
    beUsedBy: function(subject: Person) {
      if (!this.open) {
        var exit = this;
        this.adventure.tell(subject, capitalize(this.getDistinguishingName()) + " is closed.");
        return;
      }
      this.superMethod('beUsedBy')(subject);
    },
    beExaminedBy: function(subject: Person) {
      this.superMethod('beExaminedBy')(subject);
      var exit = this;
      this.adventure.tell(subject, '\b ' + capitalize(this.they) + ' ' + this.are + ' ' + (this.open ? 'open' :
        'closed') + '.');
    },
    beUnlockedBy: function(subject: Person) {
      this.adventure.tell(subject, "There's no lock.");
    },
    beLockedBy: function(subject: Person) {
      this.adventure.tell(subject, "It doesn't lock.");
    },
    bePulledBy: function(subject: Person) {
      this.isForwardExit ? this.beOpenedBy(subject) : this.beClosedBy(subject);
    },
    bePushedBy: function(subject: Person) {
      this.isReverseExit ? this.beOpenedBy(subject) : this.beClosedBy(subject);
    }
  };

  export var lockableExitOptions = {
    unlocked: true,
    beOpenedBy: function(subject: Person) {
      if (this.unlocked) {
        openableExitOptions.beOpenedBy.call(this, subject);
        return;
      }
      this.adventure.tell(subject, capitalize(this.getDistinguishingName()) + " is locked.");
    },
    beUsedBy: function(subject: Person) {
      if (!this.unlocked) {
        this.adventure.tell(subject, capitalize(this.getDistinguishingName()) + " is locked.");
        return;
      }
      openableExitOptions.beUsedBy.call(this, subject);
    },
    beExaminedBy: function(subject: Person) {
      this.superMethod('beExaminedBy')(subject);
      var ret = '\b ' + capitalize(this.they) + ' ' + this.are + ' ' + (this.open ? 'open.' : ('closed and ' +
        (this.unlocked ? 'un' : '') + 'locked.'));
      ret += ' ' + capitalize(this.they) + ' ' + (this.unlocked ? '' : 'un') + this.verb('lock') + ' from ' +
        (this.isForwardExit ?
          'this' : 'the other') + ' side.';
      this.adventure.tell(subject, ret);
    },
    beUnlockedBy: function(subject: Person) {
      if (this.unlocked) {
        this.adventure.tell(subject, capitalize(this.theyre) + " already unlocked.");
        return;
      }
      if (this.isReverseExit) {
        this.adventure.tell(subject, "You can't unlock " + this.them + " from this side.");
        return;
      }
      this.unlocked = true;
      var exitName = this.getDistinguishingName();
      var info = function(person: Person) {
        return capitalize(subject.definiteName) + ' ' + subject.have + ' unlocked ' + exitName + '.';
      };
      this.adventure.tell(subject, info, info);
    },
    beLockedBy: function(subject: Person) {
      if (this.open) {
        this.adventure.tell(subject, "You have to close " + this.them + " first.");
        return;
      }
      if (!this.unlocked) {
        this.adventure.tell(subject, capitalize(this.theyre) + " already locked.");
        return;
      }
      if (this.isReverseExit) {
        this.adventure.tell(subject, "You can't lock " + this.them + " from this side.");
        return;
      }
      this.unlocked = false;
      var exitName = this.getDistinguishingName();
      var info = function(person: Person) {
        return capitalize(subject.definiteName) + ' ' + subject.have + ' locked ' + exitName + '.';
      };
      this.adventure.tell(subject, info, info);
    }
  };


}
