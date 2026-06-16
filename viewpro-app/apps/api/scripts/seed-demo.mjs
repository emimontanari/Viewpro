import { existsSync, readFileSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { argon2id, hash } from "argon2";
import {
	AnalyticsActorType,
	AnalyticsEventName,
	DocumentRequestStatus,
	DocumentVersionStatus,
	GlobalRole,
	InterestLevel,
	MovementSource,
	MovementType,
	NotificationSurface,
	NotificationType,
	PrismaClient,
	PropertyAssetOwnerAccessStatus,
	PropertyEngagementStatus,
	PropertyOperationType,
	PropertyType,
	StatusChangeRequestStatus,
	TenantRole,
	TenantStatus,
	UserStatus,
} from "@prisma/client";

const DEMO_OUTCOME_LABELS = [
	{ label: "Esperando documentos", color: "#3B82F6" },
	{ label: "En negociación avanzada", color: "#F59E0B" },
	{ label: "Propietario no responde", color: "#EF4444" },
];

const scriptDir = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(scriptDir, "..");
const workspaceRoot = resolve(apiRoot, "../..");

loadEnvFile(resolve(workspaceRoot, ".env"));
loadEnvFile(resolve(apiRoot, ".env"));
loadEnvFile(resolve(process.cwd(), ".env"));

const DEMO_TENANT_SLUG = "viewpro-demo-inmobiliaria";
const DEMO_TENANT_NAME = "ViewPro Demo Inmobiliaria";

// ---------------------------------------------------------------------------
// Stage 26.4 — Isolation tenant constants
// ---------------------------------------------------------------------------
const DEMO_ISOLATION_TENANT_SLUG = "viewpro-isolation-tenant";
const DEMO_ISOLATION_TENANT_NAME = "ViewPro Isolation Tenant";
const DEMO_ISOLATION_MANAGER_EMAIL = "manager.isolation@viewpro.local";
const DEMO_ISOLATION_OWNER_EMAIL = "propietario.isolation@viewpro.local";
const DEMO_ISOLATION_PROPERTY_TITLE = "Propiedad isolation";
const DEMO_TENANT_WHATSAPP_PHONE =
	process.env.VIEWPRO_DEMO_TENANT_WHATSAPP_PHONE ?? "+5493510000000";
const DEMO_TENANT_LIMITS = {
	maxUsers: 12,
	maxActivePropertyEngagements: 25,
	maxDocumentsStorageMb: 512,
};
const DEMO_NOW = new Date(
	process.env.VIEWPRO_DEMO_NOW ?? "2026-06-01T12:00:00.000Z",
);
const DEMO_PASSWORD =
	process.env.VIEWPRO_DEMO_PASSWORD ?? buildDefaultDemoPassword();
const DEMO_ADMIN_USER = {
	email: "admin.demo@viewpro.local",
	firstName: "Admin",
	lastName: "ViewPro",
	globalRole: GlobalRole.VIEWPRO_ADMIN,
};
const DEMO_USERS = [
	{
		email: "demo@viewpro.local",
		firstName: "Demo",
		lastName: "ViewPro",
		role: TenantRole.PRINCIPAL_MANAGER,
	},
	{
		email: "sofia.demo@viewpro.local",
		firstName: "Sofía",
		lastName: "Demo",
		role: TenantRole.MANAGER,
	},
	{
		email: "martin.demo@viewpro.local",
		firstName: "Martín",
		lastName: "Demo",
		role: TenantRole.AGENT,
		whatsappPhone: "+5493511111111",
	},
	{
		email: "lucia.demo@viewpro.local",
		firstName: "Lucía",
		lastName: "Demo",
		role: TenantRole.AGENT,
	},
];
const DEMO_OWNER_EMAIL = "propietario.demo@viewpro.local";
const DEMO_OWNER_USER = {
	email: DEMO_OWNER_EMAIL,
	firstName: "Propietario",
	lastName: "Demo",
};
const DEMO_EXISTING_OWNER_INVITATION_TOKEN =
	"seeded-existing-owner-invitation-token";
const DEMO_EXISTING_OWNER_INVITED_PROPERTY_TITLE =
	"Casa luminosa con patio en Los Boulevares";
const DEMO_AUTH_USERS = [...DEMO_USERS, DEMO_OWNER_USER, DEMO_ADMIN_USER];

const DEMO_USER_EMAILS = DEMO_AUTH_USERS.map((user) => user.email);
const DOCUMENT_TITLES = [
	"Escritura",
	"Plano municipal",
	"Impuesto municipal",
	"DNI del propietario",
	"Reglamento de copropiedad",
	"Estado de expensas",
];
const DOCUMENT_STORAGE_PREFIX = "document-requests";
const PROPERTY_IMAGES_STORAGE_PREFIX = "property-images";
const DEMO_IMAGE_PLACEHOLDER_BUFFER = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
	"base64",
);
const DEMO_IMAGES_PER_PROPERTY = 3;
const DEMO_PROPERTY_FIXTURES_DIR = join(scriptDir, "fixtures", "properties");
const DEMO_PROPERTY_IMAGE_MAP = loadDemoPropertyImageMap();

function loadDemoPropertyImageMap() {
	const mapPath = join(scriptDir, "fixtures", "property-image-map.json");
	if (!existsSync(mapPath)) {
		return new Map();
	}
	const raw = JSON.parse(readFileSync(mapPath, "utf8"));
	const entries = (raw.mappings ?? []).map((entry) => [
		entry.seedIndex,
		entry.postingId,
	]);
	return new Map(entries);
}

function getDemoImageBuffer(seedIndex, imageIndex) {
	const postingId = DEMO_PROPERTY_IMAGE_MAP.get(seedIndex);
	if (!postingId) {
		return DEMO_IMAGE_PLACEHOLDER_BUFFER;
	}
	const fixturePath = join(
		DEMO_PROPERTY_FIXTURES_DIR,
		postingId,
		`${imageIndex}.jpg`,
	);
	if (!existsSync(fixturePath)) {
		return DEMO_IMAGE_PLACEHOLDER_BUFFER;
	}
	return readFileSync(fixturePath);
}

function getDemoImageMime(seedIndex, imageIndex) {
	const postingId = DEMO_PROPERTY_IMAGE_MAP.get(seedIndex);
	if (!postingId) return "image/png";
	const fixturePath = join(
		DEMO_PROPERTY_FIXTURES_DIR,
		postingId,
		`${imageIndex}.jpg`,
	);
	return existsSync(fixturePath) ? "image/jpeg" : "image/png";
}

