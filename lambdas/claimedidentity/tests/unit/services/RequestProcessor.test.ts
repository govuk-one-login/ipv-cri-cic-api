import {RequestProcessor} from "../../../src/services/RequestProcessor";
import {Metrics} from "@aws-lambda-powertools/metrics";
import mock = jest.mock;
import {Logger} from "@aws-lambda-powertools/logger";
import {event} from "../data/events";
import {CicService} from "../../../src/services/CicService";

let requestProcessorTest: RequestProcessor;

export const mockCicService = mock<CicService>("");
jest.mock('../../../src/services/CicService', () => {
    return {
        CicService: jest.fn(() => mockCicService)
    }
});

// jest.mock('../../../src/services/CicService', () => {
//     return jest.fn().mockImplementation(() => {
//         return {getSessionById: () => {
//                 return ''
//             }};
//     });
// });
const logger = new Logger({
    logLevel: 'DEBUG',
    serviceName: 'CIC'
});
const metrics = new Metrics({ namespace: 'CIC' });

beforeAll(() => {
    CicService.getInstance = jest.fn().mockReturnValue(mockCicService);
    //mockCicService.getSessionById
    requestProcessorTest = new RequestProcessor(logger,metrics);

})

beforeEach(() => {
    jest.clearAllMocks();
})

describe("RequestProcessor", () => {


        it("PreLinkEvent should be successful for Home, sampledId ending 0-7", async () => {


            await requestProcessorTest.processRequest(event, "1234");

            //expect(tdsService.prelinkTestSubmission).toBeCalledTimes(0);
            //expect(awsService.sendSQSMessage).toHaveBeenLastCalledWith(expect.any(SQSMessage), 'VALIDATION_SQS_URL')
        });
    });
