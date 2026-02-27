import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';

type UserRecord = {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
};

@Injectable()
export class UsersService {
  private users: UserRecord[] = [];
  private sequence = 1;

  create(createUserDto: CreateUserDto) {
    const user: UserRecord = {
      id: this.sequence++,
      name: createUserDto.name,
      email: createUserDto.email,
      createdAt: new Date(),
    };

    this.users.push(user);
    return user;
  }

  findAll() {
    return this.users;
  }
}