function getDemoImageExtension(seedIndex, imageIndex) {
	return getDemoImageMime(seedIndex, imageIndex) === "image/jpeg"
		? "jpg"
		: "png";
}
const DEMO_PROPERTIES = [
	{
		title: "Casa familiar con pileta en Villa Centenario",
		addressLine: "Villa Centenario",
		city: "Córdoba",
		province: "Córdoba",
		propertyType: PropertyType.HOUSE,
		operationType: PropertyOperationType.SALE,
		status: PropertyEngagementStatus.ACTIVE_PUBLICATION,
		currency: "USD",
		price: 125000,
		totalAreaSqm: 360,
		coveredAreaSqm: 231,
		rooms: 7,
		bedrooms: 6,
		bathrooms: 2,
		garages: 2,
		ageYears: 25,
		orientation: "N",
	},
	{
		title: "Casa luminosa con patio en Los Boulevares",
		addressLine: "Los Boulevares",
		city: "Córdoba",
		province: "Córdoba",
		propertyType: PropertyType.HOUSE,
		operationType: PropertyOperationType.SALE,
		status: PropertyEngagementStatus.INQUIRIES_AND_VISITS,
		currency: "USD",
		price: 85000,
		totalAreaSqm: 255,
		coveredAreaSqm: 120,
		rooms: 4,
		bedrooms: 3,
		bathrooms: 1,
		garages: 2,
		ageYears: 20,
	},
	{
		title: "Casa premium en Cerro de las Rosas",
		addressLine: "Cerro de las Rosas",
		city: "Córdoba",
		province: "Córdoba",
		propertyType: PropertyType.HOUSE,
		operationType: PropertyOperationType.SALE,
		status: PropertyEngagementStatus.OFFER_NEGOTIATION,
		currency: "USD",
		price: 450000,
		totalAreaSqm: 1610,
		coveredAreaSqm: 493,
		rooms: 6,
		bedrooms: 3,
		bathrooms: 4,
		garages: 4,
		ageYears: 40,
	},
	{
		title: "Casa en barrio privado Pilara",
		addressLine: "Pilara",
		city: "Pilar",
		province: "Buenos Aires",
		propertyType: PropertyType.HOUSE,
		operationType: PropertyOperationType.SALE,
		status: PropertyEngagementStatus.PUBLICATION_PREPARATION,
		currency: "USD",
		price: 600000,
		totalAreaSqm: 792,
		coveredAreaSqm: 280,
		rooms: 6,
		bedrooms: 4,
		bathrooms: 3,
		garages: 2,
	},
	{
		title: "Casa con galería en La Lomada",
		addressLine: "La Lomada",
		city: "Pilar",
		province: "Buenos Aires",
		propertyType: PropertyType.HOUSE,
		operationType: PropertyOperationType.SALE,
		status: PropertyEngagementStatus.ACTIVE_PUBLICATION,
		currency: "USD",
		price: 610000,
		totalAreaSqm: 830,
		coveredAreaSqm: 320,
		rooms: 7,
		bedrooms: 5,
		bathrooms: 3,
		garages: 6,
		ageYears: 20,
		orientation: "NE",
	},
	{
		title: "Casa moderna en El Cantón Norte",
		addressLine: "El Cantón Norte",
		city: "Escobar",
		province: "Buenos Aires",
		propertyType: PropertyType.HOUSE,
		operationType: PropertyOperationType.SALE,
		status: PropertyEngagementStatus.INQUIRIES_AND_VISITS,
		currency: "USD",
		price: 265000,
		totalAreaSqm: 216,
		coveredAreaSqm: 176,
		rooms: 5,
		bedrooms: 3,
		bathrooms: 2,
		garages: 1,
		ageYears: 4,
		orientation: "O",
	},
	{
		title: "Casa para refaccionar en Mapuche",
		addressLine: "Mapuche Country Club",
		city: "Pilar",
		province: "Buenos Aires",
		propertyType: PropertyType.HOUSE,
		operationType: PropertyOperationType.SALE,
		status: PropertyEngagementStatus.CAPTURE,
		currency: "USD",
		price: 170000,
		totalAreaSqm: 650,
		coveredAreaSqm: 113,
		rooms: 5,
		bedrooms: 2,
		bathrooms: 3,
		garages: 6,
	},
	{
		title: "Dúplex apto crédito en Villa Cabrera",
		addressLine: "Villa Cabrera",
		city: "Córdoba",
		province: "Córdoba",
		propertyType: PropertyType.HOUSE,
		operationType: PropertyOperationType.SALE,
		status: PropertyEngagementStatus.DOCUMENTATION_PENDING,
		currency: "USD",
		price: 119000,
		totalAreaSqm: 140,
		coveredAreaSqm: 140,
		rooms: 5,
		bedrooms: 4,
		bathrooms: 2,
		garages: 1,
		ageYears: 40,
		orientation: "S",
	},
	{
		title: "Casa con jardín en Villa Catalina",
		addressLine: "Villa Catalina",
		city: "Río Ceballos",
		province: "Córdoba",
		propertyType: PropertyType.HOUSE,
		operationType: PropertyOperationType.SALE,
		status: PropertyEngagementStatus.ACTIVE_PUBLICATION,
		currency: "USD",
		price: 195000,
		totalAreaSqm: 250,
		coveredAreaSqm: 150,
		rooms: 7,
		bedrooms: 3,
		bathrooms: 2,
		garages: 2,
		ageYears: 5,
	},
	{
		title: "Casa de diseño en Los Olivares",
		addressLine: "Los Olivares",
		city: "Malvinas Argentinas",
		province: "Buenos Aires",
		propertyType: PropertyType.HOUSE,
		operationType: PropertyOperationType.SALE,
		status: PropertyEngagementStatus.INQUIRIES_AND_VISITS,
		currency: "USD",
		price: 290000,
		totalAreaSqm: 230,
		coveredAreaSqm: 191,
		rooms: 7,
		bedrooms: 4,
		bathrooms: 2,
		garages: 2,
		ageYears: 5,
		orientation: "NO",
	},
	{
		title: "Housing a estrenar en La Carolina",
		addressLine: "La Carolina",
		city: "Córdoba",
		province: "Córdoba",
		propertyType: PropertyType.HOUSE,
		operationType: PropertyOperationType.SALE,
		status: PropertyEngagementStatus.PUBLICATION_PREPARATION,
		currency: "USD",
		price: 320000,
		totalAreaSqm: 360,
		coveredAreaSqm: 270,
		rooms: 5,
		bedrooms: 3,
		bathrooms: 3,
		garages: 2,
	},
	{
		title: "Casa quinta en barrio Freixas",
		addressLine: "Freixas",
		city: "Pilar",
		province: "Buenos Aires",
		propertyType: PropertyType.HOUSE,
		operationType: PropertyOperationType.SALE,
		status: PropertyEngagementStatus.INQUIRIES_AND_VISITS,
		currency: "USD",
		price: 490000,
		totalAreaSqm: 4000,
		coveredAreaSqm: 210,
		rooms: 4,
		bedrooms: 2,
		bathrooms: 2,
		garages: 2,
		ageYears: 4,
		orientation: "N",
	},
	{
		title: "Casa en Barrio Puerto El Cantón",
		addressLine: "El Cantón Puerto",
		city: "Escobar",
		province: "Buenos Aires",
		propertyType: PropertyType.HOUSE,
		operationType: PropertyOperationType.SALE,
		status: PropertyEngagementStatus.ACTIVE_PUBLICATION,
		currency: "USD",
		price: 275000,
		totalAreaSqm: 220,
		coveredAreaSqm: 165,
		rooms: 5,
		bedrooms: 3,
		bathrooms: 2,
		garages: 2,
		ageYears: 5,
		orientation: "SE",
	},
	{
		title: "Casa amplia en Los Laureles",
		addressLine: "Los Laureles",
		city: "Pilar",
		province: "Buenos Aires",
		propertyType: PropertyType.HOUSE,
		operationType: PropertyOperationType.SALE,
		status: PropertyEngagementStatus.OFFER_NEGOTIATION,
		currency: "USD",
		price: 480000,
		totalAreaSqm: 1080,
		coveredAreaSqm: 320,
		rooms: 6,
		bedrooms: 5,
		bathrooms: 4,
		garages: 4,
	},
	{
		title: "Casa de categoría en Farm Club",
		addressLine: "Farm Club",
		city: "Pilar",
		province: "Buenos Aires",
		propertyType: PropertyType.HOUSE,
		operationType: PropertyOperationType.SALE,
		status: PropertyEngagementStatus.ACTIVE_PUBLICATION,
		currency: "USD",
		price: 1100000,
		totalAreaSqm: 3740,
		coveredAreaSqm: 619,
		rooms: 8,
		bedrooms: 5,
		bathrooms: 5,
		garages: 6,
		ageYears: 25,
		orientation: "NO",
	},
	{
		title: "Departamento con balcón en Nueva Córdoba",
		addressLine: "Nueva Córdoba",
		city: "Córdoba",
		province: "Córdoba",
		propertyType: PropertyType.APARTMENT,
		operationType: PropertyOperationType.RENT,
		status: PropertyEngagementStatus.ACTIVE_PUBLICATION,
		currency: "ARS",
		price: 650000,
		totalAreaSqm: 78,
		coveredAreaSqm: 72,
		rooms: 3,
		bedrooms: 2,
		bathrooms: 2,
		garages: 1,
		ageYears: 8,
	},
	{
		title: "Lote residencial en zona norte",
		addressLine: "Zona Norte",
		city: "Córdoba",
		province: "Córdoba",
		propertyType: PropertyType.LAND,
		operationType: PropertyOperationType.SALE,
		status: PropertyEngagementStatus.CAPTURE,
		currency: "USD",
		price: 72000,
		totalAreaSqm: 500,
	},
	{
		title: "Local comercial sobre avenida",
		addressLine: "Av. Colón",
		city: "Córdoba",
		province: "Córdoba",
		propertyType: PropertyType.COMMERCIAL,
		operationType: PropertyOperationType.RENT,
		status: PropertyEngagementStatus.FINAL_DOCUMENTATION,
		currency: "ARS",
		price: 950000,
		totalAreaSqm: 110,
		coveredAreaSqm: 110,
		bathrooms: 1,
		ageYears: 12,
	},
	{
		title: "PH reciclado en San Fernando",
		addressLine: "Victoria",
		city: "San Fernando",
		province: "Buenos Aires",
		propertyType: PropertyType.HOUSE,
		operationType: PropertyOperationType.SALE,
		status: PropertyEngagementStatus.DOCUMENTATION_PENDING,
		currency: "USD",
		price: 158000,
		totalAreaSqm: 160,
		coveredAreaSqm: 130,
		rooms: 4,
		bedrooms: 3,
		bathrooms: 2,
		garages: 1,
		ageYears: 18,
	},
	{
		title: "Casa compacta en Funes",
		addressLine: "Paseo del Norte",
		city: "Funes",
		province: "Santa Fe",
		propertyType: PropertyType.HOUSE,
		operationType: PropertyOperationType.SALE,
		status: PropertyEngagementStatus.PUBLICATION_PREPARATION,
		currency: "USD",
		price: 125000,
		totalAreaSqm: 180,
		coveredAreaSqm: 96,
		rooms: 4,
		bedrooms: 2,
		bathrooms: 2,
		garages: 1,
	},
];

assertSafeEnvironment();

const prisma = new PrismaClient();

try {
	const result = await seedDemo(prisma);
	printSummary(result);
} catch (error) {
	console.error("Demo seed failed.");
	console.error(error);
	process.exitCode = 1;
} finally {
	await prisma.$disconnect();
}

