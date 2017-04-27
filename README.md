# Google Play Store App Analytics importer for ElasticSearch

This tool imports your Android applications analytics from Google Play into ElasticSearch. The original idea was to import metrics in ElasticSearch to graph them on Grafana, but its usage is not limited to it.

Currently the following analytics are imported, but extending it to import more metrics is pretty easy (please open an issue if you need more or submit a PR):

- Daily user installs / uninstalls
- Daily device installs / uninstalls
- Total user and device installs
- Daily average ratings


## How it works

Given a time range (with month granularity), this tool:

- Read analytics .csv from Google Storage Cloud
- Store analytics to ElasticSearch with a structure easily queryable from Grafana


## Setup

This tool needs the credentials to read your Android apps analytics from csv files stored on Google Cloud Storage (Google Play automatically stores them for you, so you already have them). The [credentials setup](https://support.google.com/googleplay/android-developer/answer/6135870?hl=en) is a bit annoying but can be summarized like follow.

#### Enable the Cloud Storage JSON API

1. Open [https://console.developers.google.com/apis/dashboard](https://console.developers.google.com/apis/dashboard)
2. Ensure **Google Cloud Storage JSON API** is enabled

#### Create a Service account key

1. Open [https://console.developers.google.com/apis/credentials](https://console.developers.google.com/apis/credentials)
2. Select **Create credentials** and then **Service account key** (no permissions are required)
3. Pick a service account or create a new one, and then select the key type **JSON**

Notes:

- The service has an email associated: keep track of it, since you will use it during the next step
- You have downloaded the service account credentials json file: pick `client_email` and `private_key` from it, since it will be required to authenticate the importer

#### Add the service account on your Play Console

1. Open [https://play.google.com/apps/publish/](https://play.google.com/apps/publish/) and login with the owner account of the Android application for which you wanna import the analytics
2. Select to **Settings** > **User accounts** > **Invite new user**
3. Insert the email address with your service account
4. Give it the basic permissions (no other permissions are required)


## Run it

Have you survived the setup? Cool! Now, it's time to run it. You can pass all settings on the command line or via environment variables. The `--help` verbosely list all options:

```
$ node import.js --help

  Google Play Store App Analytics importer for ElasticSearch

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
      ELASTICSEARCH_AWS_REGION
      ELASTICSEARCH_AWS_ACCESS_KEY_ID
      ELASTICSEARCH_AWS_SECRET_ACCESS_KEY
      APP_NAME
      APP_PACKAGE
      APP_BUCKET
      LOG_LEVEL
      LOG_FORMAT
```


An example is worth more than a thousand words:

```
GOOGLE_PRIVATE_KEY="SERVICE-KEY" node import.js \
    --google-client-email "SERVICE-EMAIL" \
    --elasticsearch-host "https://user:password@domain.com:9020" \
    --elasticsearch-index "googleplaystore" \
    --app-name "My awesome app" \
    --app-package "com.domain.app" \
    --app-bucket "pubsite_prod_rev_01234567890987654321"
```


#### How to get an Android app analytics storage bucket

Your Google Cloud Storage bucket ID is listed near the bottom of your Reports pages.

Your bucket ID begins with `pubsite_prod_rev_` followed by your developer account ID (ie. `pubsite_prod_rev_01234567890987654321`). To get developer account ID, open [https://play.google.com/apps/publish/](https://play.google.com/apps/publish/), select an application and get the `dev_acc` query string parameter value from the URL.

Then you can build it:

`pubsite_prod_rev_DEVACC`


#### How to authenticate on ElasticSearch

You can authenticate on a generic ElasticSearch cluster this way:

```
--elasticsearch-host "https://user:password@domain.com:9020"
```

You can authenticate on AWS ElasticSearch this way:

```
--elasticsearch-host "https://xxx.eu-west-1.es.amazonaws.com"
--elasticsearch-aws-region "eu-west-1"
--elasticsearch-aws-access-key-id "ID"
--elasticsearch-aws-secret-access-key "SECRET"
```


## License

Copyright 2017 Marco Pracucci

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
