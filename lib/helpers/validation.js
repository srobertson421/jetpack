const globals = require('./globals');
const info = require('./info');
const s3Client = require('./s3Client');
const Manifest = require('./manifest');
var fs = require('fs');

function createClient() {
  var client = s3Client(process.env.S3_BUCKET,
    process.env.S3_ACCESS_KEY_ID,
    process.env.S3_SECRET_KEY,
    globals);

  return client;
}

function createAndVerifyManifest(onSuccess) {
   function handleError(msg) {
    if (msg) {
      info.error(msg);
    }
    process.exit();
  }

  if (!globals.isDevMode()) {
    var client = createClient();

    var remoteManifest = Manifest();
    var thisManifest = Manifest();
    client.getJSONFile('release.json', function(data) {

      remoteManifest.load(data);
      info.log('');
      info.log('Current production release is: ' + remoteManifest.data().version);

      thisManifest.refresh(function() {
        if (thisManifest.isMatchingVersion(remoteManifest)) {
          handleError('Your tag matches the current release. You must pull a unique release tag name or branch for your bundle.');
        } else {
          onSuccess(thisManifest);
        }
      });
    }, handleError);
  }
}

function dieIfBuildMismatch(onComplete) {
  fs.readFile(globals.workingDir() + '/dist/' + globals.site() + '/release.json', 'utf8', function (err, data) {
    if (err) {
      info.log('No dist manifest found.');
      info.error('You must rebuild the bundle. No build found.');
      process.exit();
    } else if (data) {
      var distManifest = Manifest();
      var freshManifest = Manifest();
      distManifest.load(JSON.parse(data));
      freshManifest.refresh(function() {
        if (!distManifest.isMatchingVersion(freshManifest) || !distManifest.isMatchingCommit(freshManifest)) {
          info.error('You must rebuild the bundle. Current commit or version does not match dist build.');
          process.exit();
        }
      });
    }

    onComplete();
  });
}

function ifProjectExists(onComplete) {
  var client = createClient();
  client.getJSONFile('release.json', function() {
    onComplete(true);
  }, function(err) {
    if (err.toString().indexOf('404') !== false) {
      onComplete(false);
    } else {
      info.error(err);
      process.exit();
    }
  });
}

module.exports.createAndVerifyManifest = createAndVerifyManifest;
module.exports.ifProjectExists = ifProjectExists;
module.exports.dieIfBuildMismatch = dieIfBuildMismatch;