async function seedDemo(client) {
	// Reset both tenants before seeding (FK-safe order, idempotent).
	// Isolation tenant reset first so its users are cleaned up before the demo tenant users.
	await resetTenantBySlug(client, DEMO_ISOLATION_TENANT_SLUG, [
		DEMO_ISOLATION_MANAGER_EMAIL,
		DEMO_ISOLATION_OWNER_EMAIL,
	]);
	await resetTenantBySlug(client, DEMO_TENANT_SLUG, DEMO_USER_EMAILS);

	// Seed demo tenant (canonical)
	const users = await createDemoUsers(client);
	const tenant = await createDemoTenant(client, users);
	const properties = await createDemoProperties(client, tenant, users);
	await createDemoExistingOwnerInvitation(client, users, properties);
	const images = await createDemoPropertyImages(client, tenant, properties);
	const movements = await createDemoMovements(
		client,
		tenant,
		users,
		properties,
	);
	const documentRequests = await createDemoDocumentRequests(
		client,
		tenant,
		users,
		properties,
	);
	const statusChangeRequests = await createDemoStatusChangeRequests(
		client,
		tenant,
		users,
		properties,
	);
	const notifications = await createDemoNotifications(
		client,
		tenant,
		users,
		properties,
		movements,
		documentRequests,
	);
	const adminEvents = await createDemoAdminAuditEvents(client, tenant, users);
	const outcomeLabels = await createDemoOutcomeLabels(client, tenant, users);

	// Seed isolation tenant (Stage 26.4 — negative security tests)
	const isolationResult = await seedIsolationTenant(client);

	// T-5 sanity assertion: log engagement counts per tenant
	const demoEngagementCount = await client.propertyEngagement.count({
		where: { tenantId: tenant.id },
	});
	const isolationEngagementCount = await client.propertyEngagement.count({
		where: { tenantId: isolationResult.tenant.id },
	});
	console.log(`Demo tenant engagements: ${demoEngagementCount} (expected 20)`);
	console.log(`Isolation tenant engagements: ${isolationEngagementCount} (expected 1)`);
	if (demoEngagementCount !== 20) {
		throw new Error(`Demo tenant engagement count mismatch: expected 20, got ${demoEngagementCount}`);
	}
	if (isolationEngagementCount !== 1) {
		throw new Error(`Isolation tenant engagement count mismatch: expected 1, got ${isolationEngagementCount}`);
	}

	return {
		tenant,
		propertiesCount: properties.length,
		imagesCount: images.length,
		movementsCount: movements.length,
		documentRequestsCount: documentRequests.length,
		statusChangeRequestsCount: statusChangeRequests.length,
		notificationsCount: notifications.length,
		adminEventsCount: adminEvents.length,
		outcomeLabelsCount: outcomeLabels.length,
		isolationResult,
	};
}

/**
 * Resets a tenant and all its data in FK-safe deletion order.
 * Safe to call when the tenant does not exist (no-op).
 * Covers: notifications → analyticsEvent → document → documentRequest →
 *   statusChangeRequest → movement → tenantMovementOutcomeLabel →
 *   propertyAgent → propertyEngagement → propertyAssetOwner →
 *   propertyAssetImage → propertyAsset → tenantMembership → tenant.
 *
 * Also removes seeded users that are no longer referenced anywhere.
 *
 * @param {import('@prisma/client').PrismaClient} client
 * @param {string} slug  Tenant slug to reset.
 * @param {string[]} [knownUserEmails]  If provided, unreferenced users in this list are deleted after tenant removal.
 */
async function resetTenantBySlug(client, slug, knownUserEmails = []) {
	const existingTenant = await client.tenant.findUnique({
		where: { slug },
		select: { id: true },
	});

	let knownUserIds = [];
	if (knownUserEmails.length > 0) {
		const existingUsers = await client.user.findMany({
			where: { email: { in: knownUserEmails } },
			select: { id: true, email: true },
		});
		knownUserIds = existingUsers.map((user) => user.id);
	}

	if (existingTenant) {
		const engagements = await client.propertyEngagement.findMany({
			where: { tenantId: existingTenant.id },
			select: { id: true, propertyAssetId: true },
		});
		const engagementIds = engagements.map((engagement) => engagement.id);
		const assetIds = [
			...new Set(engagements.map((engagement) => engagement.propertyAssetId)),
		];

		// Remove image and document files for the demo tenant only (isolation tenant has none)
		if (slug === DEMO_TENANT_SLUG) {
			await removeDemoImageFiles(existingTenant.id);
			await removeDemoDocumentFiles(client, existingTenant.id);
		}

		await client.$transaction([
			client.notification.deleteMany({
				where: { tenantId: existingTenant.id },
			}),
			client.analyticsEvent.deleteMany({
				where: { tenantId: existingTenant.id },
			}),
			client.document.deleteMany({
				where: { documentRequest: { tenantId: existingTenant.id } },
			}),
			client.documentRequest.deleteMany({
				where: { tenantId: existingTenant.id },
			}),
			// status change requests must be deleted before engagements (FK constraint)
			client.statusChangeRequest.deleteMany({
				where: { tenantId: existingTenant.id },
			}),
			client.movement.deleteMany({ where: { tenantId: existingTenant.id } }),
			client.tenantMovementOutcomeLabel.deleteMany({
				where: { tenantId: existingTenant.id },
			}),
			client.propertyAgent.deleteMany({
				where: { tenantId: existingTenant.id },
			}),
			client.propertyEngagement.deleteMany({
				where: { tenantId: existingTenant.id },
			}),
			...(assetIds.length > 0
				? [
						client.propertyAssetOwner.deleteMany({
							where: { propertyAssetId: { in: assetIds } },
						}),
						client.propertyAssetImage.deleteMany({
							where: { propertyAssetId: { in: assetIds } },
						}),
						client.propertyAsset.deleteMany({
							where: { id: { in: assetIds } },
						}),
					]
				: []),
			...(engagementIds.length > 0
				? [
						client.analyticsEvent.deleteMany({
							where: { propertyEngagementId: { in: engagementIds } },
						}),
					]
				: []),
			client.tenantMembership.deleteMany({
				where: { tenantId: existingTenant.id },
			}),
			client.tenant.delete({ where: { id: existingTenant.id } }),
		]);
	}

	if (knownUserIds.length > 0) {
		await deleteUnreferencedDemoUsers(client, knownUserIds);
	}
}

async function deleteUnreferencedDemoUsers(client, demoUserIds) {
	for (const userId of demoUserIds) {
		const references = await Promise.all([
			client.tenantMembership.count({ where: { userId } }),
			client.refreshToken.count({ where: { userId } }),
			client.propertyAsset.count({ where: { createdByUserId: userId } }),
			client.propertyEngagement.count({ where: { createdByUserId: userId } }),
			client.propertyEngagement.count({ where: { archivedByUserId: userId } }),
			client.propertyAssetOwner.count({ where: { userId } }),
			client.propertyAgent.count({ where: { agentUserId: userId } }),
			client.propertyAgent.count({ where: { assignedByUserId: userId } }),
			client.movement.count({ where: { createdByUserId: userId } }),
			client.documentRequest.count({ where: { requestedByUserId: userId } }),
			client.documentRequest.count({ where: { ownerUserId: userId } }),
			client.documentRequest.count({ where: { reviewedByUserId: userId } }),
			client.documentVersion.count({ where: { uploadedByUserId: userId } }),
			client.propertyAssetImage.count({ where: { uploadedByUserId: userId } }),
			client.analyticsEvent.count({ where: { actorUserId: userId } }),
			client.notification.count({ where: { recipientUserId: userId } }),
		]);

		if (references.every((count) => count === 0)) {
			await client.user.delete({ where: { id: userId } });
		}
	}
}

// ---------------------------------------------------------------------------
// Stage 26.4 — Isolation tenant seeder
// ---------------------------------------------------------------------------

/**
 * Seeds the minimal isolation tenant fixture used by security-isolation.e2e-spec.ts.
 *
 * Shape:
 *   - 1 Tenant (slug: viewpro-isolation-tenant)
 *   - 1 manager User (manager.isolation@viewpro.local, role PRINCIPAL_MANAGER)
 *   - 1 owner User (propietario.isolation@viewpro.local)
 *   - 1 PropertyAsset (title: "Propiedad isolation")
 *   - 1 PropertyEngagement (status: CAPTURE)
 *   - 1 PropertyAssetOwnerAccess (ownerUserId = isolation owner, status ACTIVE)
 *
 * No agents, movements, notifications, or documents are created.
 * The isolation tenant title is used to assert it does NOT appear in cross-tenant
 * response bodies.
 *
 * @param {import('@prisma/client').PrismaClient} client
 */
