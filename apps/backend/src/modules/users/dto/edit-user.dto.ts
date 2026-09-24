import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateTrainerDto } from './create-trainer.dto';

// email/role are absent from this DTO's shape entirely — with the global
// ValidationPipe's forbidNonWhitelisted:true, sending either rejects with
// 400 VALIDATION_ERROR rather than silently applying the change.
export class EditUserDto extends PartialType(
  OmitType(CreateTrainerDto, ['email'] as const),
) {}
