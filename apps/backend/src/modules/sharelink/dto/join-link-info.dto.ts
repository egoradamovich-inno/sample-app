import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { ShareLinkType } from '../../../../generated/prisma/enums';

export class JoinLinkFamilyMemberDto {
  @ApiProperty() @Expose() id: string;
  @ApiProperty() @Expose() name: string;
  @ApiPropertyOptional() @Expose() age?: number;
}

export class JoinLinkInfoDto {
  @ApiProperty() @Expose() trainerName: string;
  @ApiProperty({ enum: ShareLinkType }) @Expose() linkType: ShareLinkType;
  @ApiPropertyOptional() @Expose() blocked?: boolean;
  @ApiPropertyOptional() @Expose() familySelectionNeeded?: boolean;
  @ApiPropertyOptional({ type: [JoinLinkFamilyMemberDto] })
  @Expose()
  familyMembers?: JoinLinkFamilyMemberDto[];
}
