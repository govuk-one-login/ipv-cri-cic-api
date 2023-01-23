

import {
    APIGatewayProxyEvent,
    APIGatewayProxyResult
  }
    from 'aws-lambda/trigger/api-gateway-proxy'
  // interface Person {
  //     name: string
  //     surname: string
  //     age: number
  // }
  export const lambdaHandler = async (
    event: APIGatewayProxyEvent
  ): Promise<APIGatewayProxyResult> => {
    const queries = JSON.stringify(event.queryStringParameters)
    return {
      statusCode: 200,
      body: `Queries: ${queries}`
    }
  }