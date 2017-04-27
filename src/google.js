const google  = require("googleapis");
const storage = google.storage("v1");
const logger  = require("./logger").getLogger();


const createClientFromConfig = (config) => {
    return new google.auth.JWT(
        config.googleClientEmail,
        null,
        config.googlePrivateKey,
        ["https://www.googleapis.com/auth/devstorage.read_only"],
        null
    );
};

/**
 * Authorize the client and call the callback once done.
 *
 * @param  {Function} cb fn(err, client)
 */
const authorizeClient = (client, cb) => {
    client.authorize(function (err, tokens) {
        if (err) {
            logger.fatal(`Unable to authorize google client because of error: ${err.message}`);
        }

        cb(err, err ? null : client);
    });
};

const getCsvFromStorage = (client, bucket, object, cb) => {
    var request = {
        bucket: bucket,
        object: encodeURIComponent(object),
        alt:    "media", // Required to download the content
        auth:   client
    };

    var options = {
        encoding: "utf16le"
    };

    storage.objects.get(request, options, function(err, response) {
        if (err) {
            logger.error(`Unable to get object ${object} from bucket ${bucket} because of error: ${err.message}`);
            cb(err);
        } else if (typeof response !== "string") {
            logger.error(`Unable to get object ${object} from bucket ${bucket}`);
            cb(new Error(`Unable to get object ${object} from bucket ${bucket}`));
        }

        cb(null, response);
    });
};


module.exports = {
    createClientFromConfig: createClientFromConfig,
    authorizeClient:        authorizeClient,
    getCsvFromStorage:      getCsvFromStorage
};
