var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { CicSession } from "../models/CicSession";
import { Response } from "../utils/Response";
import { CicService } from "./CicService";
import { MetricUnits } from "@aws-lambda-powertools/metrics";
import { randomUUID } from "crypto";
import { ValidationHelper } from "../utils/ValidationHelper";
import { CicResponse } from "../utils/CicResponse";
import { AppError } from "../utils/AppError";
import { HttpCodesEnum } from "../utils/HttpCodesEnum";
import { absoluteTimeNow } from "../utils/DateTimeUtils";
import { createDynamoDbClient } from "../utils/DynamoDBFactory";
const SESSION_TABLE = process.env.SESSION_TABLE;
export class ClaimedIdRequestProcessor {
    constructor(logger, metrics) {
        if (!SESSION_TABLE) {
            logger.error("Environment variable SESSION_TABLE is not configured");
            throw new AppError("Service incorrectly configured", 500);
        }
        this.logger = logger;
        this.validationHelper = new ValidationHelper();
        this.metrics = metrics;
        this.cicService = CicService.getInstance(SESSION_TABLE, this.logger, createDynamoDbClient());
    }
    static getInstance(logger, metrics) {
        if (!ClaimedIdRequestProcessor.instance) {
            ClaimedIdRequestProcessor.instance = new ClaimedIdRequestProcessor(logger, metrics);
        }
        return ClaimedIdRequestProcessor.instance;
    }
    processRequest(event, sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            let cicSession;
            try {
                this.logger.debug("IN processRequest");
                const bodyParsed = JSON.parse(event.body);
                cicSession = new CicSession(bodyParsed);
                yield this.validationHelper.validateModel(cicSession, this.logger);
                this.logger.debug({ message: "CIC Session is", cicSession });
            }
            catch (error) {
                return new Response(HttpCodesEnum.BAD_REQUEST, "Missing mandatory fields in the request payload");
            }
            const session = yield this.cicService.getSessionById(sessionId);
            if (session != null) {
                const fullName = session.fullName;
                if (session.expiryDate < absoluteTimeNow()) {
                    return new Response(HttpCodesEnum.UNAUTHORIZED, `Session with session id: ${sessionId} has expired`);
                }
                this.logger.info({ message: "fullName ", fullName });
                this.logger.info({ message: "found session", session });
                this.metrics.addMetric("found session", MetricUnits.Count, 1);
                yield this.cicService.saveCICData(sessionId, cicSession);
                const authCode = randomUUID();
                yield this.cicService.setAuthorizationCode(sessionId, authCode);
                const cicResp = new CicResponse({
                    authorizationCode: authCode,
                    redirect_uri: session === null || session === void 0 ? void 0 : session.redirectUri,
                    state: session === null || session === void 0 ? void 0 : session.state,
                });
                return new Response(HttpCodesEnum.OK, JSON.stringify(cicResp));
            }
            else {
                return new Response(HttpCodesEnum.UNAUTHORIZED, `No session found with the session id: ${sessionId}`);
            }
        });
    }
}
