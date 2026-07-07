import { BadRequestException, Injectable } from "@nestjs/common";
import {
	DeleteObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { posix } from "node:path";

export const PROPERTY_IMAGES_STORAGE_PORT = Symbol(
	"PROPERTY_IMAGES_STORAGE_PORT",
);

export type SavePropertyImageInput = {
	tenantId: string;
	propertyAssetId: string;
	imageId: string;
	originalFilename: string;
	mimeType: string;
	buffer: Buffer;
};

export type SavedPropertyImage = {
	storageKey: string;
	url: string;
};

export type PropertyImagesStoragePort = {
	save(input: SavePropertyImageInput): Promise<SavedPropertyImage>;
	delete(storageKey: string): Promise<void>;
};

export type PropertyImagesStorageDriver = "local" | "s3";

type S3PropertyImagesStorageConfig = {
	bucket: string;
	endpoint?: string;
	region: string;
	accessKeyId: string;
	secretAccessKey: string;
	forcePathStyle: boolean;
	publicBaseUrl: string;
};

const PROPERTY_IMAGES_STORAGE_PREFIX = "property-images";
const UPLOADS_PUBLIC_PREFIX = "/uploads";
const ALLOWED_PROPERTY_IMAGE_EXTENSIONS = new Set([
	".jpg",
	".jpeg",
	".png",
	".webp",
]);

@Injectable()
export class LocalPropertyImagesStorage implements PropertyImagesStoragePort {
	async save(input: SavePropertyImageInput): Promise<SavedPropertyImage> {
		const storageKey = buildPropertyImageStorageKey(input);
		const absolutePath = join(getUploadsRoot(), storageKey);

		await mkdir(
			join(
				getUploadsRoot(),
				PROPERTY_IMAGES_STORAGE_PREFIX,
				input.tenantId,
				input.propertyAssetId,
			),
			{
				recursive: true,
			},
		);
		await writeFile(absolutePath, input.buffer);

		return { storageKey, url: buildLocalPropertyImageUrl(storageKey) };
	}

	async delete(storageKey: string): Promise<void> {
		const normalizedStorageKey = normalizePropertyImageStorageKey(storageKey);

		try {
			await unlink(join(getUploadsRoot(), normalizedStorageKey));
		} catch (error) {
			if (isMissingFileError(error)) {
				return;
			}

			throw error;
		}
	}
}

@Injectable()
export class S3PropertyImagesStorage implements PropertyImagesStoragePort {
	private client?: S3Client;

	assertConfigured(): void {
		getS3PropertyImagesStorageConfig();
	}

	async save(input: SavePropertyImageInput): Promise<SavedPropertyImage> {
		const config = getS3PropertyImagesStorageConfig();
		const storageKey = buildPropertyImageStorageKey(input);

		const command = new PutObjectCommand({
			Bucket: config.bucket,
			Key: storageKey,
			Body: input.buffer,
			ContentType: input.mimeType,
			ContentLength: input.buffer.byteLength,
		});

		await this.getClient(config).send(command);

		return {
			storageKey,
			url: buildS3PropertyImageUrl(storageKey, config),
		};
	}

	async delete(storageKey: string): Promise<void> {
		const config = getS3PropertyImagesStorageConfig();
		const normalizedStorageKey = normalizePropertyImageStorageKey(storageKey);
		const command = new DeleteObjectCommand({
			Bucket: config.bucket,
			Key: normalizedStorageKey,
		});

		await this.getClient(config).send(command);
	}

	private getClient(config: S3PropertyImagesStorageConfig): S3Client {
		this.client ??= new S3Client({
			region: config.region,
			endpoint: config.endpoint,
			forcePathStyle: config.forcePathStyle,
			credentials: {
				accessKeyId: config.accessKeyId,
				secretAccessKey: config.secretAccessKey,
			},
		});

		return this.client;
	}
}

export function resolvePropertyImagesStorageDriver(
	env: NodeJS.ProcessEnv = process.env,
): PropertyImagesStorageDriver {
	const driver = env.PROPERTY_IMAGES_STORAGE_DRIVER ?? "local";

	if (driver !== "local" && driver !== "s3") {
		throw new Error(
			'PROPERTY_IMAGES_STORAGE_DRIVER must be either "local" or "s3"',
		);
	}

	if (isProductionLikeEnvironment(env) && driver !== "s3") {
		throw new Error(
			"PROPERTY_IMAGES_STORAGE_DRIVER=s3 is required in production/demo mode",
		);
	}

	return driver;
}

export function buildPropertyImageUrl(storageKey: string) {
	const normalizedStorageKey = normalizePropertyImageStorageKey(storageKey);
	const driver = resolvePropertyImagesStorageDriver();

	if (driver === "s3") {
		return buildS3PropertyImageUrl(
			normalizedStorageKey,
			getS3PropertyImagesStorageConfig(),
		);
	}

	return buildLocalPropertyImageUrl(normalizedStorageKey);
}

export function normalizePropertyImageStorageKey(storageKey: string) {
	if (!storageKey || storageKey.includes("\0") || storageKey.includes("\\")) {
		throw new BadRequestException("Invalid property image storage key");
	}

	const segments = storageKey.split("/");
	if (
		segments.some(
			(segment) => segment === "" || segment === ".." || segment === ".",
		)
	) {
		throw new BadRequestException("Invalid property image storage key");
	}

	const normalized = posix.normalize(storageKey);
	if (
		normalized === "." ||
		normalized.startsWith("../") ||
		normalized === ".." ||
		posix.isAbsolute(normalized)
	) {
		throw new BadRequestException("Invalid property image storage key");
	}

	return normalized;
}

export function getUploadsRoot() {
	const configuredRoot = process.env.PROPERTY_IMAGES_UPLOADS_ROOT;

	if (configuredRoot) {
		return resolve(configuredRoot);
	}

	return join(process.cwd(), "uploads");
}

function buildPropertyImageStorageKey(input: SavePropertyImageInput) {
	const extension = getSafeExtension(input.originalFilename, input.mimeType);
	const storageKey = [
		PROPERTY_IMAGES_STORAGE_PREFIX,
		input.tenantId,
		input.propertyAssetId,
		`${input.imageId}${extension}`,
	].join("/");

	return normalizePropertyImageStorageKey(storageKey);
}

function buildLocalPropertyImageUrl(storageKey: string) {
	const origin = getPublicApiOrigin();
	return `${origin}${UPLOADS_PUBLIC_PREFIX}/${storageKey}`;
}

function buildS3PropertyImageUrl(
	storageKey: string,
	config: S3PropertyImagesStorageConfig,
) {
	const encodedStorageKey = storageKey
		.split("/")
		.map((segment) => encodeURIComponent(segment))
		.join("/");

	return `${trimTrailingSlash(config.publicBaseUrl)}/${encodedStorageKey}`;
}

function getS3PropertyImagesStorageConfig(): S3PropertyImagesStorageConfig {
	return {
		bucket: requireS3Env("PROPERTY_IMAGES_S3_BUCKET"),
		endpoint: optionalEnv("PROPERTY_IMAGES_S3_ENDPOINT"),
		region: optionalEnv("PROPERTY_IMAGES_S3_REGION") ?? "auto",
		accessKeyId: requireS3Env("PROPERTY_IMAGES_S3_ACCESS_KEY_ID"),
		secretAccessKey: requireS3Env("PROPERTY_IMAGES_S3_SECRET_ACCESS_KEY"),
		forcePathStyle: parseBooleanEnv(
			process.env.PROPERTY_IMAGES_S3_FORCE_PATH_STYLE,
		),
		publicBaseUrl: requireHttpsPublicBaseUrl("PROPERTY_IMAGES_PUBLIC_BASE_URL"),
	};
}

function getPublicApiOrigin() {
	const explicitOrigin = process.env.API_PUBLIC_URL;
	if (explicitOrigin) {
		return trimTrailingSlash(explicitOrigin);
	}

	return `http://localhost:${process.env.PORT ?? 3001}`;
}

function getSafeExtension(originalFilename: string, mimeType: string) {
	const extension = extname(originalFilename).toLowerCase();

	if (ALLOWED_PROPERTY_IMAGE_EXTENSIONS.has(extension)) {
		return extension;
	}

	const extensionByMimeType: Record<string, string> = {
		"image/jpeg": ".jpg",
		"image/png": ".png",
		"image/webp": ".webp",
	};

	return extensionByMimeType[mimeType] ?? ".bin";
}

function requireS3Env(name: string): string {
	const value = optionalEnv(name);
	if (!value) {
		throw new Error(
			`${name} is required when PROPERTY_IMAGES_STORAGE_DRIVER=s3`,
		);
	}

	return value;
}

function requireHttpsPublicBaseUrl(name: string): string {
	const value = requireS3Env(name);
	let url: URL;

	try {
		url = new URL(value);
	} catch {
		throw new Error(`${name} must be a valid HTTPS URL`);
	}

	if (url.protocol !== "https:") {
		throw new Error(`${name} must be a valid HTTPS URL`);
	}

	return value;
}

function optionalEnv(name: string): string | undefined {
	const value = process.env[name];
	return value && value.trim() ? value.trim() : undefined;
}

function parseBooleanEnv(value: string | undefined): boolean {
	return value === "true";
}

function isProductionLikeEnvironment(env: NodeJS.ProcessEnv) {
	return env.NODE_ENV === "production" || env.INMOVIEW_ENVIRONMENT === "demo";
}

function isMissingFileError(error: unknown) {
	return Boolean(
		error &&
			typeof error === "object" &&
			"code" in error &&
			error.code === "ENOENT",
	);
}

function trimTrailingSlash(value: string) {
	return value.endsWith("/") ? value.slice(0, -1) : value;
}
