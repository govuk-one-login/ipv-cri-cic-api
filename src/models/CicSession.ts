import {
	ArrayNotEmpty,
	IsArray,
	IsISO8601,
	IsNotEmpty,
	IsString,
} from "class-validator";
import { ICicSession } from "./ISessionItem";

// This could be renamed to cic_payload and doesn't need to implement session?
export class CicSession implements ICicSession {
	constructor(given_names: string, family_names:string, date_of_birth:string ) {
		this.given_names_array = given_names!;
		this.family_names_array = family_names!;
		this.date_of_birth = date_of_birth!;
	}

  @IsArray()
  @ArrayNotEmpty()
  given_names_array: string;

  @IsISO8601()
  @IsNotEmpty()
  date_of_birth: string;

  @IsArray()
  @ArrayNotEmpty()
  family_names_array: string;
}
