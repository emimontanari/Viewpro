import { BadRequestException } from "@nestjs/common";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveDocumentStorageDriver } from "../src/documents/documents.module";
import { FakeDocumentStorageAdapter } from "../src/documents/storage/fake-document-storage.adapter";
import { S3DocumentStorageAdapter } from "../src/documents/storage/s3-document-storage.adapter";

vi.mock("@aws-sdk/s3-request-presigner", () => ({
	getSignedUrl: vi.fn(async (_client, command, options) => {
		const input = (command as { input: { Bucket: string; Key: string } }).input;
		return `https://signed-storage.local/${input.Bucket}/${encodeURIComponent(input.Key)}?expires=${options?.expiresIn}`;
	}),
}));

const getSignedUrlMock = vi.mocked(getSignedUrl);
const s3EnvNames = [
	"DOCUMENT_STORAGE_S3_BUCKET",
	"DOCUMENT_STORAGE_S3_ENDPOINT",
	"DOCUMENT_STORAGE_S3_REGION",
	"DOCUMENT_STORAGE_S3_ACCESS_KEY_ID",
	"DOCUMENT_STORAGE_S3_SECRET_ACCESS_KEY",
	"DOCUMENT_STORAGE_S3_FORCE_PATH_STYLE",
] as const;

describe("Fake document storage adapter", () => {
	it("creates deterministic upload URLs containing the storage key and TTL", async () => {
		const storage = new FakeDocumentStorageAdapter();

		await expect(
			storage.createUploadUrl({
				storageKey: "documents/request-1/version-1.pdf",
				expiresInSeconds: 600,
			}),
		).resolves.toEqual({
			url: "https://fake-documents.local/upload/documents%2Frequest-1%2Fversion-1.pdf",
			storageKey: "documents/request-1/version-1.pdf",
			expiresInSeconds: 600,
		});
	});

	it("creates deterministic read URLs containing the storage key and TTL", async () => {
		const storage = new FakeDocumentStorageAdapter();

		await expect(
			storage.createReadUrl({
				storageKey: "documents/request-1/version-1.pdf",
				expiresInSeconds: 300,
			}),
		).resolves.toEqual({
			url: "https://fake-documents.local/read/documents%2Frequest-1%2Fversion-1.pdf",
			storageKey: "documents/request-1/version-1.pdf",
			expiresInSeconds: 300,
		});
	});
});

describe("document storage driver selection", () => {
	const previousNodeEnv = process.env.NODE_ENV;
	const previousDriver = process.env.DOCUMENT_STORAGE_DRIVER;

	afterEach(() => {
		restoreEnv("NODE_ENV", previousNodeEnv);
		restoreEnv("DOCUMENT_STORAGE_DRIVER", previousDriver);
	});

	it("fails closed instead of using fake storage in production", () => {
		process.env.NODE_ENV = "production";
		delete process.env.DOCUMENT_STORAGE_DRIVER;

		expect(() => resolveDocumentStorageDriver()).toThrow(
			"DOCUMENT_STORAGE_DRIVER=s3 is required in production",
		);
	});

	it("allows explicit S3-compatible storage in production", () => {
		process.env.NODE_ENV = "production";
		process.env.DOCUMENT_STORAGE_DRIVER = "s3";

		expect(resolveDocumentStorageDriver()).toBe("s3");
	});
});

