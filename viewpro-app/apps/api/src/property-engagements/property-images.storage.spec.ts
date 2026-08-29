import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	buildPropertyImageUrl,
	LocalPropertyImagesStorage,
	normalizePropertyImageStorageKey,
	resolvePropertyImagesStorageDriver,
	S3PropertyImagesStorage,
} from "./property-images.storage";

const ENV_KEYS = [
	"NODE_ENV",
	"INMOVIEW_ENVIRONMENT",
	"API_PUBLIC_URL",
	"PORT",
	"PROPERTY_IMAGES_UPLOADS_ROOT",
	"PROPERTY_IMAGES_STORAGE_DRIVER",
	"PROPERTY_IMAGES_S3_BUCKET",
	"PROPERTY_IMAGES_S3_ENDPOINT",
	"PROPERTY_IMAGES_S3_REGION",
	"PROPERTY_IMAGES_S3_ACCESS_KEY_ID",
	"PROPERTY_IMAGES_S3_SECRET_ACCESS_KEY",
	"PROPERTY_IMAGES_S3_FORCE_PATH_STYLE",
	"PROPERTY_IMAGES_PUBLIC_BASE_URL",
];

const originalEnv = new Map(
	ENV_KEYS.map((key) => [key, process.env[key]] as const),
);

describe("property image storage", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		restoreEnv();
	});

	it("defaults to local storage outside production-like environments", () => {
		process.env.NODE_ENV = "test";
		delete process.env.PROPERTY_IMAGES_STORAGE_DRIVER;

		expect(resolvePropertyImagesStorageDriver()).toBe("local");
	});

	it("requires s3 storage in production and demo environments", () => {
		process.env.NODE_ENV = "production";
		delete process.env.PROPERTY_IMAGES_STORAGE_DRIVER;

		expect(() => resolvePropertyImagesStorageDriver()).toThrow(
			"PROPERTY_IMAGES_STORAGE_DRIVER=s3 is required",
		);

		process.env.NODE_ENV = "test";
		process.env.INMOVIEW_ENVIRONMENT = "demo";

		expect(() => resolvePropertyImagesStorageDriver()).toThrow(
			"PROPERTY_IMAGES_STORAGE_DRIVER=s3 is required",
		);
	});

	it("rejects unknown storage drivers", () => {
		process.env.PROPERTY_IMAGES_STORAGE_DRIVER = "memory";

		expect(() => resolvePropertyImagesStorageDriver()).toThrow(
			'PROPERTY_IMAGES_STORAGE_DRIVER must be either "local" or "s3"',
		);
	});

	it("rejects unsafe storage keys", () => {
		const unsafeKeys = [
			"property-images/tenant/../image.png",
			"property-images/tenant/asset\\image.png",
			"property-images/tenant/image\0.png",
			"/property-images/tenant/asset/image.png",
		];

		for (const key of unsafeKeys) {
			expect(() => normalizePropertyImageStorageKey(key)).toThrow(
				"Invalid property image storage key",
			);
		}
	});

	it("persists local images and builds API upload URLs", async () => {
		const uploadsRoot = await mkdtemp(join(tmpdir(), "property-images-"));
		process.env.NODE_ENV = "test";
		process.env.PROPERTY_IMAGES_UPLOADS_ROOT = uploadsRoot;
		process.env.API_PUBLIC_URL = "http://localhost:3001/";

		const storage = new LocalPropertyImagesStorage();
		const savedImage = await storage.save({
			tenantId: "tenant-1",
			propertyAssetId: "asset-1",
			imageId: "image-1",
			originalFilename: "front.PNG",
			mimeType: "image/png",
			buffer: Buffer.from("image bytes"),
		});

		expect(savedImage).toEqual({
			storageKey: "property-images/tenant-1/asset-1/image-1.png",
			url: "http://localhost:3001/uploads/property-images/tenant-1/asset-1/image-1.png",
		});
		await expect(
			readFile(join(uploadsRoot, savedImage.storageKey), "utf8"),
		).resolves.toBe("image bytes");

		await storage.delete(savedImage.storageKey);
		await expect(
			readFile(join(uploadsRoot, savedImage.storageKey), "utf8"),
		).rejects.toThrow(/ENOENT/);
		await rm(uploadsRoot, { force: true, recursive: true });
	});

	it("uploads and deletes S3 images with normalized keys and public URLs", async () => {
		configureS3Env();
		const send = vi.fn().mockResolvedValue({});
		const storage = new S3PropertyImagesStorage();
		Reflect.set(storage, "client", { send });

		const savedImage = await storage.save({
			tenantId: "tenant-1",
			propertyAssetId: "asset-1",
			imageId: "image-1",
			originalFilename: "front.jpg",
			mimeType: "image/jpeg",
			buffer: Buffer.from("jpeg bytes"),
		});

		expect(savedImage).toEqual({
			storageKey: "property-images/tenant-1/asset-1/image-1.jpg",
			url: "https://images.inmoview.app/property-images/tenant-1/asset-1/image-1.jpg",
		});
		expect(send).toHaveBeenCalledTimes(1);
		expect(send.mock.calls[0]?.[0]).toBeInstanceOf(PutObjectCommand);
		expect(send.mock.calls[0]?.[0].input).toMatchObject({
			Bucket: "property-images-demo",
			Key: savedImage.storageKey,
			ContentType: "image/jpeg",
			ContentLength: 10,
		});

		await storage.delete(savedImage.storageKey);

		expect(send).toHaveBeenCalledTimes(2);
		expect(send.mock.calls[1]?.[0]).toBeInstanceOf(DeleteObjectCommand);
		expect(send.mock.calls[1]?.[0].input).toMatchObject({
			Bucket: "property-images-demo",
			Key: savedImage.storageKey,
		});
	});

	it("requires a public HTTPS base URL before generating S3 image URLs", () => {
		configureS3Env();
		delete process.env.PROPERTY_IMAGES_PUBLIC_BASE_URL;

		expect(() =>
			buildPropertyImageUrl("property-images/tenant/asset/image.png"),
		).toThrow("PROPERTY_IMAGES_PUBLIC_BASE_URL is required");

		process.env.PROPERTY_IMAGES_PUBLIC_BASE_URL = "http://images.inmoview.app";

		expect(() =>
			buildPropertyImageUrl("property-images/tenant/asset/image.png"),
		).toThrow("PROPERTY_IMAGES_PUBLIC_BASE_URL must be a valid HTTPS URL");
	});
});

function configureS3Env() {
	process.env.NODE_ENV = "production";
	process.env.PROPERTY_IMAGES_STORAGE_DRIVER = "s3";
	process.env.PROPERTY_IMAGES_S3_BUCKET = "property-images-demo";
	process.env.PROPERTY_IMAGES_S3_ENDPOINT = "https://r2.example.test";
	process.env.PROPERTY_IMAGES_S3_REGION = "auto";
	process.env.PROPERTY_IMAGES_S3_ACCESS_KEY_ID = "test-access-key-id";
	process.env.PROPERTY_IMAGES_S3_SECRET_ACCESS_KEY = "test-secret-access-key";
	process.env.PROPERTY_IMAGES_S3_FORCE_PATH_STYLE = "true";
	process.env.PROPERTY_IMAGES_PUBLIC_BASE_URL = "https://images.inmoview.app/";
}

function restoreEnv() {
	for (const key of ENV_KEYS) {
		const originalValue = originalEnv.get(key);
		if (originalValue === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = originalValue;
		}
	}
}
