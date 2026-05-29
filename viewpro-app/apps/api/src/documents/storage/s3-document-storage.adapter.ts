import { BadRequestException, Injectable } from "@nestjs/common";
import {
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { posix } from "node:path";
import {
	ALLOWED_DOCUMENT_MIME_TYPES,
	MAX_DOCUMENT_UPLOAD_SIZE_BYTES,
} from "../document-upload-constraints";
import type {
	CreateDocumentReadUrlInput,
	CreateDocumentUploadUrlInput,
	DocumentStoragePort,
	SignedStorageUrl,
} from "./document-storage.port";

type S3DocumentStorageConfig = {
	bucket: string;
	endpoint?: string;
	region: string;
	accessKeyId: string;
	secretAccessKey: string;
	forcePathStyle: boolean;
};

@Injectable()
export class S3DocumentStorageAdapter implements DocumentStoragePort {
	private client?: S3Client;

	assertConfigured(): void {
		getS3DocumentStorageConfig();
	}

	async createUploadUrl(
		input: CreateDocumentUploadUrlInput,
	): Promise<SignedStorageUrl> {
		const config = getS3DocumentStorageConfig();
		const storageKey = normalizeStorageKey(input.storageKey);

		if (input.mimeType && !ALLOWED_DOCUMENT_MIME_TYPES.has(input.mimeType)) {
			throw new BadRequestException("Unsupported document MIME type");
		}
		if (
			input.sizeBytes !== undefined &&
			(input.sizeBytes < 1 || input.sizeBytes > MAX_DOCUMENT_UPLOAD_SIZE_BYTES)
		) {
			throw new BadRequestException("Invalid document upload size");
		}

		const command = new PutObjectCommand({
			Bucket: config.bucket,
			Key: storageKey,
			ContentType: input.mimeType,
			ContentLength: input.sizeBytes,
		});
		const signableHeaders = new Set(["content-type"]);
		if (input.sizeBytes !== undefined) {
			signableHeaders.add("content-length");
		}

		const url = await getSignedUrl(this.getClient(config), command, {
			expiresIn: input.expiresInSeconds,
			signableHeaders,
		});

		return {
			url,
			storageKey,
			expiresInSeconds: input.expiresInSeconds,
		};
	}

	async createReadUrl(
		input: CreateDocumentReadUrlInput,
	): Promise<SignedStorageUrl> {
		const config = getS3DocumentStorageConfig();
		const storageKey = normalizeStorageKey(input.storageKey);
		const command = new GetObjectCommand({
			Bucket: config.bucket,
			Key: storageKey,
		});
		const url = await getSignedUrl(this.getClient(config), command, {
			expiresIn: input.expiresInSeconds,
		});

		return {
			url,
			storageKey,
			expiresInSeconds: input.expiresInSeconds,
		};
	}

	private getClient(config: S3DocumentStorageConfig): S3Client {
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

function getS3DocumentStorageConfig(): S3DocumentStorageConfig {
	return {
		bucket: requireEnv("DOCUMENT_STORAGE_S3_BUCKET"),
		endpoint: optionalEnv("DOCUMENT_STORAGE_S3_ENDPOINT"),
		region: optionalEnv("DOCUMENT_STORAGE_S3_REGION") ?? "auto",
		accessKeyId: requireEnv("DOCUMENT_STORAGE_S3_ACCESS_KEY_ID"),
		secretAccessKey: requireEnv("DOCUMENT_STORAGE_S3_SECRET_ACCESS_KEY"),
		forcePathStyle: parseBooleanEnv(
			process.env.DOCUMENT_STORAGE_S3_FORCE_PATH_STYLE,
		),
	};
}

function requireEnv(name: string): string {
	const value = optionalEnv(name);
	if (!value) {
		throw new Error(`${name} is required when DOCUMENT_STORAGE_DRIVER=s3`);
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

function normalizeStorageKey(storageKey: string): string {
	if (!storageKey || storageKey.includes("\0") || storageKey.includes("\\")) {
		throw new BadRequestException("Invalid document storage key");
	}

	const segments = storageKey.split("/");
	if (segments.some((segment) => segment === ".." || segment === ".")) {
		throw new BadRequestException("Invalid document storage key");
	}

	const normalized = posix.normalize(storageKey);
	if (
		normalized === "." ||
		normalized.startsWith("../") ||
		normalized === ".." ||
		posix.isAbsolute(normalized)
	) {
		throw new BadRequestException("Invalid document storage key");
	}

	return normalized;
}
