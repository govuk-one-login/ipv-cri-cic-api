import { Logger } from "@aws-lambda-powertools/logger";
import { Verifier, VerifierOptions } from "@pact-foundation/pact";
import { Constants } from "./utils/Constants";
import path from "path";

const logger = new Logger({
	logLevel: "INFO",
	serviceName: "CicCriProviderTest",
});

const pactFile = path.resolve("./tests/contract/pacts/IpvCoreBack-CicCriProviderAll.json");

let opts: VerifierOptions;
// Verify that the provider meets all consumer expectations
describe("Pact Verification", () => {
	beforeAll(() => {  
		opts = {
			// we need to know the providers name
			provider: "CicCriProvider",
			// we are starting the provider locally
			providerBaseUrl: `${Constants.LOCAL_HOST}:${Constants.LOCAL_APP_PORT}`,
			// pactBrokerUrl: process.env.PACT_BROKER_URL,
			// pactBrokerUsername: process.env.PACT_BROKER_USER,
    		// pactBrokerPassword: process.env.PACT_BROKER_PASSWORD,
			// consumerVersionSelectors: [
			// 	{ mainBranch: true },
			// 	{ deployedOrReleased: true },
			//   ],		
			pactUrls: [pactFile],	
			publishVerificationResult: true,
			providerVersion: "1.0.0",
			// You can set the log level here, useful for debugging
			logLevel: "info",
		};
	});  
  
	it("tests against potential new contracts", async () => {
		logger.debug("PactBroker opts: ", { opts });
		let result;
		await new Verifier(opts)
			.verifyProvider()
			.then((output) => {
				logger.info("Pact Verification Complete!");
				logger.info("Output: ", output);
				result = Number(output.match(/\d+/));				
			})
			.catch((error) => {
				logger.error("Pact verification failed :(", { error });
				result = 1;
			});
		expect(result).toBe(0);		
	});
});
