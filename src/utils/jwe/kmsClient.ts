import AWS from 'aws-sdk'
import { KMSClient } from '@aws-sdk/client-kms'
import { NodeHttpHandler } from '@aws-sdk/node-http-handler'

export const v2KmsClient = new AWS.KMS({
  region: process.env.REGION,
  httpOptions: { timeout: 29000, connectTimeout: 5000 },
  maxRetries: 2,
  retryDelayOptions: { base: 200 }
})

export const v3KmsClient = new KMSClient({
  region: process.env.REGION,
  maxAttempts: 2,
  requestHandler: new NodeHttpHandler({
    connectionTimeout: 29000,
    socketTimeout: 29000
  })
})

