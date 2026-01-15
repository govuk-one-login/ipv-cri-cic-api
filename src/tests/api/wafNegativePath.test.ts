import axios from "axios";
import { constants } from "./ApiConstants";

const API_INSTANCE = axios.create({ baseURL:constants.DEV_CRI_CIC_API_URL });

//QualityGateSmokeTest
describe("CIC backend API WAF association smoke test", () => {
	it("should filter this bad request with a very long body", async () => {
		const path = "/session";
		const body = "x".repeat(20000);
		const response = await API_INSTANCE.post(path, body, {
			validateStatus: status => (status >= 200 && status < 501),
		});
		expect(response.status).toBe(403);
		expect(response.data).toEqual(expect.objectContaining({
			message: "Forbidden",
		}));
	});
});