async function seedIsolationTenant(client) {
	const passwordHash = await hash(DEMO_PASSWORD, { type: argon2id });

	// Create isolation users
	const isolationManager = await client.user.upsert({
		where: { email: DEMO_ISOLATION_MANAGER_EMAIL },
		create: {
			email: DEMO_ISOLATION_MANAGER_EMAIL,
			passwordHash,
			firstName: "Iso",
			lastName: "Manager",
			status: UserStatus.ACTIVE,
			globalRole: GlobalRole.USER,
			emailVerifiedAt: DEMO_NOW,
		},
		update: {
			passwordHash,
			firstName: "Iso",
			lastName: "Manager",
			status: UserStatus.ACTIVE,
			globalRole: GlobalRole.USER,
			emailVerifiedAt: DEMO_NOW,
		},
	});

	const isolationOwner = await client.user.upsert({
		where: { email: DEMO_ISOLATION_OWNER_EMAIL },
		create: {
			email: DEMO_ISOLATION_OWNER_EMAIL,
			passwordHash,
			firstName: "Iso",
			lastName: "Propietario",
			status: UserStatus.ACTIVE,
			globalRole: GlobalRole.USER,
			emailVerifiedAt: DEMO_NOW,
		},
		update: {
			passwordHash,
			firstName: "Iso",
			lastName: "Propietario",
			status: UserStatus.ACTIVE,
			globalRole: GlobalRole.USER,
			emailVerifiedAt: DEMO_NOW,
		},
	});

	// Create isolation tenant with the manager as the only member
	const tenant = await client.tenant.create({
		data: {
			name: DEMO_ISOLATION_TENANT_NAME,
			slug: DEMO_ISOLATION_TENANT_SLUG,
			status: TenantStatus.ACTIVE,
			maxUsers: 5,
			maxActivePropertyEngagements: 5,
			maxDocumentsStorageMb: 64,
			memberships: {
				create: [
					{
						userId: isolationManager.id,
						role: TenantRole.PRINCIPAL_MANAGER,
					},
				],
			},
		},
	});

	// Create a minimal property asset + engagement (no images, no agents, no documents)
	const asset = await client.propertyAsset.create({
		data: {
			title: DEMO_ISOLATION_PROPERTY_TITLE,
			addressLine: "Aislamiento 1",
			city: "Córdoba",
			province: "Córdoba",
			propertyType: PropertyType.HOUSE,
			ownerName: `${isolationOwner.firstName} ${isolationOwner.lastName}`,
			ownerEmail: DEMO_ISOLATION_OWNER_EMAIL,
			createdByUserId: isolationManager.id,
			createdAt: daysAgo(5),
		},
	});

	// Link isolation owner to the asset (ACTIVE access — used by B-3 tests)
	await client.propertyAssetOwner.create({
		data: {
			propertyAssetId: asset.id,
			ownerEmail: DEMO_ISOLATION_OWNER_EMAIL,
			ownerFirstName: isolationOwner.firstName,
			ownerLastName: isolationOwner.lastName,
			userId: isolationOwner.id,
			isPrimary: true,
			accessStatus: PropertyAssetOwnerAccessStatus.ACTIVE,
			createdAt: daysAgo(4),
		},
	});

	const engagement = await client.propertyEngagement.create({
		data: {
			tenantId: tenant.id,
			propertyAssetId: asset.id,
			operationType: PropertyOperationType.SALE,
			status: PropertyEngagementStatus.CAPTURE,
			publishedPriceCents: moneyToCents(1),
			currency: "USD",
			createdByUserId: isolationManager.id,
			createdAt: daysAgo(4),
		},
	});

	return {
		tenant,
		manager: isolationManager,
		owner: isolationOwner,
		asset,
		engagement,
	};
}

async function createDemoUsers(client) {
	const passwordHash = await hash(DEMO_PASSWORD, { type: argon2id });
	const users = new Map();

	for (const user of DEMO_AUTH_USERS) {
		const created = await client.user.upsert({
			where: { email: user.email },
			create: {
				email: user.email,
				passwordHash,
				firstName: user.firstName,
				lastName: user.lastName,
				whatsappPhone: user.whatsappPhone ?? null,
				status: UserStatus.ACTIVE,
				globalRole: user.globalRole ?? GlobalRole.USER,
				emailVerifiedAt: DEMO_NOW,
			},
			update: {
				passwordHash,
				firstName: user.firstName,
				lastName: user.lastName,
				whatsappPhone: user.whatsappPhone ?? null,
				status: UserStatus.ACTIVE,
				globalRole: user.globalRole ?? GlobalRole.USER,
				emailVerifiedAt: DEMO_NOW,
			},
		});
		users.set(user.email, { ...created, role: user.role });
	}

	return users;
}

async function createDemoTenant(client, users) {
	const manager = users.get("demo@viewpro.local");

	return client.tenant
		.create({
			data: {
				name: DEMO_TENANT_NAME,
				slug: DEMO_TENANT_SLUG,
				status: TenantStatus.ACTIVE,
				whatsappPhone: DEMO_TENANT_WHATSAPP_PHONE,
				...DEMO_TENANT_LIMITS,
				memberships: {
					create: DEMO_USERS.map((user) => ({
						userId: users.get(user.email).id,
						role: user.role,
					})),
				},
			},
			include: {
				memberships: true,
			},
		})
		.then((tenant) => ({ ...tenant, manager }));
}

async function createDemoProperties(client, tenant, users) {
	const manager = users.get("demo@viewpro.local");
	const demoOwner = users.get(DEMO_OWNER_EMAIL);
	const sellers = [
		users.get("sofia.demo@viewpro.local"),
		users.get("martin.demo@viewpro.local"),
		users.get("lucia.demo@viewpro.local"),
	];
	const createdProperties = [];

	for (const [index, property] of DEMO_PROPERTIES.entries()) {
		const seller = sellers[index % sellers.length];
		const isDemoOwnerProperty = index === 0;
		const ownerEmail = isDemoOwnerProperty
			? DEMO_OWNER_EMAIL
			: `propietario-${index + 1}@viewpro.local`;
		const ownerName = isDemoOwnerProperty
			? `${demoOwner.firstName} ${demoOwner.lastName}`
			: `Propietario Demo ${index + 1}`;
		const asset = await client.propertyAsset.create({
			data: {
				title: property.title,
				addressLine: property.addressLine,
				city: property.city,
				province: property.province,
				propertyType: property.propertyType,
				totalAreaSqm: property.totalAreaSqm ?? null,
				coveredAreaSqm: property.coveredAreaSqm ?? null,
				rooms: property.rooms ?? null,
				bedrooms: property.bedrooms ?? null,
				bathrooms: property.bathrooms ?? null,
				garages: property.garages ?? null,
				ageYears: property.ageYears ?? null,
				orientation: property.orientation ?? null,
				ownerName,
				ownerEmail,
				createdByUserId: manager.id,
				createdAt: daysAgo(40 - (index % 12)),
			},
		});

		const owner = await client.propertyAssetOwner.create({
			data: {
				propertyAssetId: asset.id,
				ownerEmail,
				ownerFirstName: isDemoOwnerProperty
					? demoOwner.firstName
					: "Propietario",
				ownerLastName: isDemoOwnerProperty
					? demoOwner.lastName
					: `Demo ${index + 1}`,
				userId: isDemoOwnerProperty ? demoOwner.id : undefined,
				isPrimary: true,
				accessStatus: isDemoOwnerProperty
					? PropertyAssetOwnerAccessStatus.ACTIVE
					: PropertyAssetOwnerAccessStatus.INVITED,
				createdAt: daysAgo(35 - (index % 10)),
			},
		});

		const engagement = await client.propertyEngagement.create({
			data: {
				tenantId: tenant.id,
				propertyAssetId: asset.id,
				operationType: property.operationType,
				status: property.status,
				publishedPriceCents: moneyToCents(property.price),
				currency: property.currency,
				createdByUserId: manager.id,
				createdAt: daysAgo(38 - (index % 10)),
				agents: {
					create: {
						tenantId: tenant.id,
						agentUserId: seller.id,
						assignedByUserId: manager.id,
						assignedAt: daysAgo(34 - (index % 8)),
					},
				},
			},
		});

		createdProperties.push({
			fixture: property,
			asset,
			engagement,
			owner,
			seller,
		});
	}

	return createdProperties;
}

async function createDemoExistingOwnerInvitation(client, users, properties) {
	const owner = users.get(DEMO_OWNER_EMAIL);
	const property = properties.find(
		(candidate) =>
			candidate.fixture.title === DEMO_EXISTING_OWNER_INVITED_PROPERTY_TITLE,
	);

	if (!owner || !property) {
		return null;
	}

	const propertyOwner = await client.propertyAssetOwner.create({
		data: {
			propertyAssetId: property.asset.id,
			ownerEmail: owner.email,
			ownerFirstName: owner.firstName,
			ownerLastName: owner.lastName,
			accessStatus: PropertyAssetOwnerAccessStatus.INVITED,
			isPrimary: false,
			createdAt: daysAgo(3),
		},
	});

	return client.ownerInvitation.create({
		data: {
			propertyAssetOwnerId: propertyOwner.id,
			email: owner.email,
			tokenHash: hashOwnerInvitationToken(DEMO_EXISTING_OWNER_INVITATION_TOKEN),
			// expiresAt is anchored to DEMO_NOW (frozen at 2026-06-01) for seed determinism,
			// but the API checks expiry against wall-clock time. A 14-day window made the
			// fixture expire on 2026-06-15 and broke the seeded smoke. Use a 10-year window
			// so the demo invitation remains accept-able regardless of when the seed last ran.
			expiresAt: daysFromNow(3650),
		},
	});
}

