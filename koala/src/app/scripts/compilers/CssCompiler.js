/**
 * CSS min compiler
 */
'use strict';

var fs          = require('fs-extra'),
    path        = require('path'),
    FileManager = global.getFileManager(),
    common      = require('./common.js'),
    Compiler    = require(FileManager.appScriptsDir + '/Compiler.js');

/**
 * CSS Compiler
 * @param {object} config compiler config
 */
function CssCompiler(config) {
   Compiler.call(this, config);
}
require('util').inherits(CssCompiler, Compiler);

module.exports = CssCompiler;

/**
 * compile css file
 * @param  {Object} file    compile file object
 * @param  {Object} emitter  compile event emitter
 */
CssCompiler.prototype.compile = function(file, emitter) {
    var CleanCSS = require('clean-css');
    var rootPath = path.dirname(file.src);
    var self = this;

    var options = {
        rebaseTo: rootPath,
        inline: file.settings.combineImport ? 'local' : 'none',
    };

    if (file.settings.outputStyle != "yuicompress") {
        options.format = 'keep-breaks';
    }

    var result = new CleanCSS(options).minify({[file.src]: {styles: fs.readFileSync(file.src, 'utf-8')}});

    if (file.settings.autoprefix) {
        common.autoprefixCSS(file.settings, result.styles, outputCSS);
    } else {
        outputCSS(result.styles);
    }

    function outputCSS(css) {
        // convert background image to base64 & append timestamp
        var resultCss = convertImageUrl(result.styles, rootPath, file.settings.appendTimestamp);

        if (file.settings.combineImport && result.inlinedStylesheets.length > 1) {
            self.watchImports(result.inlinedStylesheets.slice(1), file.src);
        }

        fs.outputFile(file.output, resultCss, function(err) {
            if (err) {
                emitter.emit('fail');
            } else {
                emitter.emit('done');
            }
            emitter.emit('always');
        });
    }
};


/**
 * convert external image file to data URIs
 * @param  {String}     css         css code
 * @param  {String}     rootPath    the css file path
 * @param  {Boolean}    timestamp   whether append timestamp
 * @return {String}                 the converted css code
 */
function convertImageUrl (css, rootPath, timestamp) {
    css = css.replace(/background.+?url.?\(.+?\)/gi, function (matchStr) {

        var str = matchStr,
            originalUrl = str.match(/url.?\((.+)\)/)[0];    // get original url

        var str = str.replace(/\'|\"/g, '').match(/url.?\((.+)\)/);

        // match result is null
        if (!str || !str[1]) {
            return matchStr;
        }

        str = str[1].trim();
        var url = str.split('?')[0],
        param = str.split('?')[1];

        if (param !== 'base64' && timestamp === true) {
            return matchStr.replace(originalUrl, 'url('+ url + '?' + createTimestamp() +')');
        }
        // not convert of absolute url
        else if (param !== 'base64' || url.indexOf('/') === 0 || url.indexOf('http') === 0) {
            return matchStr;
        }
        var dataUrl = img2base64(url, rootPath);

        // replace original url with dataurl
        return matchStr.replace(originalUrl, 'url('+ dataUrl +')');
    });
    return css;
}


/**
 * convert image to base64
 * @param  {url} image url
 * @param  {String} rootPath the css file path
 */
function img2base64(url, rootPath){
    var type = url.split('.').pop().toLowerCase(),
        prefix = 'data:image/' + type + ';base64,';

    var file = path.join(rootPath, url);
    try {
        var imageBuf = fs.readFileSync(file);
        return prefix + imageBuf.toString("base64");
    } catch(err) {
        // the file doesn't exist
        return url;
    }
}

/**
 * create timestamp
 */
function createTimestamp() {
    var date = new Date();
    var year = date.getFullYear().toString().substring(2,4);
    var mon = date.getMonth().toString().length == 2 ? date.getMonth()+1 : '0'+(date.getMonth()+1);
    var day = date.getDate().toString().length == 2 ? date.getDate() : '0'+date.getDate();
    var hour = date.getHours().toString().length == 2 ? date.getHours() : '0'+date.getHours();
    var min = date.getMinutes().toString().length == 2 ? date.getMinutes() : '0'+date.getMinutes();

    return year + mon + day + hour + min;
}