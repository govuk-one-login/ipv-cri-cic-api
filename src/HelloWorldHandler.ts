import { APIGatewayProxyEvent } from 'aws-lambda'
import { Logger } from '@aws-lambda-powertools/logger'

const logger = new Logger({
  logLevel: 'DEBUG',
  serviceName: 'UserInfoHandler'
})

export const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<void> => {
  logger.info('Hello World!')
}