describe("S3-compatible document storage adapter", () => {
	beforeEach(() => {
		getSignedUrlMock.mockClear();
		setS3Env();
	});

	afterEach(() => {
		for (const name of s3EnvNames) {
			delete process.env[name];
		}
	});

	it("creates a time-limited signed PUT URL with MIME and exact size constraints", async () => {
		const storage = new S3DocumentStorageAdapter();

		const result = await storage.createUploadUrl({
			storageKey: "document-requests/request-1/deed.pdf",
			expiresInSeconds: 600,
			mimeType: "application/pdf",
			sizeBytes: 1024,
		});

		expect(result).toEqual({
			url: "https://signed-storage.local/viewpro-documents/document-requests%2Frequest-1%2Fdeed.pdf?expires=600",
			storageKey: "document-requests/request-1/deed.pdf",
			expiresInSeconds: 600,
		});

		const [, command, options] = getSignedUrlMock.mock.calls[0];
		expect(command).toBeInstanceOf(PutObjectCommand);
		expect((command as PutObjectCommand).input).toMatchObject({
			Bucket: "viewpro-documents",
			Key: "document-requests/request-1/deed.pdf",
			ContentType: "application/pdf",
			ContentLength: 1024,
		});
		expect(options).toMatchObject({ expiresIn: 600 });
		expect(options?.signableHeaders).toEqual(
			new Set(["content-type", "content-length"]),
		);
	});

	it("creates a time-limited signed GET URL for a private object", async () => {
		const storage = new S3DocumentStorageAdapter();

		const result = await storage.createReadUrl({
			storageKey: "document-requests/request-1/deed.pdf",
			expiresInSeconds: 300,
		});

		expect(result).toEqual({
			url: "https://signed-storage.local/viewpro-documents/document-requests%2Frequest-1%2Fdeed.pdf?expires=300",
			storageKey: "document-requests/request-1/deed.pdf",
			expiresInSeconds: 300,
		});

		const [, command, options] = getSignedUrlMock.mock.calls[0];
		expect(command).toBeInstanceOf(GetObjectCommand);
		expect((command as GetObjectCommand).input).toMatchObject({
			Bucket: "viewpro-documents",
			Key: "document-requests/request-1/deed.pdf",
		});
		expect(options).toMatchObject({ expiresIn: 300 });
	});

	it("rejects invalid storage keys, MIME types, and upload sizes before signing", async () => {
		const storage = new S3DocumentStorageAdapter();

		await expect(
			storage.createUploadUrl({
				storageKey: "../escape.pdf",
				expiresInSeconds: 600,
				mimeType: "application/pdf",
				sizeBytes: 3,
			}),
		).rejects.toThrow(BadRequestException);

		await expect(
			storage.createUploadUrl({
				storageKey: "document-requests/request-1/script.js",
				expiresInSeconds: 600,
				mimeType: "application/javascript",
				sizeBytes: 3,
			}),
		).rejects.toThrow(BadRequestException);

		await expect(
			storage.createUploadUrl({
				storageKey: "document-requests/request-1/large.pdf",
				expiresInSeconds: 600,
				mimeType: "application/pdf",
				sizeBytes: 11 * 1024 * 1024,
			}),
		).rejects.toThrow(BadRequestException);

		expect(getSignedUrlMock).not.toHaveBeenCalled();
	});

	it("requires bucket and credentials before signing", async () => {
		delete process.env.DOCUMENT_STORAGE_S3_BUCKET;
		const storage = new S3DocumentStorageAdapter();

		await expect(
			storage.createReadUrl({
				storageKey: "document-requests/request-1/deed.pdf",
				expiresInSeconds: 300,
			}),
		).rejects.toThrow("DOCUMENT_STORAGE_S3_BUCKET is required");
	});
});

function restoreEnv(name: string, value: string | undefined) {
	if (value === undefined) {
		delete process.env[name];
		return;
	}

	process.env[name] = value;
}

function setS3Env() {
	process.env.DOCUMENT_STORAGE_S3_BUCKET = "viewpro-documents";
	process.env.DOCUMENT_STORAGE_S3_ENDPOINT =
		"https://example-account.r2.cloudflarestorage.com";
	process.env.DOCUMENT_STORAGE_S3_REGION = "auto";
	process.env.DOCUMENT_STORAGE_S3_ACCESS_KEY_ID = "test-access-key";
	process.env.DOCUMENT_STORAGE_S3_SECRET_ACCESS_KEY = "test-secret-key";
}