async function createDemoPropertyImages(client, tenant, properties) {
	const images = [];

	for (const [propertyIndex, property] of properties.entries()) {
		for (
			let imageIndex = 0;
			imageIndex < DEMO_IMAGES_PER_PROPERTY;
			imageIndex += 1
		) {
			const buffer = getDemoImageBuffer(propertyIndex, imageIndex);
			const mimeType = getDemoImageMime(propertyIndex, imageIndex);
			const extension = getDemoImageExtension(propertyIndex, imageIndex);
			const imageId = `demo-property-image-${propertyIndex + 1}-${
				imageIndex + 1
			}`;
			const originalFilename = `demo-property-${propertyIndex + 1}-${
				imageIndex + 1
			}.${extension}`;
			const storageKey = [
				PROPERTY_IMAGES_STORAGE_PREFIX,
				tenant.id,
				property.asset.id,
				`${imageId}.${extension}`,
			].join("/");

			await writeDemoImageFile(storageKey, buffer);
			images.push(
				await client.propertyAssetImage.create({
					data: {
						id: imageId,
						propertyAssetId: property.asset.id,
						uploadedByUserId: tenant.manager.id,
						storageKey,
						originalFilename,
						mimeType,
						sizeBytes: buffer.byteLength,
						isPrimary: imageIndex === 0,
						createdAt: daysAgo(Math.max(1, propertyIndex % 12)),
					},
				}),
			);
		}
	}

	return images;
}

async function writeDemoImageFile(storageKey, buffer) {
	const absolutePath = join(getUploadsRoot(), storageKey);
	await mkdir(dirname(absolutePath), { recursive: true });
	await writeFile(absolutePath, buffer);
}

async function removeDemoImageFiles(tenantId) {
	await rm(join(getUploadsRoot(), PROPERTY_IMAGES_STORAGE_PREFIX, tenantId), {
		force: true,
		recursive: true,
	});
}

async function removeDemoDocumentFiles(client, tenantId) {
	if (!isLocalDocumentStorageConfigured()) {
		return;
	}

	const versions = await client.documentVersion.findMany({
		where: { document: { documentRequest: { tenantId } } },
		select: { storageKey: true },
	});

	await Promise.all(
		versions.flatMap((version) => {
			const absolutePath = resolveDocumentStoragePath(version.storageKey);
			return [
				rm(absolutePath, { force: true }),
				rm(`${absolutePath}.metadata.json`, { force: true }),
			];
		}),
	);

	await rm(join(getDocumentStorageRoot(), DOCUMENT_STORAGE_PREFIX, tenantId), {
		force: true,
		recursive: true,
	});
}

function getUploadsRoot() {
	if (process.env.PROPERTY_IMAGES_UPLOADS_ROOT) {
		return resolve(process.env.PROPERTY_IMAGES_UPLOADS_ROOT);
	}

	return join(apiRoot, "uploads");
}

function getDocumentStorageRoot() {
	return resolve(
		process.env.DOCUMENT_STORAGE_LOCAL_ROOT ??
			join(process.cwd(), ".document-storage"),
	);
}

function resolveDocumentStoragePath(storageKey) {
	const root = getDocumentStorageRoot();
	const absolutePath = resolve(root, storageKey);

	if (absolutePath !== root && !absolutePath.startsWith(`${root}/`)) {
		throw new Error(
			`Refusing to write document fixture outside storage root: ${storageKey}`,
		);
	}

	return absolutePath;
}

function isLocalDocumentStorageConfigured() {
	return (
		process.env.DOCUMENT_STORAGE_DRIVER === "local" ||
		Boolean(process.env.DOCUMENT_STORAGE_LOCAL_ROOT)
	);
}

async function createDemoMovements(client, tenant, users, properties) {
	const sellers = [
		users.get("sofia.demo@viewpro.local"),
		users.get("martin.demo@viewpro.local"),
		users.get("lucia.demo@viewpro.local"),
	];
	const movementInputs = properties.flatMap((property, index) =>
		buildMovementsForProperty(property, index, sellers),
	);
	const movements = [];

	for (const movement of movementInputs) {
		movements.push(
			await client.movement.create({
				data: {
					tenantId: tenant.id,
					propertyEngagementId: movement.property.engagement.id,
					createdByUserId: movement.createdByUserId,
					type: movement.type,
					observation: movement.observation,
					nextStep: movement.nextStep ?? null,
					previousStatus: movement.previousStatus ?? null,
					newStatus: movement.newStatus ?? null,
					source: MovementSource.MANUAL,
					interestCount: movement.interestCount ?? null,
					visitCount: movement.visitCount ?? null,
					offerAmountCents: movement.offerAmountCents ?? null,
					interestLevel: movement.interestLevel ?? null,
					createdAt: movement.createdAt,
				},
			}),
		);
	}

	await createMovementAnalyticsEvents(client, tenant, movements);

	return movements;
}

function buildMovementsForProperty(property, index, sellers) {
	const seller = sellers[index % sellers.length];
	const collaborator = sellers[(index + 1) % sellers.length];
	const base = [
		{
			property,
			createdByUserId: seller.id,
			type: MovementType.GENERAL_UPDATE,
			observation: `Se actualizó la ficha comercial de ${property.fixture.title}.`,
			nextStep: "Revisar próximos pasos con el equipo comercial.",
			createdAt: daysAgo((index % 15) + 1),
		},
	];

	if (index % 2 === 0) {
		base.push({
			property,
			createdByUserId: collaborator.id,
			type: MovementType.INQUIRY,
			observation:
				"Ingresó una consulta calificada y se respondió con disponibilidad.",
			nextStep: "Coordinar visita o llamada de seguimiento.",
			interestCount: 1 + (index % 4),
			interestLevel:
				index % 4 === 0 ? InterestLevel.HIGH : InterestLevel.MEDIUM,
			createdAt: daysAgo(index % 7),
		});
	}

	if (index % 3 === 0) {
		base.push({
			property,
			createdByUserId: seller.id,
			type: MovementType.VISIT_SCHEDULED,
			observation:
				"Se coordinó una visita con un interesado para los próximos días.",
			nextStep: "Confirmar asistencia y preparar material de la propiedad.",
			visitCount: 1,
			createdAt: daysAgo((index % 5) + 1),
		});
	}

	if (index % 4 === 0) {
		base.push({
			property,
			createdByUserId: collaborator.id,
			type: MovementType.VISIT_COMPLETED,
			observation:
				"La visita se realizó y el interesado pidió información adicional.",
			nextStep: "Enviar documentación y condiciones actualizadas.",
			visitCount: 1,
			createdAt: daysAgo((index % 9) + 2),
		});
	}

	if (index % 5 === 0) {
		base.push({
			property,
			createdByUserId: seller.id,
			type: MovementType.OFFER_RECEIVED,
			observation:
				"Se recibió una oferta inicial para evaluar con el propietario.",
			nextStep: "Contactar al propietario para definir contraoferta.",
			offerAmountCents: moneyToCents(Math.round(property.fixture.price * 0.94)),
			interestLevel: InterestLevel.HIGH,
			createdAt: daysAgo((index % 6) + 1),
		});
	}

	if (index % 3 === 1) {
		base.push({
			property,
			createdByUserId: collaborator.id,
			type: MovementType.DOCUMENTATION_UPDATE,
			observation:
				"Se revisó la documentación disponible y faltan respaldos para completar la carpeta.",
			nextStep: "Pedir documentación pendiente al propietario.",
			createdAt: daysAgo((index % 11) + 3),
		});
	}

	if (index % 6 === 0) {
		base.push({
			property,
			createdByUserId: seller.id,
			type: MovementType.STATUS_CHANGE,
			observation:
				"La gestión avanzó de etapa comercial según actividad reciente.",
			previousStatus: PropertyEngagementStatus.ACTIVE_PUBLICATION,
			newStatus: property.fixture.status,
			createdAt: daysAgo((index % 13) + 2),
		});
	}

	return base;
}

async function createMovementAnalyticsEvents(client, tenant, movements) {
	if (movements.length === 0) {
		return;
	}

	await client.analyticsEvent.createMany({
		data: movements.map((movement) => ({
			tenantId: tenant.id,
			actorUserId: movement.createdByUserId,
			actorType: AnalyticsActorType.INTERNAL_USER,
			eventName: AnalyticsEventName.MOVEMENT_CREATED,
			propertyEngagementId: movement.propertyEngagementId,
			movementId: movement.id,
			occurredAt: movement.createdAt,
		})),
	});
}

