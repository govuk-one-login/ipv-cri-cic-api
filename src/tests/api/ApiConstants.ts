export const constants = {
	DEV_CRI_CIC_API_URL: process.env.DEV_CRI_CIC_API_URL?.replace(/\/$/, ""),
	DEV_IPV_STUB_URL: process.env.DEV_IPV_STUB_URL,
	DEV_CIC_TEST_HARNESS_URL: process.env.DEV_CIC_TEST_HARNESS_URL,
	DEV_CIC_SESSION_TABLE_NAME: process.env.DEV_CIC_SESSION_TABLE_NAME!,
	VC_SIGNING_KEY_ID: process.env.VC_SIGNING_KEY_ID,
	DNS_SUFFIX: process.env.DNS_SUFFIX,
};
