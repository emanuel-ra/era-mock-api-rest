import { BaseEntity } from '../../core/entities/base.entity';
import { Role } from '../../core/decorators/roles.decorator';

export class UserEntity extends BaseEntity {
  email: string;
  password: string; // bcrypt hashed
  name: string;
  role: Role;
}
