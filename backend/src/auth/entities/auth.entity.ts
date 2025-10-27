import {Column, Entity, PrimaryGeneratedColumn} from 'typeorm';

@Entity()
export class Company {
    @PrimaryGeneratedColumn()
    idCompany: number;

    @Column({unique: true})
    company: string;

    @Column({unique: true})
    rnc: string;

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

    @Column({default: 'pending'})
    state: string;
}
