const EventEmitter = require("events");
const chalk = require("chalk");
const semver = require("semver");
const { DateTime } = require("luxon");
const debug = require("debug")("Eleventy:UserConfig");
const pkg = require("../package.json");

// API to expose configuration options in config file
class UserConfig {
  constructor() {
    this.reset();
  }

  reset() {
    debug("Resetting EleventyConfig to initial values.");
    this.events = new EventEmitter();
    this.collections = {};

    this.liquidOptions = {};
    this.liquidTags = {};
    this.liquidFilters = {};
    this.liquidShortcodes = {};
    this.liquidPairedShortcodes = {};
    this.nunjucksFilters = {};
    this.nunjucksAsyncFilters = {};
    this.nunjucksTags = {};
    this.nunjucksShortcodes = {};
    this.nunjucksPairedShortcodes = {};
    this.handlebarsHelpers = {};
    this.handlebarsShortcodes = {};
    this.handlebarsPairedShortcodes = {};
    this.passthroughCopies = {};
    this.pugOptions = {};
    this.ejsOptions = {};
    this.markdownHighlighter = null;
    this.libraryOverrides = {};

    this.layoutAliases = {};
    // now named `transforms` in API
    this.filters = {};
    this.activeNamespace = "";
    this.DateTime = DateTime;
    this.dynamicPermalinks = true;
    this.useGitIgnore = true;
  }

  versionCheck(expected) {
    if (!semver.satisfies(pkg.version, expected)) {
      throw new Error(
        `This project requires the eleventy version to match '${expected}' but found ${
          pkg.version
        }. Use \`npm update @11ty/eleventy -g\` to upgrade the eleventy global or \`npm update @11ty/eleventy --save\` to upgrade your local project version.`
      );
    }
  }

  on(eventName, callback) {
    return this.events.on(eventName, callback);
  }

  emit(eventName, ...args) {
    return this.events.emit(eventName, ...args);
  }

  // This is a method for plugins, probably shouldn’t use this in projects.
  // Projects should use `setLibrary` as documented here:
  // https://github.com/11ty/eleventy/blob/master/docs/engines/markdown.md#use-your-own-options
  addMarkdownHighlighter(highlightFn) {
    this.markdownHighlighter = highlightFn;
  }

  // tagCallback: function(liquidEngine) { return { parse: …, render: … }} };
  addLiquidTag(name, tagFn) {
    name = this.getNamespacedName(name);

    if (typeof tagFn !== "function") {
      throw new Error(
        `EleventyConfig.addLiquidTag expects a callback function to be passed in for ${name}: addLiquidTag(name, function(liquidEngine) { return { parse: …, render: … } })`
      );
    }

    if (this.liquidTags[name]) {
      debug(
        chalk.yellow(
          "Warning, overwriting a Liquid tag with `addLiquidTag(%o)`"
        ),
        name
      );
    }
    this.liquidTags[name] = tagFn;
  }

  addLiquidFilter(name, callback) {
    name = this.getNamespacedName(name);

    if (this.liquidFilters[name]) {
      debug(
        chalk.yellow(
          "Warning, overwriting a Liquid filter with `addLiquidFilter(%o)`"
        ),
        name
      );
    }

    this.liquidFilters[name] = callback;
  }

  addNunjucksAsyncFilter(name, callback) {
    name = this.getNamespacedName(name);

    if (this.nunjucksAsyncFilters[name]) {
      debug(
        chalk.yellow(
          "Warning, overwriting a Nunjucks filter with `addNunjucksAsyncFilter(%o)`"
        ),
        name
      );
    }

    this.nunjucksAsyncFilters[name] = callback;
  }

  // Support the nunjucks style syntax for asynchronous filter add
  addNunjucksFilter(name, callback, isAsync) {
    if (isAsync) {
      this.addNunjucksAsyncFilter(name, callback);
    } else {
      name = this.getNamespacedName(name);

      if (this.nunjucksFilters[name]) {
        debug(
          chalk.yellow(
            "Warning, overwriting a Nunjucks filter with `addNunjucksFilter(%o)`"
          ),
          name
        );
      }

      this.nunjucksFilters[name] = callback;
    }
  }

