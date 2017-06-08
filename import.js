#!/usr/bin/env node

const async         = require("async");
const elasticsearch = require("./src/elasticsearch");
const filter        = require("lodash").filter;
const forEach       = require("lodash").forEach;
const google        = require("./src/google");
const isEmpty       = require("lodash").isEmpty;
const map           = require("lodash").map;
const mapValues     = require("lodash").mapValues;
const meow          = require("meow");
const merge         = require("lodash").merge;
const utils         = require("./src/utils");


// Parse cli arguments
const cli = meow(`
    Usage:
        node import.js [options]

    Options:
        -h, --help                  print usage information
        --google-client-email EMAIL Google auth's client email
        --google-private-key  KEY   Google auth's private key (since it contains hyphens and newlines
                                    it could be quite annoying escaping it correctly, so you're highly
                                    encouraged to use the environment variable alternative)
        --elasticsearch-host HOST   ElasticSearch cluster host URL
        --elasticsearch-index NAME  ElasticSearch index name (defaults to "googleplaystore")
        --elasticsearch-http-auth AUTH
                                    ElasticSearch HTTP Basic Auth with username and password separated by a colon
                                    (eg. user:pass)
        --elasticsearch-aws-region  The AWS region (ie. "eu-west-1") if you're connecting to an AWS managed cluster
        --elasticsearch-aws-access-key-id ID
                                    The AWS access id if you're connecting to an AWS managed cluster
        --elasticsearch-aws-secret-access-key SECRET
                                    The AWS secret if you're connecting to an AWS managed cluster
        --app-name NAME             The name of the app for which you're importing analytics (not
                                    required to match the exact app name in the store)
        --app-package NAME          The package of the app for which you're importing analytics
        --app-bucket NAME           The google cloud storage bucket where app analytics are stored
        --sync-start-month DATE     Sync analytics from this month, in the format YYYY-MM (defaults to 1y ago)
        --sync-end-month DATE       Sync analytics until this month, in the format YYYY-MM (defaults to current month)
        --log-level                 The minimum log level (debug, info, warn, error, fatal, silent - defaults to info)
        --log-format                The log format (human, json - defaults to human)

    Multiple applications:
        You can import analytics for multiple applications, specifying app options multiple times. Ie.

        --app-name "Name 1" --app-package "pkg.1" --app-bucket "bucket-1" --app-name "Name 2" --app-package "pkg.2" --app-bucket "bucket-2"

    Environment variables:
        All options fallback to environment variables too. Matching env variables are
        all uppercases with hyphens replaced by underscores. The following env variables
        are supported then:

        GOOGLE_CLIENT_EMAIL
        GOOGLE_PRIVATE_KEY
        ELASTICSEARCH_HOST
        ELASTICSEARCH_INDEX
        ELASTICSEARCH_HTTP_AUTH
        ELASTICSEARCH_AWS_REGION
        ELASTICSEARCH_AWS_ACCESS_KEY_ID
        ELASTICSEARCH_AWS_SECRET_ACCESS_KEY
        APP_NAME
        APP_PACKAGE
        APP_BUCKET
        SYNC_START_MONTH
        SYNC_END_MONTH
        LOG_LEVEL
        LOG_FORMAT
`, {
    string:  [
        "google-client-email",
        "google-private-key",
        "elasticsearch-host",
        "elasticsearch-http-auth",
        "elasticsearch-index",
        "elasticsearch-aws-region",
        "elasticsearch-aws-access-key-id",
        "elasticsearch-aws-secret-access-key",
        "app-name",
        "app-package",
        "app-bucket",
        "sync-start-month",
        "sync-end-month",
        "log-level",
        "log-format",
    ],
    boolean: [ "verbose" ],
    alias:   { "v": "verbose" },
    default: {
        "elasticsearch-host":                  process.env.ELASTICSEARCH_HOST,
        "elasticsearch-http-auth":             process.env.ELASTICSEARCH_HTTP_AUTH,
        "elasticsearch-index":                 process.env.ELASTICSEARCH_INDEX || "googleplaystore",
        "elasticsearch-aws-region":            process.env.ELASTICSEARCH_AWS_REGION,
        "elasticsearch-aws-access-key-id":     process.env.ELASTICSEARCH_AWS_ACCESS_KEY_ID,
        "elasticsearch-aws-secret-access-key": process.env.ELASTICSEARCH_AWS_SECRET_ACCESS_KEY,
        "google-client-email":                 process.env.GOOGLE_CLIENT_EMAIL,
        "google-private-key":                  process.env.GOOGLE_PRIVATE_KEY,
        "app-name":                            process.env.APP_NAME ? process.env.APP_NAME.split(",") : undefined,
        "app-package":                         process.env.APP_PACKAGE ? process.env.APP_PACKAGE.split(",") : undefined,
        "app-bucket":                          process.env.APP_BUCKET ? process.env.APP_BUCKET.split(",") : undefined,
        "sync-start-month":                    process.env.SYNC_START_MONTH || utils.formatMonth(new Date((new Date().getTime()) - (32 * 24 * 60 * 60 * 1000))),
        "sync-end-month":                      process.env.SYNC_END_MONTH || utils.formatMonth(new Date()),
        "log-level":                           process.env.LOG_LEVEL || "info",
        "log-format":                          process.env.LOG_FORMAT || "human",
    }
});


