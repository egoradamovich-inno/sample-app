import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class StaticLinkResponseDto {
  @ApiProperty() @Expose() code: string;
  @ApiProperty() @Expose() url: string;
}
