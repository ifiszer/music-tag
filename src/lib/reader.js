(function () {
	'use strict';

	var id3 = require('./id3');
	var fs = require('fs');
	var _ = require('underscore');
	var Q = require('q');

	var TagReader = require('./tag_reader'),
		TagExtractor = require('./tag_extractor'),
		Utils = require('./utils');

	var defaultOptions = {
		recursive: true
	};

	var read = function (path) {
		var options = _.clone(defaultOptions);
		if (_.isString(path)) {
			options.path = {
				path: path
			};
		} else if (_.isObject(path)) {
			options = _.extend(options, path);
			if(!_.isObject(options.path)) {
				options.path = {
					path: path.path
				};
			}
		} else {

		}

		var actions = [Utils.validatePath, Utils.resolvePath, readPath];

		return _.reduce(actions, Q.when, Q(options));
	};

	var readPath = function (options) {
		if (options.path.isDirectory) {
			return readFolder(options);
		} else if (options.path.isFile && isMusicFile(options.path.fullPath)) {
			return readFile(options);
		} else {
			throw new Error('Unable to recognize path: ' + data.path);
		}
	};

	var readFile = function (options) {
		var deferred = Q.defer();

		TagReader.read(options.path.fullPath, function (err, tag_buffer) {
			if (err) {
				if (err === 'NO_ID3') {
					deferred.resolve(ReadResult(options.path.fullPath, {}));
				}
				deferred.reject(new Error(err));
			} else {
				var tags = TagExtractor.extract(tag_buffer);
				deferred.resolve(ReadResult(options.path.fullPath, tags));
			}
		});

		return deferred.promise;
	};

	var readFolder = function (options) {
		var actions = [getFiles, readPaths];

		var deferred = Q.defer();
		_.reduce(actions, Q.when, Q(options)).then(function (results) {
			deferred.resolve(_.flatten(results));
		}).fail(function (err) {
			deferred.reject(new Error(err));
		});

		return deferred.promise;
	};

	var getFiles = function (options) {
		var deferred = Q.defer();

		fs.readdir(options.path.fullPath, function (err, files) {
			if (err) {
				deferred.reject(new Error(err));
			} else {
				options.files = _.map(files, _.partial(addPath, options.path.fullPath));
				deferred.resolve(options);
			}
		});

		return deferred.promise;
	};

	var readPaths = function (options) {
		var promises = _.chain(options.files)
			.filter(function (file) {
				return isMusicFile(file) || (options.recursive && isDirectory(file));
			})
			.map(function (path) {
				var pathOptions = _.omit(options, ['files']);
				pathOptions.path = path;

				return read(pathOptions);
			}).value();

		return Q.all(promises);
	};

	var addPath = function (path, file) {
		return normalizePath(path) + file;
	};

	var normalizePath = function (path) {
		return (path.toString().endsWith('/') ? path : path + '/');
	};

	var isMusicFile = function (filepath) {
		var regex = /.+.(mp3|flac|wav)/i;
		return filepath.toString().match(regex) !== null;
	};

	var isDirectory = function (path) {
		return path.toString().endsWith('/') || path.toString().match(/^.+\/[^\.]+$/) !== null;
	};

	var ReadResult = function(path, data) {
		return {
			path: path,
			data: data
		};
	};

	module.exports = {
		read: read
	};
})();
