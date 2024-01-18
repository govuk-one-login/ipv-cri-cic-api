export const constants = {
	DEV_CRI_CIC_API_URL: process.env.DEV_CRI_CIC_API_URL?.replace(/\/$/, ""),
	DEV_IPV_STUB_URL: process.env.DEV_IPV_STUB_URL,
	DEV_CIC_TEST_HARNESS_URL: process.env.DEV_CIC_TEST_HARNESS_URL,
	DEV_CIC_SESSION_TABLE_NAME: "session-cic-cri-ddb",
};
