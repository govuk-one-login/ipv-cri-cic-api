import {
	ArrayNotEmpty,
	IsArray,
	IsISO8601,
	IsNotEmpty,
	ArrayNotContains,
	Matches,
} from "class-validator";
import { ICicSession } from "./ISessionItem";

export class CicSession implements ICicSession {
	constructor(data: CicSession) {
		this.given_names = data.given_names!;
		this.family_names = data.family_names!;
		this.date_of_birth = data.date_of_birth!;
	}

  @IsArray()
  @ArrayNotEmpty()
  @ArrayNotContains([""])
  given_names: string[];

  @IsISO8601()
  @IsNotEmpty()
  date_of_birth: string;

  @Matches(/^[a-zA-Z.'-]+( [a-zA-Z.'-]+)*$/)
  @IsNotEmpty()
  family_names: string;
}
