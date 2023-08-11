export const constants = {
	DEV_CRI_CIC_API_URL: process.env.DEV_CRI_CIC_API_URL?.replace(/\/$/, ""),
	DEV_IPV_STUB_URL: process.env.DEV_IPV_STUB_URL,
	DEV_F2F_TEST_HARNESS_URL: process.env.DEV_F2F_TEST_HARNESS_URL,
	DEV_F2F_SESSION_TABLE_NAME: "session-f2f-cri-ddb",
};
