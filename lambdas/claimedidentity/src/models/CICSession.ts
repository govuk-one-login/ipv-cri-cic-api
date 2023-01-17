import { IsISO8601, IsNotEmpty, IsString } from "class-validator";

export class CICSession {

    constructor(data: CICSession) {
        this.fullName = data.fullName!;
        this.dateOfBirth = data.dateOfBirth!;
        this.documentSelected = data.documentSelected!;
        this.dateOfExpiry = data.dateOfExpiry!;
        this.typeName = "CICSession"
    }

    @IsString()
    @IsNotEmpty()
    fullName: string;

    @IsISO8601()
    @IsNotEmpty()
    dateOfBirth: string;

    @IsString()
    @IsNotEmpty()
    documentSelected: string;

    @IsISO8601()
    @IsNotEmpty()
    dateOfExpiry: string;

    typeName: string;

}
