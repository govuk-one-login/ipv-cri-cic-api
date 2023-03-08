import {
	ArrayNotEmpty,
	IsArray,
	IsISO8601,
	IsNotEmpty,
	IsString,
} from "class-validator";
import { ICicSession } from "./ISessionItem";

export class CicSession implements ICicSession {
	constructor(data: CicSession) {
		this.given_names = data.given_names!;
		this.family_names = data.family_names!;
		this.date_of_birth = data.date_of_birth!;
		this.document_selected = data.document_selected!;
		this.date_of_expiry = data.date_of_expiry!;
	}

  @IsArray()
  @ArrayNotEmpty()
  given_names: string [];

  @IsISO8601()
  @IsNotEmpty()
  date_of_birth: string;

  @IsString()
  @IsNotEmpty()
  document_selected: string;

  @IsISO8601()
  @IsNotEmpty()
  date_of_expiry: string;

  @IsArray()
  @ArrayNotEmpty()
  family_names: string [];
}