async function createDemoDocumentRequests(client, tenant, users, properties) {
	const requesters = [
		users.get("demo@viewpro.local"),
		users.get("sofia.demo@viewpro.local"),
		users.get("martin.demo@viewpro.local"),
	];
	const documentRequests = [];

	for (const [index, property] of properties.entries()) {
		if (index % 2 !== 0) {
			continue;
		}

		const requestCount = index % 4 === 0 ? 2 : 1;

		for (let requestIndex = 0; requestIndex < requestCount; requestIndex += 1) {
			const title =
				DOCUMENT_TITLES[(index + requestIndex) % DOCUMENT_TITLES.length];
			const requester = requesters[(index + requestIndex) % requesters.length];
			const request = await client.documentRequest.create({
				data: {
					tenantId: tenant.id,
					propertyEngagementId: property.engagement.id,
					propertyAssetOwnerId: property.owner.id,
					ownerUserId: property.owner.userId ?? null,
					requestedByUserId: requester.id,
					title,
					description: `Solicitud demo para completar carpeta: ${title}.`,
					status: DocumentRequestStatus.PENDING,
					createdAt: daysAgo((index + requestIndex) % 18),
				},
			});

			documentRequests.push(request);
		}
	}

	const reviewStateRequests = await createDemoDocumentReviewStates(
		client,
		tenant,
		users,
		properties,
	);
	documentRequests.push(...reviewStateRequests);

	await createDocumentAnalyticsEvents(client, tenant, documentRequests);
	await createDocumentReviewAnalyticsEvents(
		client,
		tenant,
		reviewStateRequests,
	);

	return documentRequests;
}

async function createDemoDocumentReviewStates(
	client,
	tenant,
	users,
	properties,
) {
	const property = properties[0];
	const owner = users.get(DEMO_OWNER_EMAIL);
	const requester = users.get("sofia.demo@viewpro.local");
	const reviewer = users.get("demo@viewpro.local");

	if (!property || !owner || !requester || !reviewer) {
		return [];
	}

	// Property index 0 (Villa Centenario) — original fixtures + Stage 20.9 APPROVED fixture.
	const fixtures = [
		{
			title: "Escritura firmada",
			description: "Documento demo cargado por el propietario para revisión.",
			status: DocumentRequestStatus.SUBMITTED,
			versionStatus: DocumentVersionStatus.UPLOADED,
			originalFilename: "escritura-firmada-demo.pdf",
			body: Buffer.from(
				"%PDF-1.4\n% ViewPro demo submitted document\n",
				"utf8",
			),
			createdAt: daysAgo(7),
			uploadedAt: daysAgo(6),
		},
		{
			title: "DNI del propietario observado",
			description:
				"Documento demo observado para probar reenvío desde portal propietario.",
			status: DocumentRequestStatus.REJECTED,
			versionStatus: DocumentVersionStatus.REJECTED,
			originalFilename: "dni-propietario-observado-demo.pdf",
			body: Buffer.from("%PDF-1.4\n% ViewPro demo rejected document\n", "utf8"),
			rejectionReason:
				"La imagen no permite leer el dorso del DNI. Subí una copia más nítida.",
			createdAt: daysAgo(10),
			uploadedAt: daysAgo(9),
			reviewedAt: daysAgo(8),
		},
		// Stage 20.9 — APPROVED fixture for lifecycle coverage (FR-10, S-14).
		{
			title: "Boleto de compra-venta aprobado",
			description: "Documento demo aprobado por el manager para Stage 20.9 coverage.",
			status: DocumentRequestStatus.APPROVED,
			versionStatus: DocumentVersionStatus.APPROVED,
			originalFilename: "boleto-compraventa-aprobado-demo.pdf",
			body: Buffer.from(
				"%PDF-1.4\n% ViewPro stage 20.9 approved fixture\n",
				"utf8",
			),
			createdAt: daysAgo(4),
			uploadedAt: daysAgo(3),
			reviewedAt: daysAgo(2),
		},
	];

	const requests = [];

	for (const fixture of fixtures) {
		const request = await client.documentRequest.create({
			data: {
				tenantId: tenant.id,
				propertyEngagementId: property.engagement.id,
				propertyAssetOwnerId: property.owner.id,
				ownerUserId: owner.id,
				requestedByUserId: requester.id,
				title: fixture.title,
				description: fixture.description,
				status: fixture.status,
				reviewedByUserId:
					fixture.status === DocumentRequestStatus.REJECTED ||
					fixture.status === DocumentRequestStatus.APPROVED
						? reviewer.id
						: null,
				reviewedAt: fixture.reviewedAt ?? null,
				rejectionReason: fixture.rejectionReason ?? null,
				createdAt: fixture.createdAt,
				updatedAt: fixture.reviewedAt ?? fixture.uploadedAt,
			},
		});
		const storageKey = [
			DOCUMENT_STORAGE_PREFIX,
			tenant.id,
			request.id,
			fixture.originalFilename,
		].join("/");
		const document = await client.document.create({
			data: { documentRequestId: request.id },
		});
		const version = await client.documentVersion.create({
			data: {
				documentId: document.id,
				uploadedByUserId: owner.id,
				storageKey,
				originalFilename: fixture.originalFilename,
				mimeType: "application/pdf",
				sizeBytes: fixture.body.byteLength,
				checksum: `demo:${fixture.status.toLowerCase()}:${request.id}`,
				status: fixture.versionStatus,
				createdAt: fixture.uploadedAt,
			},
		});
		await client.document.update({
			where: { id: document.id },
			data: { currentVersionId: version.id },
		});
		await writeDemoDocumentFileIfEnabled(storageKey, fixture.body, {
			mimeType: "application/pdf",
			sizeBytes: fixture.body.byteLength,
		});
		requests.push({
			...request,
			demoUploadedAt: fixture.uploadedAt,
			demoReviewedAt: fixture.reviewedAt ?? null,
		});
	}

	// Stage 20.9 — CANCELLED fixture on Villa Centenario for lifecycle coverage (FR-10, D1).
	// No version row: cancellation predates any upload, which matches a realistic workflow.
	const cancelledRequest = await client.documentRequest.create({
		data: {
			tenantId: tenant.id,
			propertyEngagementId: property.engagement.id,
			propertyAssetOwnerId: property.owner.id,
			ownerUserId: owner.id,
			requestedByUserId: users.get("martin.demo@viewpro.local").id,
			title: "Plano municipal (solicitud cancelada)",
			description:
				"Documento demo cancelado antes de la carga (Stage 20.9 coverage).",
			status: DocumentRequestStatus.CANCELLED,
			reviewedByUserId: null,
			reviewedAt: null,
			rejectionReason: null,
			createdAt: daysAgo(12),
			updatedAt: daysAgo(11),
		},
	});
	// demoUploadedAt: null signals no version row; createDocumentReviewAnalyticsEvents
	// will skip this request (no DOCUMENT_UPLOADED event for a cancelled request).
	requests.push({ ...cancelledRequest, demoUploadedAt: null, demoReviewedAt: null });

	// NEW (Stage 26.3) — Property index 1 (Los Boulevares): SUBMITTED fixture for the
	// document-rejection test (T18a/T18b). Uses propietario.demo@viewpro.local via the
	// secondary propertyAssetOwner created by createDemoExistingOwnerInvitation.
	const boulevaresProperty = properties[1];
	if (boulevaresProperty && owner && requester) {
		// Find the secondary propertyAssetOwner record for propietario.demo on Los Boulevares.
		// This record is created by createDemoExistingOwnerInvitation with isPrimary: false.
		// Note: the invitation owner record has userId=null (set to ACTIVE only after acceptance),
		// so we query by ownerEmail, not userId.
		const secondaryOwnerRecord = await client.propertyAssetOwner.findFirst({
			where: {
				propertyAssetId: boulevaresProperty.asset.id,
				ownerEmail: owner.email,
				isPrimary: false,
			},
		});
		if (secondaryOwnerRecord) {
			const submittedFixture = {
				title: "Constancia de servicios pendiente de revisión",
				description: "Documento demo cargado para test de rechazo manager.",
				status: DocumentRequestStatus.SUBMITTED,
				versionStatus: DocumentVersionStatus.UPLOADED,
				originalFilename: "servicios-pendientes-demo.pdf",
				body: Buffer.from(
					"%PDF-1.4\n% ViewPro stage 26.3 reject fixture\n",
					"utf8",
				),
				createdAt: daysAgo(2),
				uploadedAt: daysAgo(1),
			};
			const submittedRequest = await client.documentRequest.create({
				data: {
					tenantId: tenant.id,
					propertyEngagementId: boulevaresProperty.engagement.id,
					propertyAssetOwnerId: secondaryOwnerRecord.id,
					ownerUserId: owner.id,
					requestedByUserId: requester.id,
					title: submittedFixture.title,
					description: submittedFixture.description,
					status: submittedFixture.status,
					reviewedByUserId: null,
					reviewedAt: null,
					rejectionReason: null,
					createdAt: submittedFixture.createdAt,
					updatedAt: submittedFixture.uploadedAt,
				},
			});
			const submittedStorageKey = [
				DOCUMENT_STORAGE_PREFIX,
				tenant.id,
				submittedRequest.id,
				submittedFixture.originalFilename,
			].join("/");
			const submittedDocument = await client.document.create({
				data: { documentRequestId: submittedRequest.id },
			});
			const submittedVersion = await client.documentVersion.create({
				data: {
					documentId: submittedDocument.id,
					uploadedByUserId: owner.id,
					storageKey: submittedStorageKey,
					originalFilename: submittedFixture.originalFilename,
					mimeType: "application/pdf",
					sizeBytes: submittedFixture.body.byteLength,
					checksum: `demo:submitted:${submittedRequest.id}`,
					status: submittedFixture.versionStatus,
					createdAt: submittedFixture.uploadedAt,
				},
			});
			await client.document.update({
				where: { id: submittedDocument.id },
				data: { currentVersionId: submittedVersion.id },
			});
			await writeDemoDocumentFileIfEnabled(
				submittedStorageKey,
				submittedFixture.body,
				{
					mimeType: "application/pdf",
					sizeBytes: submittedFixture.body.byteLength,
				},
			);
			requests.push({
				...submittedRequest,
				demoUploadedAt: submittedFixture.uploadedAt,
				demoReviewedAt: null,
			});
		}
	}

	return requests;
}

