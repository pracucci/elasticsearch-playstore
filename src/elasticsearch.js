const elasticsearch = require("elasticsearch");
const logger        = require("./logger").getLogger();


const createClientFromConfig = (config) => {
    if (config.elasticsearchAwsRegion) {
        const AWS           = require("aws-sdk");
        const AWSConnection = require("http-aws-es");

        return elasticsearch.Client({
            host:            config.elasticsearchHost,
            connectionClass: AWSConnection,
            amazonES:        {
                region:      config.elasticsearchAwsRegion,
                credentials: new AWS.Credentials({
                    accessKeyId:     config.elasticsearchAwsAccessKeyId,
                    secretAccessKey: config.elasticsearchAwsSecretAccessKey
                })
            }
        });
    } else {
        return elasticsearch.Client({
            host:     config.elasticsearchHost,
            httpAuth: config.elasticsearchHttpAuth
        });
    }
};

const checkClientConnection = (client, cb) => {
    client.ping({
        requestTimeout: 10000,
    }, (err) => {
        if (err) {
            logger.fatal(`Unable to connect to ElasticSearch cluster because of error: ${err.message}`);
        }

        cb(err);
    });
};

const deleteIndex = (client, index, cb) => {
    client.indices.delete({ index: index }, (err, response) => {
        // Log
        if (err) {
            logger.fatal(`Unable to delete index ${index} because of error: ${err.message}`);
        } else {
            logger.info(`Index ${index} deleted successfully`);
        }

        cb(err);
    });
};

const createIndex = (client, index, mappings, cb) => {
    // Prepare the request body
    let body = {
        "mappings": mappings
    };

    client.indices.create({ index: index, body }, (err, response) => {
        // Log
        if (err) {
            logger.fatal(`Unable to create index ${index} because of error: ${err.message}`);
        } else {
            logger.info(`Index ${index} created successfully`);
        }

        cb(err);
    });
};

const refreshIndex = (client, index, cb) => {
    client.indices.refresh({ index: index }, function(err, response) {
        // Log
        if (err) {
            logger.fatal(`Unable to refresh index ${index} because of error: ${err.message}`);
        } else {
            logger.debug(`Index ${index} refreshed successfully`);
        }

        cb(err);
    });
}

const ensureIndex = (client, index, mappings, cb) => {
    // Check if the index exists
    client.indices.exists({ index: index }, (err, exists) => {
        if (err) {
            logger.fatal(`Unable to check if index ${index} exists because of error: ${err.message}`);
            return cb(err);
        }

        if (exists) {
            logger.debug(`Index ${index} already exists, so creation has been skipped`);
            return cb();
        }

        // Create index
        createIndex(client, index, mappings, cb);
    });
};


module.exports = {
    createClientFromConfig: createClientFromConfig,
    checkClientConnection:  checkClientConnection,
    deleteIndex:            deleteIndex,
    createIndex:            createIndex,
    refreshIndex:           refreshIndex,
    ensureIndex:            ensureIndex,
};
