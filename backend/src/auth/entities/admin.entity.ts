import {Column, Entity, PrimaryGeneratedColumn} from 'typeorm';

@Entity()
export class Admin {
    @PrimaryGeneratedColumn()
    idUser: number;

    @Column()
    username: string;

    @Column({unique: true})
    email: string;

    @Column()
    password: string;

    @Column({type: 'timestamp', default: ()=>'CURRENT_TIMESTAMP'})
    creationDate: Date;

    @Column({nullable: true})
    lastConection: Date;

    @Column({type: 'boolean', default: false})
    isOnline: boolean;
}
