import { Module } from "@nestjs/common";
import { ConfigModule as NestConfigModule } from "@nestjs/config";
import { appConfig } from "./app.config";
import { validateEnv } from "./env.schema";

@Module({
	imports: [
		NestConfigModule.forRoot({
			isGlobal: true,
			cache: true,
			envFilePath: process.env.NODE_ENV === "test" ? [".env.test"] : [".env"],
			load: [appConfig],
			validate: validateEnv,
		}),
	],
})
export class ConfigModule {}
