/*
    Compiler common function
 */

var fs = require('fs'),
    path = require('path'),
    projectSettings = require('../projectSettings.js'),
    fileWatcher = require('../fileWatcher.js');

/**
 * get LESS/Sass @import files
 * @param  {String} lang
 * @param  {String} srcFile
 * @return {Object}
 */
function getOrWatchStyleImports (lang, srcFile, deepWatch, deepLevel) {
    //match imports from code
    var result = [],
        code = fs.readFileSync(srcFile, 'utf8');

    code = code.replace(/\/\/.+?[\r\t\n]/g, '').replace(/\/\*[\s\S]+?\*\//g, '');

    var imports = code.match(/@import.+?[\"\'](.+?)[\"\']/g) || [];

    if (imports.length === 0) return [];

    var matchs;
    imports.forEach(function (item, index) {
        matchs = item.match(/.+?[\"\'](.+?)[\"\']/) || [];
        item = matchs[1];

        if (!item) return false;

        if (/.less|.sass|.scss/.test(path.extname(item)) || path.extname(item) === '') {
            result.push(item);
        }
    });

    //get fullpath of imports
    var dirname = path.dirname(srcFile),
        extname = path.extname(srcFile),
        fullPathImports = [];

    result.forEach(function (item) {
        if (path.extname(item) !== extname) {
            item += extname;
        }
        var file = path.resolve(dirname, item);

        // the '_' is omittable sass imported file
        if (lang === 'sass' && path.basename(item).indexOf('_') === -1) {
            var temPath = path.resolve(path.dirname(file), '_' + path.basename(item));
            if (fs.existsSync(temPath)) {
                file = temPath;
            }
        }

        if (fs.existsSync(file)) fullPathImports.push(file);
    });

    if (deepWatch && deepLevel <= 5) {

        fileWatcher.addImports(fullPathImports, srcFile);

        deepLevel ++;

        fullPathImports.forEach(function (item) {
            exports.getStyleImports(lang, item, deepWatch, deepLevel);
        });
        return false;
    }

    return fullPathImports;
}

exports.getStyleImports = getOrWatchStyleImports;

exports.watchImports = function (lang, srcFile) {
    getOrWatchStyleImports(lang, srcFile, true, 1);
};

/**
 * auto add vendor prefixes
 * @param  {object} file object
 */
exports.autoprefix = function (file, done) {
    var cssFile = file.output,
        css = fs.readFileSync(cssFile);

    exports.autoprefixCSS(file.settings, css, function(css) {
        if (file.settings.sourceMap) {
            css = css + '\n/*# sourceMappingURL=' + path.basename(cssFile) + '.map */';
        }

        fs.writeFileSync(cssFile, css);

        done();
    });
};

exports.autoprefixCSS = function (settings, css, done) {
    var autoprefixer = require('autoprefixer'),
        postcss = require('postcss');

    var config = exports.getAutoprefixConfig(settings.autoprefixConfig);
    postcss([autoprefixer(config)]).process(css).then(function(result) {
        done(result.css);
    });
};

exports.getAutoprefixConfig = function (config) {
    var browsers = [];
    if (config && typeof(config) === 'string') {
        config = config.split(',').forEach(function (item) {
            item = item.trim();
            if (item) {
                browsers.push(item);
            }
        });
    }

    return browsers.length ? {browsers: browsers} : null;
};