async function createDocumentAnalyticsEvents(client, tenant, documentRequests) {
	if (documentRequests.length === 0) {
		return;
	}

	await client.analyticsEvent.createMany({
		data: documentRequests.map((request) => ({
			tenantId: tenant.id,
			actorUserId: request.requestedByUserId,
			actorType: AnalyticsActorType.INTERNAL_USER,
			eventName: AnalyticsEventName.DOCUMENT_REQUESTED,
			propertyEngagementId: request.propertyEngagementId,
			documentRequestId: request.id,
			occurredAt: request.createdAt,
		})),
	});
}

async function createDocumentReviewAnalyticsEvents(
	client,
	tenant,
	documentRequests,
) {
	if (documentRequests.length === 0) {
		return;
	}

	const events = documentRequests.flatMap((request) => {
		// Skip CANCELLED requests: they have no version row and no upload event to record.
		if (request.status === DocumentRequestStatus.CANCELLED) {
			return [];
		}

		const uploadedEvent = {
			tenantId: tenant.id,
			actorUserId: request.ownerUserId,
			actorType: AnalyticsActorType.OWNER,
			eventName: AnalyticsEventName.DOCUMENT_UPLOADED,
			propertyEngagementId: request.propertyEngagementId,
			documentRequestId: request.id,
			occurredAt: request.demoUploadedAt ?? request.updatedAt,
		};

		if (request.status !== DocumentRequestStatus.REJECTED) {
			return [uploadedEvent];
		}

		return [
			uploadedEvent,
			{
				tenantId: tenant.id,
				actorUserId: request.reviewedByUserId,
				actorType: AnalyticsActorType.INTERNAL_USER,
				eventName: AnalyticsEventName.DOCUMENT_REJECTED,
				propertyEngagementId: request.propertyEngagementId,
				documentRequestId: request.id,
				occurredAt:
					request.demoReviewedAt ?? request.reviewedAt ?? request.updatedAt,
			},
		];
	});

	await client.analyticsEvent.createMany({ data: events });
}

async function createDemoNotifications(
	client,
	tenant,
	users,
	properties,
	movements,
	documentRequests,
) {
	const owner = users.get(DEMO_OWNER_EMAIL);
	const manager = users.get("demo@viewpro.local");
	const ownerProperty = properties[0];
	const submittedDocument = documentRequests.find(
		(request) => request.title === "Escritura firmada",
	);
	const rejectedDocument = documentRequests.find(
		(request) => request.title === "DNI del propietario observado",
	);
	const statusMovement = movements.find(
		(movement) => movement.type === MovementType.STATUS_CHANGE,
	);

	if (!owner || !manager || !ownerProperty || !submittedDocument) {
		return [];
	}

	const notifications = [
		{
			tenantId: tenant.id,
			recipientUserId: owner.id,
			surface: NotificationSurface.OWNER,
			type: NotificationType.DOCUMENT_REQUESTED,
			title: "Document requested",
			body: "Escritura firmada",
			linkHref: `/owner/properties/${ownerProperty.asset.id}`,
			propertyEngagementId: ownerProperty.engagement.id,
			propertyAssetId: ownerProperty.asset.id,
			documentRequestId: submittedDocument.id,
			readAt: null,
			createdAt: daysAgo(5),
		},
		{
			tenantId: tenant.id,
			recipientUserId: owner.id,
			surface: NotificationSurface.OWNER,
			type: NotificationType.DOCUMENT_REJECTED,
			title: "Document rejected",
			body: "DNI del propietario observado",
			linkHref: `/owner/properties/${ownerProperty.asset.id}`,
			propertyEngagementId: ownerProperty.engagement.id,
			propertyAssetId: ownerProperty.asset.id,
			documentRequestId: rejectedDocument?.id ?? null,
			readAt: daysAgo(2),
			createdAt: daysAgo(4),
		},
		{
			tenantId: tenant.id,
			recipientUserId: manager.id,
			surface: NotificationSurface.INTERNAL,
			type: NotificationType.DOCUMENT_UPLOADED,
			title: "Document uploaded",
			body: "Escritura firmada",
			linkHref: `/dashboard/product/${ownerProperty.engagement.id}`,
			propertyEngagementId: ownerProperty.engagement.id,
			propertyAssetId: ownerProperty.asset.id,
			documentRequestId: submittedDocument.id,
			readAt: null,
			createdAt: daysAgo(3),
		},
		{
			tenantId: tenant.id,
			recipientUserId: manager.id,
			surface: NotificationSurface.INTERNAL,
			type: NotificationType.MOVEMENT_CREATED,
			title: "Movement created",
			body: ownerProperty.fixture.title,
			linkHref: `/dashboard/product/${ownerProperty.engagement.id}`,
			propertyEngagementId: ownerProperty.engagement.id,
			propertyAssetId: ownerProperty.asset.id,
			movementId: statusMovement?.id ?? null,
			readAt: daysAgo(1),
			createdAt: daysAgo(2),
		},
	];

	return Promise.all(
		notifications.map((notification) =>
			client.notification.create({ data: notification }),
		),
	);
}

/**
 * Creates 2 demo status change requests:
 * 1. PENDING — martin.demo requests CAPTURE → ACTIVE_PUBLICATION on property index 6 (Mapuche).
 * 2. RESOLVED (approved, historic) — martin.demo requested INQUIRIES_AND_VISITS → OFFER_NEGOTIATION
 *    on property index 1 (Los Boulevares), resolved by demo@viewpro.local.
 *    A corresponding STATUS_CHANGE movement is inserted for the resolved request.
 */
async function createDemoStatusChangeRequests(client, tenant, users, properties) {
	const martin = users.get("martin.demo@viewpro.local");
	const manager = users.get("demo@viewpro.local");

	if (!martin || !manager) {
		return [];
	}

	// Index 6: Casa para refaccionar en Mapuche — status CAPTURE
	const mapucheProperty = properties[6];
	// Index 1: Casa luminosa con patio en Los Boulevares — status INQUIRIES_AND_VISITS
	const boulevaresProperty = properties[1];

	if (!mapucheProperty || !boulevaresProperty) {
		return [];
	}

	const requests = [];

	// Ensure martin is a PropertyAgent on Mapuche (index 6) so the API assignment check passes.
	// The property's primary seller is sofia (index 6 % 3 = 0), but martin is also co-assigned here.
	await client.propertyAgent.upsert({
		where: {
			propertyEngagementId_agentUserId: {
				agentUserId: martin.id,
				propertyEngagementId: mapucheProperty.engagement.id,
			},
		},
		create: {
			tenantId: tenant.id,
			agentUserId: martin.id,
			propertyEngagementId: mapucheProperty.engagement.id,
			assignedByUserId: manager.id,
			assignedAt: daysAgo(5),
		},
		update: {},
	});

	// Fixture 1 — PENDING
	const pendingRequest = await client.statusChangeRequest.create({
		data: {
			tenantId: tenant.id,
			propertyEngagementId: mapucheProperty.engagement.id,
			requestedByUserId: martin.id,
			targetStatus: PropertyEngagementStatus.ACTIVE_PUBLICATION,
			currentStatusSnapshot: PropertyEngagementStatus.CAPTURE,
			requestNote: "Listo para publicar",
			status: StatusChangeRequestStatus.PENDING,
			createdAt: daysAgo(2),
		},
	});
	requests.push(pendingRequest);

	// Fixture 2 — RESOLVED (approved, historic)
	const resolvedAt = daysAgo(13);
	const resolvedRequest = await client.statusChangeRequest.create({
		data: {
			tenantId: tenant.id,
			propertyEngagementId: boulevaresProperty.engagement.id,
			requestedByUserId: martin.id,
			targetStatus: PropertyEngagementStatus.OFFER_NEGOTIATION,
			currentStatusSnapshot: PropertyEngagementStatus.INQUIRIES_AND_VISITS,
			requestNote: "Hay una oferta en evaluación",
			status: StatusChangeRequestStatus.RESOLVED,
			resolvedByUserId: manager.id,
			resolvedAt,
			createdAt: daysAgo(15),
		},
	});
	requests.push(resolvedRequest);

	// Insert corresponding STATUS_CHANGE movement for the approved request
	await client.movement.create({
		data: {
			tenantId: tenant.id,
			propertyEngagementId: boulevaresProperty.engagement.id,
			createdByUserId: martin.id,
			type: MovementType.STATUS_CHANGE,
			observation: "State change approved",
			previousStatus: PropertyEngagementStatus.INQUIRIES_AND_VISITS,
			newStatus: PropertyEngagementStatus.OFFER_NEGOTIATION,
			source: MovementSource.SYSTEM,
			createdAt: resolvedAt,
		},
	});

	// Stage 20.11 S-8 fixture: manager-authored movement on Boulevares (Martin's assigned property).
	// Purpose: proves Bug 2 fix — filtering by Responsable=Martín must return this movement
	// even though it was created by the manager (not by Martín).
	// Under the old broken code (createdByUserId filter), this movement would be HIDDEN.
	// Under the fixed code (assignedAgentUserId filter), it APPEARS because Martín is assigned.
	await client.movement.create({
		data: {
			tenantId: tenant.id,
			propertyEngagementId: boulevaresProperty.engagement.id,
			createdByUserId: manager.id,
			type: MovementType.GENERAL_UPDATE,
			observation: "Manager note on Boulevares",
			source: MovementSource.MANUAL,
			createdAt: daysAgo(0), // seed clock day (DEMO_NOW = 2026-06-01)
		},
	});

	return requests;
}

