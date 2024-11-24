<!--
title: 'AWS Simple HTTP Endpoint storing data request to google sheet and splitting a UTC timestamp environment variable property to multiple time and date properties in Finnish NodeJS'
description: 'HTTP API with Node.js running on AWS Lambda and API Gateway using the Serverless Framework. Storing data google sheet'
layout: Doc
framework: v4
platform: AWS
language: nodeJS
authorLink: 'https://github.com/santeriv'
authorName: 'santeriv'
authorAvatar: 'https://avatars.githubusercontent.com/u/170341?v=4'
-->

# Serverless Framework Node HTTP API on AWS

## Usage

### Deployment

Before deploying set .env file e.g.
```
GOOGLE_CLIENT_EMAIL=serverless-gstore-app@your-google-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY='-----BEGIN PRIVATE KEY-----\nMIIEvg......\n-----END PRIVATE KEY-----\n'
SHEET_ID=1BY7fLPPF89cn7PVGVqk6zGRaqbwe_Mknb0PrQWdaDr8
SHEET_RANGE=Sheet2
REQUEST_TIME_PROPERTY_NAME=received_at
REQUEST_PAYLOAD_NESTED_PATH=uplink_message.decoded_payload
```
Remember:
* GOOGLE_CLIENT_EMAIL google service user must have Editor access your SHEET_ID
* GOOGLE_PRIVATE_KEY credentials for service user are syntaxwise (as an oneliner) most easily copied from json file, which can be downloaded from google console
* REQUEST_TIME_PROPERTY_NAME is splitted to multiple values in Finnish time (see example of input/output below)

In order to deploy the example, you need to run the following command:

```
serverless deploy
```

After running deploy, you should see output similar to:

```
Deploying "ttn-data-gsheet-store" to stage "dev" (us-east-1)

✔ Service deployed to stack ttn-data-gsheet-store-dev (43s)

endpoint: POST - https://xxxxxxxx.execute-api.us-east-1.amazonaws.com/dev/data
functions:
  appendToSheet: ttn-data-gsheet-store-dev-appendToSheet (17 MB)
```

_Note_: In current form, after deployment, your API is public and can be invoked by anyone. For production deployments, you might want to configure an authorizer. For details on how to do that, refer to [HTTP API (API Gateway V2) event docs](https://www.serverless.com/framework/docs/providers/aws/events/http-api).

### Invocation

After successful deployment, you can call the created application via HTTP:

```
curl -X POST https://xxxxxxxx.execute-api.us-east-1.amazonaws.com/dev/data
--data 
{
  "received_at": "2024-11-24T14:20:05.842350033Z",
  "uplink_message": {
    "decoded_payload": {
      "name": "Alice",
      "email": "alice@example.com"
    },
    "ignored": true
  },
  "ignored_field": "whatever"
}

```

Which should result in http response (code: 200) similar to:

```json
{
  "message": "Data appended to Google Sheet successfully.",
  "data": [
    "2024-11-24T14:20:05.842350033Z",
    7,
    "16",
    "20",
    "24.11.2024 klo 16.20.05",
    "sunnuntai",
    "Alice",
    "alice@example.com"
  ]
}
```

Above input request data would result in google sheet (Sheet2):

|timestamp in UTC|weekdaynumber*|hour*|minute*|dateformat*|weekdayname*|rest-of-data-1|rest-of-data-n|
|---|---|---|---|---|--|--|--|
| 2024-11-24T14:20:05.842350033Z  |  7 | 16  | 20  | 24.11.2024 klo 16.20.05 | sunnuntai |Alice |alice@example.com  |

* = in Finnish time / locale

### Local development

The easiest way to develop and test your function is to use the `dev` command:

```
serverless dev
```

This will start a local emulator of AWS Lambda and tunnel your requests to and from AWS Lambda, allowing you to interact with your function as if it were running in the cloud.

Now you can invoke the function as before, but this time the function will be executed locally. Now you can develop your function locally, invoke it, and see the results immediately without having to re-deploy.

When you are done developing, don't forget to run `serverless deploy` to deploy the function to the cloud.
