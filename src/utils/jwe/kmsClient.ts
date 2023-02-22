import { KMSClient } from '@aws-sdk/client-kms'
import { NodeHttpHandler } from '@aws-sdk/node-http-handler'

export const v3KmsClient = new KMSClient({
  region: process.env.REGION,
  maxAttempts: 2,
  requestHandler: new NodeHttpHandler({
    connectionTimeout: 29000,
    socketTimeout: 29000
  })
})

