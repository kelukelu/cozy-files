// Generated by CoffeeScript 1.7.1
var CozyInstance, File, Folder, KB, MB, archiver, async, findFolder, getFolderPath, jade, log, moment, pathHelpers, publicfoldertemplate, sharing, updateParentModifDate;

jade = require('jade');

async = require('async');

archiver = require('archiver');

moment = require('moment');

log = require('printit')({
  prefix: 'folders'
});

sharing = require('../helpers/sharing');

pathHelpers = require('../helpers/path');

Folder = require('../models/folder');

File = require('../models/file');

CozyInstance = require('../models/cozy_instance');

publicfoldertemplate = require('path').join(__dirname, '../views/publicfolder.jade');

KB = 1024;

MB = KB * KB;

module.exports.fetch = function(req, res, next, id) {
  return Folder.request('all', {
    key: id
  }, function(err, folder) {
    if (err || !folder || folder.length === 0) {
      if (err) {
        return next(err);
      } else {
        return res.send({
          error: true,
          msg: 'File not found'
        }, 404);
      }
    } else {
      req.folder = folder[0];
      return next();
    }
  });
};

updateParentModifDate = function(folder, callback) {
  return Folder.byFullPath({
    key: folder.path
  }, (function(_this) {
    return function(err, parents) {
      var parent;
      if (err) {
        return callback(err);
      } else if (parents.length > 0) {
        parent = parents[0];
        parent.lastModification = moment().toISOString();
        return parent.save(callback);
      } else {
        return callback();
      }
    };
  })(this));
};

findFolder = function(id, callback) {
  return Folder.find(id, (function(_this) {
    return function(err, folder) {
      if (err || !folder) {
        return callback("Folder not found");
      } else {
        return callback(null, folder);
      }
    };
  })(this));
};

getFolderPath = function(id, cb) {
  if (id === 'root') {
    return cb(null, "");
  } else {
    return findFolder(id, function(err, folder) {
      if (err) {
        return cb(err);
      } else {
        return cb(null, folder.path + '/' + folder.name);
      }
    });
  }
};

module.exports.create = function(req, res, next) {
  var folder;
  folder = req.body;
  if ((!folder.name) || (folder.name === "")) {
    return next(new Error("Invalid arguments"));
  } else {
    return Folder.all((function(_this) {
      return function(err, folders) {
        var available, createFolder, fullPath, now, parent, parents;
        available = pathHelpers.checkIfPathAvailable(folder, folders);
        if (!available) {
          return res.send({
            error: true,
            msg: "This folder already exists"
          }, 400);
        } else {
          fullPath = folder.path;
          parents = folders.filter(function(tested) {
            return fullPath === tested.getFullPath();
          });
          now = moment().toISOString();
          createFolder = function() {
            folder.creationDate = now;
            folder.lastModification = now;
            return Folder.createNewFolder(folder, function(err, newFolder) {
              var who;
              if (err) {
                return next(err);
              }
              who = req.guestEmail || 'owner';
              return sharing.notifyChanges(who, newFolder, function(err) {
                if (err) {
                  console.log(err);
                }
                return res.send(newFolder, 200);
              });
            });
          };
          if (parents.length > 0) {
            parent = parents[0];
            folder.tags = parent.tags;
            parent.lastModification = now;
            return parent.save(function(err) {
              if (err) {
                return next(err);
              } else {
                return createFolder();
              }
            });
          } else {
            folder.tags = [];
            return createFolder();
          }
        }
      };
    })(this));
  }
};

module.exports.find = function(req, res, next) {
  return res.send(req.folder);
};

module.exports.tree = function(req, res, next) {
  var folderChild;
  folderChild = req.folder;
  return Folder.getParents((function(_this) {
    return function(err, folders) {
      if (err) {
        return next(err);
      } else {
        return res.send(parents, 200);
      }
    };
  })(this));
};

