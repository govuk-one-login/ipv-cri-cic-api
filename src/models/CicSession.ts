import { IsISO8601, IsNotEmpty, IsString } from "class-validator";
import { ICicSession } from "./ISessionItem";

export class CicSession implements ICicSession {
	constructor(data: CicSession) {
		this.fullName = data.fullName!;
		this.dateOfBirth = data.dateOfBirth!;
		this.documentSelected = data.documentSelected!;
		this.dateOfExpiry = data.dateOfExpiry!;
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
}
