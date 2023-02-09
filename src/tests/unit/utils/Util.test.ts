import { getAuthorizationCodeExpirationEpoch } from "../../../utils/DateTimeUtils";

const mockDateObject = new Date("2023-02-09T15:00:00.652Z");
const spy = jest
	.spyOn(Date, "now")
	.mockImplementation(() => mockDateObject.getTime());

describe("UtilTest", () => {
	it("should validate return a valid time in epoch after 10 secs when TTL is set", async () => {
		const res = getAuthorizationCodeExpirationEpoch("10");
		expect(res).toEqual(1675954810652);
	});

	it("should validate return a valid time in epoch after 10 mins when TTL is not set", async () => {
		const res = getAuthorizationCodeExpirationEpoch("");
		expect(res).toEqual(1675955400652);
	});
});
