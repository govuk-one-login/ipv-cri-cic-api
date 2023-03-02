import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log(event)
  if (event.queryStringParameters?.error != null) {
    return {
      statusCode: 200,
      body: 'Authorisation Grant Failed. See logs for details'
    }
  } else {
    return {
      statusCode: 200,
      body: 'Authorization Granted. See logs for details'
    }
  }
}
