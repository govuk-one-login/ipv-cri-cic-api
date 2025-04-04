import express from "express";
import { accessTokenRouter } from "./routes/AccessTokenRoute";
import { userInfoRouter } from "./routes/UserInfoRoute";
import bodyParser from "body-parser";
import { Logger } from "@aws-lambda-powertools/logger";
import { Constants } from "./utils/Constants";

const logger = new Logger({
	logLevel: "DEBUG",
	serviceName: "CicCriProvider",
});

const app = express();
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


const port = Constants.LOCAL_APP_PORT;
app.use(Constants.TOKEN_ENDPOINT, accessTokenRouter);
app.use(Constants.USERINFO_ENDPOINT, userInfoRouter);

app.listen(port, () => {
	logger.debug(`Contract testing app listening on port ${port}`);
});



