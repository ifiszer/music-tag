(function () {
	'use strict';

	var fs = require('fs'),
		_ = require('underscore'),
		Q = require('q');

	var TagReader = require('./tag_reader'),
		TagExtractor = require('./tag_extractor'),
		Utils = require('./utils');

	var defaultOptions = {
		recursive: true
	};

	var read = function (path, options) {
		var deferred = Q.defer();

		var validParameters = false;
		if(!_.isString(path)) {
			deferred.reject(new Error('Invalid path argument: ' + path));
		} else if(_.isUndefined(options)) {
			options = _.clone(defaultOptions);
			validParameters = true;
		} else if(_.isObject(options)) {
			options = _.extend(_.clone(defaultOptions), options);
			validParameters = true;
		} else {
			deferred.reject(new Error('Invalid options argument: ' + options));
		}

		if(validParameters) {
			Q.all([Utils.validatePath(path), Utils.resolvePath(path)]).then(function(results) {
				var pathData = results[0];
				var fullPath = results[1];

				if(pathData.isFile && Utils.isMusicFile(fullPath)) {
					readFile(fullPath).then(function(readResult) {
						deferred.resolve(readResult);
					}).fail(deferred.reject);
				} else if(pathData.isDirectory) {
					readFolder(fullPath, options.recursive).then(function(readResults) {
						deferred.resolve(readResults);
					}).fail(deferred.reject)
				} else {
					deferred.reject(new Error('Invalid path argument: ' + fullPath));
				}
			}).fail(deferred.reject);
		}

		return deferred.promise;
	};

	var readFile = function (path) {
		var deferred = Q.defer();
		TagReader.read(path).then(function (tag_buffer) {
			var tags = TagExtractor.extract(tag_buffer);
			deferred.resolve(ReadResult(path, tags));
		}).fail(function (err) {
			if (err === 'NO_ID3') {
				deferred.resolve(ReadResult(path, {}));
			} else {
				deferred.reject(new Error(err));
			}
		});

		return deferred.promise;
	};

	var readFolder = function (path, recursive) {
		var deferred = Q.defer();

		Utils.getFiles(path, recursive).then(function(files) {
			var promises = _.map(files, function(file) {
				if(file.isFile) {
					return readFile(file.path);
				} else {
					return readFolder(file.path, recursive);
				}
			});
			Q.all(promises).then(function(results) {
				deferred.resolve(_.flatten(results));
			}).fail(deferred.reject);
		}).fail(deferred.reject);

		return deferred.promise;
	};

	var ReadResult = function (path, data) {
		return {
			path: path,
			data: data
		};
	};

	module.exports = {
		read: read
	};
})();

