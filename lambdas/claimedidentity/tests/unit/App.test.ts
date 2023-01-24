import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { lambdaHandler } from '../../src/App';
import { mock } from 'jest-mock-extended';
import { CicService } from "../../src/services/CicService";
import { AppError } from "../../src/utils/AppError";
import { ValidationHelper } from "../../src/utils/ValidationHelper"
import {event} from "./data/events";
import {CicSession} from "../../src/models/CicSession";
import {DocumentClient} from "aws-sdk/clients/dynamodb";
import AWS from "aws-sdk";
import {
    QueryInput,
    QueryOutput,
    GetItemInput,
    GetItemOutput,
    UpdateItemInput,
    UpdateItemOutput,
    ScanOutput, ScanInput,
} from "aws-sdk/clients/dynamodb";
import {RequestProcessor} from "../../src/services/RequestProcessor";

const mockCicService = mock<CicService>();
const mockCicSession = mock<CicSession>();
const mockedRequestProcessor = mock<RequestProcessor>();
//const mockValidationHelper = mock<ValidationHelper>();
//const mockAppError = mock<AppError>();

jest.mock('../../src/services/RequestProcessor', () => {
    return {
        RequestProcessor: jest.fn(() => mockedRequestProcessor)
    }
});

const documentClient = mock<AWS.DynamoDB.DocumentClient>({

    get: (params: GetItemInput) => {
        let promise;
        // if (params.Key?.id === FAILURE_VALUE) {
        //     promise = Promise.reject();
        // } else if (params.Key?.id === TEST_RECORD.id || params.Key?.id === TEST_RECORD.subjectId) {
        //     promise = Promise.resolve({
        //         Item: TEST_RECORD,
        //     });
        // } else {
        //     promise = Promise.resolve();
        // }
        return mock<AWS.Request<GetItemOutput, AWS.AWSError>>({
            promise: jest.fn().mockReturnValue(promise),
        });
    },

});

beforeEach(() => {
    // jest.mock('../../src/services/CicService', () => {
    //     return jest.fn().mockImplementation(() => {
    //         return {
    //             getSessionById: () => {
    //                 return ''
    //             }
    //         };
    //
    //     });


        // jest.mock('../../src/utils/ValidationHelper', () => {
        //     return { validationHelperUtils: jest.fn(() => mockValidationHelper) }
        // });

        // jest.mock('../../src/utils/AppError', () => {
        //     return { AppError: jest.fn(() => mockAppError) }
        // });

        // jest.mock('../../src/utils/ValidationHelper', () => {
        //     return jest.fn().mockImplementation(() => {
        //         return {validateModel: () => {
        //                 return ''
        //             }};
        //     });
        // });
        //validationHelperUtils.validateModel = jest.fn().mockReturnValue("");
  //  });
});



describe('Unit test for app handler', function () {
    it('verifies empty payload response', async () => {

        RequestProcessor.getInstance = jest.fn().mockReturnValue(mockedRequestProcessor);
        ///const mockDynamoDbClient = mock<DocumentClient>();
        //const savedAddress = { Item: "test" };

        //mockDynamoDbClient.get = jest.fn().mockResolvedValue(savedAddress);

        //jest.mock('../../src/services/CicService');
        //jest.mock('../../src/services/CicSession');

        // jest.mock('../../src/services/CicService', () => {
        //     return { CicService: jest.fn(() => mockCicService) }
        // });
        //console.log(CicService.name)
        //mockCicService.getSessionById.mockResolvedValue(undefined)

        const result: APIGatewayProxyResult = await lambdaHandler(event);

        console.log(result);
        expect(mockedRequestProcessor.processRequest).toBeCalledTimes(1);
        // expect(result.statusCode).toEqual(200);
        // expect(result.body).toEqual(
        //     JSON.stringify({
        //         message: 'hello world',
        //     }),
        // );
    });
});
