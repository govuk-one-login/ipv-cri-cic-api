import { Logger } from '@aws-lambda-powertools/logger'
import { LambdaInterface } from '@aws-lambda-powertools/commons'

const logger = new Logger({
  logLevel: 'debug',
  serviceName: 'ClaimedIdHandler'
})

class ClaimedIdentity implements LambdaInterface {
  async handler (event: any, context: any): Promise<String> {
    console.log('Hello world!')
    logger.debug('Hello World!')

    return 'Hello World!'
  }
}
const handlerClass = new ClaimedIdentity()
export const lambdaHandler = handlerClass.handler.bind(handlerClass)