module.exports.modify = function(req, res, next) {
  var folderToModify, isPublic, newName, newPath, newRealPath, newTags, oldPath, oldRealPath, updateFoldersAndFiles, updateIfIsSubFolder, updateTheFolder;
  folderToModify = req.folder;
  log.debug(req.body);
  if ((req.body.name == null) && (req.body["public"] == null) && (req.body.tags == null)) {
    return res.send({
      error: true,
      msg: "Data required"
    }, 400);
  }
  newName = req.body.name;
  isPublic = req.body["public"];
  oldPath = "" + folderToModify.path + "/" + folderToModify.name + "/";
  newPath = "" + folderToModify.path + "/" + newName + "/";
  newTags = req.body.tags || [];
  newTags = newTags.filter(function(tag) {
    return typeof tag === 'string';
  });
  oldRealPath = "" + folderToModify.path + "/" + folderToModify.name;
  newRealPath = "" + folderToModify.path + "/" + newName;
  updateIfIsSubFolder = function(file, cb) {
    var data, modifiedPath, oldTags, tag, tags, _i, _len;
    if (("" + file.path + "/").indexOf(oldPath) === 0) {
      modifiedPath = file.path.replace(oldRealPath, newRealPath);
      oldTags = file.tags;
      tags = [].concat(oldTags);
      for (_i = 0, _len = newTags.length; _i < _len; _i++) {
        tag = newTags[_i];
        if (tags.indexOf(tag === -1)) {
          tags.push(tag);
        }
      }
      log.debug(tags);
      data = {
        path: modifiedPath,
        tags: tags
      };
      return file.updateAttributes(data, cb);
    } else {
      return cb(null);
    }
  };
  updateTheFolder = function() {
    var data;
    data = {
      name: newName,
      "public": isPublic,
      tags: newTags,
      lastModification: moment().toISOString()
    };
    if (req.body.clearance) {
      data.clearance = req.body.clearance;
    }
    return folderToModify.updateAttributes(data, (function(_this) {
      return function(err) {
        if (err) {
          return next(err);
        }
        return updateParentModifDate(folderToModify, function(err) {
          if (err) {
            log.raw(err);
          }
          return folderToModify.index(["name"], function(err) {
            if (err) {
              log.raw(err);
            }
            return res.send({
              success: 'File succesfuly modified'
            }, 200);
          });
        });
      };
    })(this));
  };
  updateFoldersAndFiles = function(folders) {
    return async.each(folders, updateIfIsSubFolder, function(err) {
      if (err) {
        return next(err);
      } else {
        return File.all((function(_this) {
          return function(err, files) {
            if (err) {
              return next(err);
            } else {
              return async.each(files, updateIfIsSubFolder, function(err) {
                if (err) {
                  return next(err);
                } else {
                  return updateTheFolder();
                }
              });
            }
          };
        })(this));
      }
    });
  };
  return Folder.byFullPath({
    key: newRealPath
  }, function(err, sameFolders) {
    if (err) {
      return next(err);
    }
    log.debug(sameFolders);
    if (sameFolders.length > 0 && sameFolders[0].id !== req.body.id) {
      return res.send({
        error: true,
        msg: "The name already in use"
      }, 400);
    } else {
      return Folder.all(function(err, folders) {
        if (err) {
          return next(err);
        }
        return updateFoldersAndFiles(folders);
      });
    }
  });
};

module.exports.destroy = function(req, res, next) {
  var currentFolder, destroyIfIsSubdirectory, destroySubFiles, destroySubFolders, directory;
  currentFolder = req.folder;
  directory = "" + currentFolder.path + "/" + currentFolder.name;
  destroyIfIsSubdirectory = function(file, cb) {
    if (file.path.indexOf(directory) === 0) {
      if (file.binary) {
        return file.removeBinary("file", function(err) {
          if (err) {
            return cb(err);
          } else {
            return file.destroy(cb);
          }
        });
      } else {
        return file.destroy(cb);
      }
    } else {
      return cb(null);
    }
  };
  destroySubFolders = function(callback) {
    return Folder.all(function(err, folders) {
      if (err) {
        return next(err);
      } else {
        return async.each(folders, destroyIfIsSubdirectory, function(err) {
          if (err) {
            return next(err);
          } else {
            return callback();
          }
        });
      }
    });
  };
  destroySubFiles = function(callback) {
    return File.all((function(_this) {
      return function(err, files) {
        if (err) {
          return next(err);
        } else {
          return async.each(files, destroyIfIsSubdirectory, function(err) {
            if (err) {
              return next(err);
            } else {
              return callback();
            }
          });
        }
      };
    })(this));
  };
  return destroySubFolders(function() {
    return destroySubFiles(function() {
      return currentFolder.destroy(function(err) {
        if (err) {
          return next(err);
        } else {
          return updateParentModifDate(currentFolder, function(err) {
            if (err) {
              log.raw(err);
            }
            return res.send({
              success: "Folder succesfuly deleted: " + directory
            });
          });
        }
      });
    });
  });
};

module.exports.findFiles = function(req, res, next) {
  return getFolderPath(req.body.id, function(err, key) {
    if (err) {
      return next(err);
    } else {
      return File.byFolder({
        key: key
      }, function(err, files) {
        if (err) {
          return next(err);
        } else {
          return res.send(files, 200);
        }
      });
    }
  });
};

module.exports.allFolders = function(req, res, next) {
  return Folder.all(function(err, folders) {
    if (err) {
      return next(err);
    } else {
      return res.send(folders);
    }
  });
};

module.exports.findFolders = function(req, res, next) {
  return getFolderPath(req.body.id, function(err, key) {
    if (err) {
      return next(err);
    } else {
      return Folder.byFolder({
        key: key
      }, function(err, files) {
        if (err) {
          return next(err);
        } else {
          return res.send(files, 200);
        }
      });
    }
  });
};

module.exports.search = function(req, res, next) {
  var parts, query, sendResults, tag;
  sendResults = function(err, files) {
    if (err) {
      return next(err);
    } else {
      return res.send(files);
    }
  };
  query = req.body.id;
  query = query.trim();
  if (query.indexOf('tag:') !== -1) {
    parts = query.split();
    parts = parts.filter(function(part) {
      return part.indexOf('tag:' !== -1);
    });
    tag = parts[0].split('tag:')[1];
    return Folder.request('byTag', {
      key: tag
    }, sendResults);
  } else {
    return Folder.search("*" + query + "*", sendResults);
  }
};

