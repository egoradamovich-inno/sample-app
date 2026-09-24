import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class TrainerAssociationSummaryDto {
  @ApiProperty() @Expose() trainerId: string;
  @ApiProperty() @Expose() trainerName: string;
  @ApiProperty() @Expose() status: string;
}

export class PlayerProfileSummaryDto {
  @ApiProperty() @Expose() id: string;
  @ApiProperty() @Expose() displayName: string;
  @ApiProperty({ nullable: true }) @Expose() birthDate: string | null;
  @ApiProperty() @Expose() isChild: boolean;
  @ApiProperty({ type: [TrainerAssociationSummaryDto] })
  @Expose()
  trainerAssociations: TrainerAssociationSummaryDto[];
}

export class CreateChildProfileResponseDto extends PlayerProfileSummaryDto {
  @ApiPropertyOptional() @Expose() duplicateWarning?: boolean;
  @ApiPropertyOptional({ enum: ['single', 'multi'], nullable: true })
  @Expose()
  trainerSelectionPrompt?: 'single' | 'multi' | null;
}