// Get config from arguments
let config = cli.flags;

config = mapValues(config, (value, key) => {
    switch(key) {
        case "appName":
        case "appPackage":
        case "appBucket":
            // Convert single app config to an array of apps
            return value ? (value instanceof Array ? value : [ value ]) : [];

        case "googlePrivateKey":
            // Replace "\n" with newline
            return value ? value.replace(/\\n/g, "\n") : value;

        default:
            return value;
    }
});


// Init logger
const logger = require("./src/logger").initLoggerFromConfig(config);

// Ensure apps config consistency
if (config.appName.length !== config.appPackage.length || config.appName.length !== config.appBucket.length) {
    logger.fatal("You should specify the exact number of app names, packages and buckets, while you've provided ${config.appName.length} names, ${config.appPackage.length} packages and ${config.appBucket.length} buckets.");
    process.exit(1);
} else if (config.appName.length === 0) {
    logger.fatal("You should specify at least one app.");
    process.exit(1);
}

// Get apps
let apps = config.appName.map((name, index) => {
    return {
        name:    name,
        package: config.appPackage[index],
        bucket:  config.appBucket[index]
    };
});

// Create google client
const googleClient = google.createClientFromConfig(config);

// Instance the ES client
const elasticClient = elasticsearch.createClientFromConfig(config);



const getMetricsFromCsv = (bucket, object, cb) => {
    google.getCsvFromStorage(googleClient, bucket, object, (err, data) => {
        if (err) {
            return cb(err);
        }

        cb(null, utils.extractMetricsFromCsv(data));
    });
};

const syncAppMetricsFromCsv = (app, objectName, type, month, cb) => {
    getMetricsFromCsv(app.bucket, objectName, (err, metrics) => {
        if (err) {
            return cb(err);
        }

        // Ensure there's at least 1 metric to import
        if (isEmpty(metrics)) {
            logger.info(`No ${type} metrics to import for app ${app.package} and month ${month}`);
            return cb();
        }

        // Prepare bulk request
        let body = [];

        forEach(metrics, (data, date) => {
            // Action
            body.push({ index:  {
                _index: config.elasticsearchIndex,
                _type: type,
                _id: `${date}-${app.package}-${type}`
            }});

            // Data
            body.push(merge(data, {
                "@timestamp": date,
                "app_name":   app.name
            }));
        });

        // Bulk indexing
        elasticClient.bulk({ body: body }, (err, response) => {
            // Log
            if (err) {
                logger.error(`Unable to import ${type} metrics for app ${app.package} and month ${month} because of error: ${err.message}`);
            } else {
                logger.info(`Imported ${type} metrics for app ${app.package} and month ${month}`);
            }

            cb(err);
        });
    });
};

const syncAppMetricsForMonth = (app, month, cb) => {
    async.parallel([
        syncAppMetricsFromCsv.bind(this, app, `stats/installs/installs_${app.package}_${month.replace("-", "")}_overview.csv`, "overview", month),
        syncAppMetricsFromCsv.bind(this, app, `stats/ratings/ratings_${app.package}_${month.replace("-", "")}_overview.csv`, "ratings", month)
    ], cb);
};

const syncAppMetrics = (app, cb) => {
    let curr  = new Date(config.syncStartMonth);
    let end   = new Date(config.syncEndMonth);
    let tasks = [];

    // Prepare tasks to run
    while (curr.getTime() <= end.getTime()) {
        tasks.push(syncAppMetricsForMonth.bind(this, app, utils.formatMonth(curr)));
        curr.setUTCMonth(curr.getUTCMonth() + 1);
    }

    // Run tasks
    async.series(tasks, cb);
};

const syncAppsMetrics = (apps, cb) => {
    // Sync all apps sequentially
    async.series(apps.map((app) => {
        return syncAppMetrics.bind(this, app);
    }), cb);
};

async.series([
    // Authorize google client
    google.authorizeClient.bind(this, googleClient),

    // Check ElasticSearch connection
    elasticsearch.checkClientConnection.bind(this, elasticClient),

    // Delete index
    // elasticsearch.deleteIndex.bind(this, elasticClient, config.elasticsearchIndex),

    // Ensure the index exists
    elasticsearch.ensureIndex.bind(this, elasticClient, config.elasticsearchIndex, {
        "overview": {
            properties: {
                active_device_installs:  { type: "long" },
                current_user_installs:   { type: "long" },
                daily_device_installs:   { type: "long" },
                daily_device_uninstalls: { type: "long" },
                daily_device_upgrades:   { type: "long" },
                daily_user_installs:     { type: "long" },
                daily_user_uninstalls:   { type: "long" },
                total_user_installs:     { type: "long" },
            }
        },
        "ratings": {
            properties: {
                daily_average_rating: { type: "float" },
                total_average_rating: { type: "float" },
            }
        }
    }),

    // Sync metrics
    syncAppsMetrics.bind(this, apps),

    // Refresh index
    elasticsearch.refreshIndex.bind(this, elasticClient, config.elasticsearchIndex)
], (err) => {
    // Log
    if (err) {
        process.exit(1);
    } else {
        process.exit(0);
    }
});