async function createDemoAdminAuditEvents(client, tenant, users) {
	const admin = users.get(DEMO_ADMIN_USER.email);

	if (!admin) {
		return [];
	}

	const events = [
		{
			tenantId: tenant.id,
			actorUserId: admin.id,
			actorType: AnalyticsActorType.INTERNAL_USER,
			eventName: AnalyticsEventName.TENANT_STATUS_CHANGED,
			metadata: { from: TenantStatus.TRIAL, to: TenantStatus.ACTIVE },
			occurredAt: daysAgo(6),
		},
		{
			tenantId: tenant.id,
			actorUserId: admin.id,
			actorType: AnalyticsActorType.INTERNAL_USER,
			eventName: AnalyticsEventName.TENANT_LIMITS_UPDATED,
			metadata: DEMO_TENANT_LIMITS,
			occurredAt: daysAgo(5),
		},
	];

	return Promise.all(
		events.map((event) => client.analyticsEvent.create({ data: event })),
	);
}

async function writeDemoDocumentFileIfEnabled(storageKey, buffer, metadata) {
	if (!isLocalDocumentStorageConfigured()) {
		return;
	}

	const absolutePath = resolveDocumentStoragePath(storageKey);
	await mkdir(dirname(absolutePath), { recursive: true });
	await writeFile(absolutePath, buffer);
	await writeFile(`${absolutePath}.metadata.json`, JSON.stringify(metadata));
}

function assertSafeEnvironment() {
	if (process.env.NODE_ENV === "production") {
		throw new Error("Refusing to run demo seed with NODE_ENV=production.");
	}

	const databaseUrl = process.env.DATABASE_URL;

	if (!databaseUrl) {
		throw new Error("DATABASE_URL is required to run the demo seed.");
	}

	if (process.env.VIEWPRO_ALLOW_DEMO_SEED === "true") {
		return;
	}

	const normalizedUrl = databaseUrl.toLowerCase();
	const looksSafe = [
		"localhost",
		"127.0.0.1",
		"viewpro_dev",
		"viewpro_test",
	].some((signal) => normalizedUrl.includes(signal));

	if (!looksSafe) {
		throw new Error(
			"Refusing to run demo seed against a database URL that does not look local/dev/test. Set VIEWPRO_ALLOW_DEMO_SEED=true only when you are certain this is safe.",
		);
	}
}

function loadEnvFile(filePath) {
	if (!existsSync(filePath)) {
		return;
	}

	const file = readFileSync(filePath, "utf8");

	for (const line of file.split(/\r?\n/)) {
		const trimmedLine = line.trim();

		if (!trimmedLine || trimmedLine.startsWith("#")) {
			continue;
		}

		const separatorIndex = trimmedLine.indexOf("=");

		if (separatorIndex === -1) {
			continue;
		}

		const key = trimmedLine.slice(0, separatorIndex).trim();
		const value = unquoteEnvValue(trimmedLine.slice(separatorIndex + 1).trim());

		if (key && process.env[key] === undefined) {
			process.env[key] = value;
		}
	}
}

function unquoteEnvValue(value) {
	if (
		(value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))
	) {
		return value.slice(1, -1);
	}

	return value;
}

function buildDefaultDemoPassword() {
	return ["viewpro", "demo", "local"].join("-");
}

function daysAgo(days) {
	const date = new Date(DEMO_NOW);
	date.setDate(date.getDate() - days);
	return date;
}

function daysFromNow(days) {
	const date = new Date(DEMO_NOW);
	date.setDate(date.getDate() + days);
	return date;
}

function hashOwnerInvitationToken(token) {
	return createHash("sha256").update(token).digest("hex");
}

function moneyToCents(amount) {
	return Math.round(amount * 100);
}

async function createDemoOutcomeLabels(client, tenant, users) {
	const agent = users.get("martin.demo@viewpro.local");
	const labels = [];

	for (const labelDef of DEMO_OUTCOME_LABELS) {
		const label = await client.tenantMovementOutcomeLabel.upsert({
			where: {
				tenant_movement_outcome_labels_active_tenant_label_key: undefined,
				// Prisma does not support partial unique index in where clause;
				// use a findFirst + create/update pattern for idempotency instead.
				id: `demo-label-${tenant.id}-${labelDef.label.replace(/\s+/g, "-").toLowerCase()}`,
			},
			create: {
				id: `demo-label-${tenant.id}-${labelDef.label.replace(/\s+/g, "-").toLowerCase()}`,
				tenantId: tenant.id,
				label: labelDef.label,
				color: labelDef.color,
				createdByUserId: agent.id,
			},
			update: {
				label: labelDef.label,
				color: labelDef.color,
				deletedAt: null,
			},
		});
		labels.push(label);
	}

	return labels;
}

function printSummary(result) {
	const passwordSummary = process.env.VIEWPRO_DEMO_PASSWORD
		? "<VIEWPRO_DEMO_PASSWORD>"
		: DEMO_PASSWORD;

	console.log(`Seeded ${result.tenant.name}`);
	console.log(`Tenant slug: ${result.tenant.slug}`);
	console.log("Scope: canonical demo tenant and demo users only");
	console.log(`Tenant status: ${result.tenant.status}`);
	console.log(
		`Tenant limits: users=${result.tenant.maxUsers}, activeEngagements=${result.tenant.maxActivePropertyEngagements}, documentsMb=${result.tenant.maxDocumentsStorageMb}`,
	);
	console.log("Logins:");
	console.log(`- Manager: demo@viewpro.local / ${passwordSummary}`);
	console.log(`- Seller: martin.demo@viewpro.local / ${passwordSummary}`);
	console.log(`- Owner: ${DEMO_OWNER_EMAIL} / ${passwordSummary}`);
	console.log(`- ViewPro admin: ${DEMO_ADMIN_USER.email} / ${passwordSummary}`);
	console.log(`Properties: ${result.propertiesCount}`);
	console.log(`Images: ${result.imagesCount}`);
	console.log(
		"Image assets: deterministic local fixtures (real JPG photos when mapped, 1x1 PNG placeholder otherwise)",
	);
	console.log(`Movements: ${result.movementsCount} (Stage 26.2 base + Stage 20.11 S-8 manager-authored movement on Boulevares)`);
	console.log(`Document requests: ${result.documentRequestsCount} (includes Stage 26.3 SUBMITTED fixture on Los Boulevares + Stage 20.9 APPROVED and CANCELLED fixtures on Villa Centenario)`);
	console.log(`Status change requests: ${result.statusChangeRequestsCount}`);
	console.log(`Notifications: ${result.notificationsCount}`);
	console.log(`Admin audit events: ${result.adminEventsCount}`);
	console.log(`Custom outcome labels: ${result.outcomeLabelsCount}`);
	console.log(
		"Contact fixtures: tenant WhatsApp, Martín seller WhatsApp, Sofía no-config movement contact",
	);
	// Stage 26.4 — isolation tenant summary
	if (result.isolationResult) {
		console.log("---");
		console.log(`Isolation tenant: ${result.isolationResult.tenant.name} (slug: ${DEMO_ISOLATION_TENANT_SLUG})`);
		console.log("Isolation tenant: 1 manager, 1 property");
		console.log(`- Isolation manager: ${DEMO_ISOLATION_MANAGER_EMAIL} / ${passwordSummary}`);
		console.log(`- Isolation owner: ${DEMO_ISOLATION_OWNER_EMAIL} / ${passwordSummary}`);
		console.log(`- Isolation engagement id: ${result.isolationResult.engagement.id}`);
		console.log(`- Isolation asset id: ${result.isolationResult.asset.id}`);
	}
}
