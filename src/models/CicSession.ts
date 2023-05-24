import {
	ArrayNotEmpty,
	IsArray,
	IsISO8601,
	IsNotEmpty,
	IsString,
} from "class-validator";
import { ICicSession } from "./ISessionItem";

// This could be renamed to shared_claims and doesn't need to implement session?
export class CicSession implements ICicSession {
	constructor(data: CicSession) {
		this.given_names = data.given_names!;
		this.family_names = data.family_names!;
		this.date_of_birth = data.date_of_birth!;
	}

  @IsArray()
  @ArrayNotEmpty()
  given_names: string[];

  @IsISO8601()
  @IsNotEmpty()
  date_of_birth: string;

  @IsArray()
  @ArrayNotEmpty()
  family_names: string[];
}