module.exports.zip = function(req, res, next) {
  var addToArchive, archive, folder, key, makeZip;
  folder = req.folder;
  archive = archiver('zip');
  addToArchive = function(file, cb) {
    var name, stream;
    stream = file.getBinary("file", (function(_this) {
      return function(err, resp, body) {
        if (err) {
          return next(err);
        }
      };
    })(this));
    name = file.path.replace(key, "") + "/" + file.name;
    return archive.append(stream, {
      name: name
    }, cb);
  };
  makeZip = function(zipName, files) {
    async.eachSeries(files, addToArchive, function(err) {
      var disposition;
      if (err) {
        return next(err);
      } else {
        archive.pipe(res);
        disposition = "attachment; filename=\"" + zipName + ".zip\"";
        res.setHeader('Content-Disposition', disposition);
        return res.setHeader('Content-Type', 'application/zip');
      }
    });
    return archive.finalize(function(err, bytes) {
      if (err) {
        return res.send({
          error: true,
          msg: "Server error occured: " + err
        }, 500);
      } else {
        return console.log("Zip created");
      }
    });
  };
  key = "" + folder.path + "/" + folder.name;
  return File.all(function(err, files) {
    var selectedFiles, zipName, _ref;
    if (err) {
      return next(err);
    } else {
      zipName = (_ref = folder.name) != null ? _ref.replace(/\W/g, '') : void 0;
      selectedFiles = files.filter(function(file) {
        return ("" + file.path + "/").indexOf("" + key + "/") === 0;
      });
      return makeZip(zipName, selectedFiles);
    }
  });
};

module.exports.publicList = function(req, res, next) {
  var errortemplate, folder;
  folder = req.folder;
  errortemplate = function(err) {
    console.log(err);
    return res.send(err.stack || err);
  };
  return sharing.limitedTree(folder, req, function(path, rule) {
    var authorized, key;
    authorized = path.length !== 0;
    if (!authorized) {
      return res.send(404);
    }
    key = "" + folder.path + "/" + folder.name;
    return async.parallel([
      function(cb) {
        return CozyInstance.getLocale(cb);
      }, function(cb) {
        return Folder.byFolder({
          key: key
        }, cb);
      }, function(cb) {
        return File.byFolder({
          key: key
        }, cb);
      }, function(cb) {
        var clearance, notif, r, _i, _len;
        if (req.query.notifications === void 0) {
          return cb();
        }
        notif = req.query.notifications;
        notif = notif && notif !== 'false';
        clearance = path[0].clearance || [];
        for (_i = 0, _len = clearance.length; _i < _len; _i++) {
          r = clearance[_i];
          if (r.key === rule.key) {
            rule.notifications = r.notifications = notif;
          }
        }
        return folder.updateAttributes({
          clearance: clearance
        }, cb);
      }
    ], function(err, results) {
      var e, files, folders, html, lang, locals, translate, translations;
      if (err) {
        return errortemplate(err);
      }
      lang = results[0], folders = results[1], files = results[2];
      translations = (function() {
        try {
          return require('../../client/app/locales/' + lang);
        } catch (_error) {
          e = _error;
          return {};
        }
      })();
      translate = function(text) {
        return translations[text] || text;
      };
      files = files.map(function(file) {
        file = file.toJSON();
        file.lastModification = new Date(file.lastModification).toISOString().split('T').join(' ').split('.')[0];
        file.size = file.size > MB ? (parseInt(file.size) / MB).toFixed(1) + translate("MB") : file.size > KB ? (parseInt(file.size) / KB).toFixed(1) + translate("KB") : file.size + translate("B");
        return file;
      });
      locals = {
        path: path,
        files: files,
        folders: folders,
        lang: lang,
        canupload: rule.perm === 'rw',
        notifications: rule.notifications || false,
        keyquery: "?key=" + req.query.key,
        t: translate
      };
      try {
        html = jade.renderFile(publicfoldertemplate, locals);
        return res.send(html);
      } catch (_error) {
        err = _error;
        return errortemplate(err);
      }
    });
  });
};

module.exports.publicZip = function(req, res, next) {
  var errortemplate;
  errortemplate = function(err) {
    return res.send(err.stack || err);
  };
  return findFolder(req.params.id, function(err, folder) {
    if (err) {
      return errortemplate(err);
    }
    return sharing.checkClearance(folder, req, function(authorized) {
      if (!authorized) {
        return res.send(404);
      } else {
        return module.exports.zip(req, res);
      }
    });
  });
};

module.exports.publicCreate = function(req, res, next) {
  var folder;
  folder = new Folder(req.body);
  return sharing.checkClearance(folder, req, 'w', function(authorized) {
    if (!authorized) {
      return res.send(401);
    } else {
      return module.exports.create(req, res, next);
    }
  });
};
