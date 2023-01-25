import {RequestProcessor} from "../../../src/services/RequestProcessor";
import {Metrics} from "@aws-lambda-powertools/metrics";
import { mock } from 'jest-mock-extended';
import {Logger} from "@aws-lambda-powertools/logger";
import {event} from "../data/events";
import {CicService} from "../../../src/services/CicService";
import {SessionItem} from "../../../src/models/SessionItem";
import {Response} from "../../../src/utils/Response";
import {CicResponse} from "../../../src/utils/CicResponse";

let requestProcessorTest: RequestProcessor;

export const mockCicService = mock<CicService>();
//mockCicService.getInstance = () => mockCicService
// jest.mock('../../../src/services/CicService', () => {
//     return {
//         CicService: jest.fn(() => mockCicService)
//     }
// });


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
    //CicService.getInstance = jest.fn().mockReturnValue(mockCicService);

    // mockCicService.fn().mockImplementation(() => {
    //     getSessionById: () => {
    //         return ''
    //     }
    // })
    //mockCicService.getSessionById
    requestProcessorTest = new RequestProcessor(logger,metrics);
    requestProcessorTest.cicService = mockCicService

})

beforeEach(() => {
    jest.clearAllMocks();
})

describe("RequestProcessor", () => {


        it("PreLinkEvent should be successful for Home, sampledId ending 0-7", async () => {

            const sess:SessionItem  = new SessionItem()
            sess.redirectUri="http"
            mockCicService.getSessionById.mockResolvedValue(sess);

            const out: Response = await requestProcessorTest.processRequest(event, "1234");

            console.log(out.body)

            const cicResp = new CicResponse(JSON.parse(out.body));
            console.log(cicResp.authorizationCode)

            expect(mockCicService.getSessionById).toBeCalledTimes(1);
            expect(out).toContain({
                statusCode: 204,
                body: {"authorizationCode":`${cicResp.authorizationCode}`,"redirectUri":"http"}
            })
            //expect(awsService.sendSQSMessage).toHaveBeenLastCalledWith(expect.any(SQSMessage), 'VALIDATION_SQS_URL')
        });
    });