  addHandlebarsHelper(name, callback) {
    name = this.getNamespacedName(name);

    if (this.handlebarsHelpers[name]) {
      debug(
        chalk.yellow(
          "Warning, overwriting a Handlebars helper with `addHandlebarsHelper(%o)`."
        ),
        name
      );
    }

    this.handlebarsHelpers[name] = callback;
  }

  addFilter(name, callback) {
    debug("Adding universal filter %o", this.getNamespacedName(name));
    this.addLiquidFilter(name, callback);
    this.addNunjucksFilter(name, callback);

    // TODO remove Handlebars helpers in Universal Filters. Use shortcodes instead (the Handlebars template syntax is the same).
    this.addHandlebarsHelper(name, callback);
  }

  addNunjucksTag(name, tagFn) {
    name = this.getNamespacedName(name);

    if (typeof tagFn !== "function") {
      throw new Error(
        `EleventyConfig.addNunjucksTag expects a callback function to be passed in for ${name}: addNunjucksTag(name, function(nunjucksEngine) {})`
      );
    }

    if (this.nunjucksTags[name]) {
      debug(
        chalk.yellow(
          "Warning, overwriting a Nunjucks tag with `addNunjucksTag(%o)`"
        ),
        name
      );
    }

    this.nunjucksTags[name] = tagFn;
  }

  addTransform(name, callback) {
    name = this.getNamespacedName(name);

    this.filters[name] = callback;
  }

  addLayoutAlias(from, to) {
    this.layoutAliases[from] = to;
  }

  // get config defined collections
  getCollections() {
    return this.collections;
  }

  addCollection(name, callback) {
    name = this.getNamespacedName(name);

    if (this.collections[name]) {
      throw new Error(
        `config.addCollection(${name}) already exists. Try a different name for your collection.`
      );
    }

    this.collections[name] = callback;
  }

  addPlugin(pluginCallback) {
    debug("Adding plugin (unknown name: check your config file).");
    if (typeof pluginCallback !== "function") {
      throw new Error(
        "EleventyConfig.addPlugin expects the first argument to be a function."
      );
    }

    pluginCallback(this);
  }

  getNamespacedName(name) {
    return this.activeNamespace + name;
  }

  namespace(pluginNamespace, callback) {
    this.activeNamespace = pluginNamespace || "";
    callback();
    this.activeNamespace = "";
  }

  /**
   * Adds a path to a file or directory to the list of pass-through copies
   * which are copied as-is to the output.
   *
   * @param {String} fileOrDir The path to the file or directory that should
   * be copied.
   * @returns {any} a reference to the `EleventyConfig` object.
   * @memberof EleventyConfig
   */
  addPassthroughCopy(fileOrDir) {
    this.passthroughCopies[fileOrDir] = true;

    return this;
  }

  setTemplateFormats(templateFormats) {
    if (typeof templateFormats === "string") {
      templateFormats = templateFormats.split(",").map(format => format.trim());
    }

    this.templateFormats = templateFormats;
  }

  setLibrary(engineName, libraryInstance) {
    // Pug options are passed to `compile` and not in the library constructor so we don’t need to warn
    if (engineName === "liquid" && this.mdOptions) {
      debug(
        "WARNING: using `eleventyConfig.setLibrary` will override any configuration set using `.setLiquidOptions` or with the `liquidOptions` key in the config object. You’ll need to pass these options to the library yourself."
      );
    }

    this.libraryOverrides[engineName.toLowerCase()] = libraryInstance;
  }

  setPugOptions(options) {
    this.pugOptions = options;
  }

  setLiquidOptions(options) {
    this.liquidOptions = options;
  }

  setEjsOptions(options) {
    this.ejsOptions = options;
  }

  setDynamicPermalinks(enabled) {
    this.dynamicPermalinks = !!enabled;
  }

