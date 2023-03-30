import dotenv from "dotenv";
dotenv.config();

export const constants = {
	DEV_CRI_CIC_API_URL: process.env.DEV_CRI_CIC_API_URL,
	DEV_IPV_STUB_URL: process.env.DEV_IPV_STUB_URL,
};
