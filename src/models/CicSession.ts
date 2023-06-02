import {
	ArrayNotEmpty,
	IsArray,
	IsISO8601,
	IsNotEmpty,
	ArrayNotContains,
} from "class-validator";
import {
  ICicSession, 
  PersonIdentityNamePart,
  PersonIdentityName,
  PersonIdentityDateOfBirth
} from "./PersonIdentityItem"

export class CicSession implements ICicSession {
    constructor(givenNames: string, familyNames: string, birthDate: string) {
      this.personNames =  this.mapCICNames(givenNames.split(" "), familyNames.split(" "));
      this.birthDates = this.mapCICBirthDay(birthDate);
    }

  @IsArray()
  @ArrayNotEmpty()
  @ArrayNotContains([""])
  personNames:PersonIdentityName[];

  @IsArray()
  @ArrayNotEmpty()
  @ArrayNotContains([""])
  birthDates:PersonIdentityDateOfBirth[];

  private mapCICNames(givenNames: string[], familyNames: string[]) {
    const nameParts: PersonIdentityNamePart[] = [];
    givenNames.forEach((givenName) => {
      nameParts.push(
        {
          type: "GivenName",
          value: givenName,
        },
      );
    });
    familyNames.forEach((familyName) => {
      nameParts.push(
        {
          type: "FamilyName",
          value: familyName,
        },
      );
    });
    return [
      {
        nameParts,
      },
    ];
  }

  private mapCICBirthDay(birthDay: string) {
    return [
      {
        value: birthDay,
      },
    ];
  }

}