  setUseGitIgnore(enabled) {
    this.useGitIgnore = !!enabled;
  }

  addShortcode(name, callback) {
    debug("Adding universal shortcode %o", this.getNamespacedName(name));
    this.addNunjucksShortcode(name, callback);
    this.addLiquidShortcode(name, callback);
    this.addHandlebarsShortcode(name, callback);
  }

  addNunjucksShortcode(name, callback) {
    if (this.nunjucksShortcodes[name]) {
      debug(
        chalk.yellow(
          "Warning, overwriting a Nunjucks Shortcode with `addNunjucksShortcode(%o)`"
        ),
        name
      );
    }

    this.nunjucksShortcodes[name] = callback;
  }

  addLiquidShortcode(name, callback) {
    if (this.liquidShortcodes[name]) {
      debug(
        chalk.yellow(
          "Warning, overwriting a Liquid Shortcode with `addLiquidShortcode(%o)`"
        ),
        name
      );
    }

    this.liquidShortcodes[name] = callback;
  }

  addHandlebarsShortcode(name, callback) {
    if (this.handlebarsShortcodes[name]) {
      debug(
        chalk.yellow(
          "Warning, overwriting a Handlebars Shortcode with `addHandlebarsShortcode(%o)`"
        ),
        name
      );
    }

    this.handlebarsShortcodes[name] = callback;
  }

  addPairedShortcode(name, callback) {
    this.addPairedNunjucksShortcode(name, callback);
    this.addPairedLiquidShortcode(name, callback);
    this.addPairedHandlebarsShortcode(name, callback);
  }

  addPairedNunjucksShortcode(name, callback) {
    if (this.nunjucksPairedShortcodes[name]) {
      debug(
        chalk.yellow(
          "Warning, overwriting a Nunjucks Paired Shortcode with `addPairedNunjucksShortcode(%o)`"
        ),
        name
      );
    }

    this.nunjucksPairedShortcodes[name] = callback;
  }

  addPairedLiquidShortcode(name, callback) {
    if (this.liquidPairedShortcodes[name]) {
      debug(
        chalk.yellow(
          "Warning, overwriting a Liquid Paired Shortcode with `addPairedLiquidShortcode(%o)`"
        ),
        name
      );
    }

    this.liquidPairedShortcodes[name] = callback;
  }

  addPairedHandlebarsShortcode(name, callback) {
    if (this.handlebarsPairedShortcodes[name]) {
      debug(
        chalk.yellow(
          "Warning, overwriting a Handlebars Paired Shortcode with `addPairedHandlebarsShortcode(%o)`"
        ),
        name
      );
    }

    this.handlebarsPairedShortcodes[name] = callback;
  }

  getMergingConfigObject() {
    return {
      templateFormats: this.templateFormats,
      filters: this.filters,
      layoutAliases: this.layoutAliases,
      passthroughCopies: this.passthroughCopies,
      liquidOptions: this.liquidOptions,
      liquidTags: this.liquidTags,
      liquidFilters: this.liquidFilters,
      liquidShortcodes: this.liquidShortcodes,
      liquidPairedShortcodes: this.liquidPairedShortcodes,
      nunjucksFilters: this.nunjucksFilters,
      nunjucksAsyncFilters: this.nunjucksAsyncFilters,
      nunjucksTags: this.nunjucksTags,
      nunjucksShortcodes: this.nunjucksShortcodes,
      nunjucksPairedShortcodes: this.nunjucksPairedShortcodes,
      handlebarsHelpers: this.handlebarsHelpers,
      handlebarsShortcodes: this.handlebarsShortcodes,
      handlebarsPairedShortcodes: this.handlebarsPairedShortcodes,
      pugOptions: this.pugOptions,
      ejsOptions: this.ejsOptions,
      markdownHighlighter: this.markdownHighlighter,
      libraryOverrides: this.libraryOverrides,
      dynamicPermalinks: this.dynamicPermalinks,
      useGitIgnore: this.useGitIgnore
    };
  }
}

module.exports = UserConfig;
